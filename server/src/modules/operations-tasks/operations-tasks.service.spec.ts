import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { OperationsTasksService } from './operations-tasks.service.js';

const TASKS = [
  {
    id: 'hospitality-task',
    title: 'Refreshments',
    department: 'Hospitality',
    matchId: null,
    sportId: null,
    status: 'STANDBY',
    createdAt: new Date(),
    assignees: [
      {
        volunteerId: 'hospitality-vol',
        volunteer: {
          id: 'hospitality-vol',
          name: 'Hospitality Volunteer',
          contactNumber: null,
        },
      },
    ],
  },
  {
    id: 'security-task',
    title: 'Gate duty',
    department: 'Security',
    matchId: null,
    sportId: null,
    status: 'STANDBY',
    createdAt: new Date(),
    assignees: [
      {
        volunteerId: 'security-vol',
        volunteer: {
          id: 'security-vol',
          name: 'Security Volunteer',
          contactNumber: null,
        },
      },
    ],
  },
];

function setup(
  roleName: string,
  ownVolunteer?: { id: string; department: string; userId?: string },
) {
  const volunteers = [
    {
      id: 'hospitality-vol',
      name: 'Hospitality Volunteer',
      department: 'Hospitality',
      status: 'ACTIVE',
      userId: null,
      contactNumber: null,
    },
    {
      id: 'security-vol',
      name: 'Security Volunteer',
      department: 'Security',
      status: 'ACTIVE',
      userId: null,
      contactNumber: null,
    },
  ];
  const prisma = {
    userRole: {
      findMany: vi
        .fn()
        .mockResolvedValue([
          { role: { name: roleName }, departmentId: null, sportId: null },
        ]),
    },
    volunteer: {
      findUnique: vi.fn(async ({ where }: any) =>
        where.userId
          ? (ownVolunteer ?? null)
          : volunteers.find((item) => item.id === where.id) || null,
      ),
      findMany: vi.fn(async ({ where }: any) =>
        volunteers.filter((item) => where?.id?.in?.includes(item.id) ?? true),
      ),
    },
    operationsTask: {
      findMany: vi.fn().mockResolvedValue(TASKS),
      create: vi.fn(async ({ data }: any) => ({
        id: 'new-task',
        title: data.title,
        department: data.department,
        matchId: data.matchId ?? null,
        sportId: data.sportId ?? null,
        status: data.status,
        createdAt: new Date(),
        assignees: (data.assignees?.create || []).map((a: any) => ({
          volunteerId: a.volunteerId,
          volunteer: volunteers.find((v) => v.id === a.volunteerId),
        })),
      })),
    },
    sport: { findMany: vi.fn().mockResolvedValue([]) },
    match: { findUnique: vi.fn() },
  } as any;
  const matchesService = {
    assignOfficial: vi.fn(async () => ({})),
    removeOfficial: vi.fn(async () => ({})),
  } as any;
  const rbacService = { hasPermission: vi.fn(async () => true) } as any;
  const notificationsService = {
    sendTaskAssignment: vi.fn(async () => {}),
  } as any;
  return {
    service: new OperationsTasksService(
      matchesService,
      rbacService,
      notificationsService,
      prisma,
    ),
    prisma,
    matchesService,
    rbacService,
  };
}

describe('OperationsTasksService department isolation', () => {
  it('shows a head only volunteers and tasks in their own department', async () => {
    const { service } = setup('HOSPITALITY_HEAD');
    await expect(service.getAssignableVolunteers('head')).resolves.toEqual([
      expect.objectContaining({ id: 'hospitality-vol' }),
    ]);
    await expect(service.getTasks('head')).resolves.toEqual([
      expect.objectContaining({ id: 'hospitality-task' }),
    ]);
  });

  it('rejects assigning another department volunteer', async () => {
    const { service } = setup('HOSPITALITY_HEAD');
    await expect(
      service.createTask(
        { title: 'Wrong scope', assigneeIds: ['security-vol'] },
        'head',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("restricts a plain volunteer to only their own task, not their whole department's", async () => {
    // VOLUNTEER (no Head/Coordinator role) whose only "department" comes from their own
    // linked Volunteer profile — this must NOT unlock the department-wide OR clause.
    const { service } = setup('VOLUNTEER', {
      id: 'hospitality-vol',
      department: 'Hospitality',
    });
    await expect(service.getTasks('plain-vol-user')).resolves.toEqual([
      expect.objectContaining({ id: 'hospitality-task' }),
    ]);
  });

  it('gives a plain volunteer no assignable roster (assigning tasks is a Head action)', async () => {
    const { service } = setup('VOLUNTEER', {
      id: 'hospitality-vol',
      department: 'Hospitality',
    });
    await expect(
      service.getAssignableVolunteers('plain-vol-user'),
    ).resolves.toEqual([]);
  });

  it("a Head's own Volunteer.department (set via RBAC role assignment) determines their scope, not just the hardcoded default", async () => {
    // A SECURITY_HEAD whose own Volunteer profile was checked into "Hospitality"
    // instead (an unusual but valid admin choice) should see Hospitality, not
    // the hardcoded Security default.
    const { service } = setup('SECURITY_HEAD', {
      id: 'security-head-vol',
      department: 'Hospitality',
    });
    await expect(
      service.getAssignableVolunteers('security-head-user'),
    ).resolves.toEqual([expect.objectContaining({ id: 'hospitality-vol' })]);
  });

  it('creates a task with multiple assignees', async () => {
    const { service, prisma } = setup('HOSPITALITY_HEAD');
    const task = await service.createTask(
      {
        title: 'Setup tables',
        department: 'Hospitality',
        assigneeIds: ['hospitality-vol'],
      },
      'head',
    );
    expect(prisma.operationsTask.create).toHaveBeenCalled();
    expect(task.assignees).toHaveLength(1);
  });

  it('links a match-scoped task to MatchOfficial for each linked assignee', async () => {
    const { service, prisma, matchesService } = setup('SPORTS_COORDINATOR');
    const linkedVolunteer = {
      id: 'hospitality-vol',
      name: 'Hospitality Volunteer',
      department: 'Hospitality',
      status: 'ACTIVE',
      userId: 'user-1',
      contactNumber: null,
    };
    prisma.match.findUnique.mockResolvedValue({
      id: 'match-1',
      tournament: { sportId: 'sport-1' },
    });
    prisma.volunteer.findMany.mockResolvedValue([linkedVolunteer]);
    // getAssignableVolunteers scope check re-reads volunteers; make the coordinator global for this test.
    prisma.userRole.findMany.mockResolvedValue([
      { role: { name: 'CONVENER' }, departmentId: null, sportId: null },
    ]);

    await service.createTask(
      {
        title: 'Score Cricket Final',
        matchId: 'match-1',
        assigneeIds: ['hospitality-vol'],
      },
      'coordinator',
    );

    expect(matchesService.assignOfficial).toHaveBeenCalledWith(
      'match-1',
      { userId: 'user-1', role: 'SCOREKEEPER' },
      'coordinator',
    );
  });

  it("rejects linking a task to a match outside the caller's competition authority before writing anything", async () => {
    // Authority is checked up front, before the task row is created — so a
    // rejected match link never leaves a half-created task behind.
    const { service, prisma, rbacService } = setup('HOSPITALITY_HEAD');
    prisma.match.findUnique.mockResolvedValue({
      id: 'match-1',
      tournament: { sportId: 'sport-1' },
    });
    rbacService.hasPermission.mockResolvedValue(false);

    await expect(
      service.createTask(
        {
          title: 'Score Cricket Final',
          department: 'Hospitality',
          matchId: 'match-1',
        },
        'head',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.operationsTask.create).not.toHaveBeenCalled();
  });
});
