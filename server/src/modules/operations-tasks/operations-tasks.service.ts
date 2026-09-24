import { PrismaService } from '../../database/prisma.service.js';
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { MatchesService } from '../fixtures/matches.service.js';
import { RbacService } from '../rbac/rbac.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import {
  departmentAllowed,
  isDepartmentHead,
  HEAD_ROLE_DEPARTMENT,
} from '../../common/department.js';
import {
  CreateOperationsTaskDto,
  UpdateOperationsTaskDto,
} from './dto/operations-tasks.dto.js';

const TASK_INCLUDE = { assignees: { include: { volunteer: true } } } as const;

@Injectable()
export class OperationsTasksService {
  constructor(
    private readonly matchesService: MatchesService,
    private readonly rbacService: RbacService,
    private readonly notificationsService: NotificationsService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Verified up front, before any write, so a task linking to a match the
   * caller has no competition authority over fails cleanly instead of
   * partially committing the task and then failing inside syncMatchOfficials.
   */
  private async assertMatchAuthority(userId: string, matchId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: { tournament: { select: { sportId: true, eventId: true } } },
    });
    if (!match) throw new NotFoundException(`Match "${matchId}" not found`);
    const allowed = await this.rbacService.hasPermission(
      userId,
      'competition.manage',
      {
        sportId: match.tournament?.sportId,
        eventId: match.tournament?.eventId,
      },
    );
    if (!allowed)
      throw new ForbiddenException(
        'You are not authorized to link tasks to this match.',
      );
    return match;
  }

  /**
   * `headDepartments` come from a role assignment (a Head/Coordinator managing that
   * department) and grant department-wide visibility. `ownDepartments` come only from
   * the caller's own linked Volunteer profile — a plain volunteer's department badge,
   * which grants no visibility beyond their own tasks (see getTasks).
   */
  private async accessFor(userId: string) {
    const [roles, volunteer] = await Promise.all([
      this.prisma.userRole.findMany({
        where: {
          userId,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        include: { role: true },
      }),
      this.prisma.volunteer.findUnique({ where: { userId } }),
    ]);
    const roleNames = roles.map((item) => item.role.name);
    if (roleNames.some((name) => ['CONVENER', 'CO_CONVENER'].includes(name))) {
      return {
        global: true,
        headDepartments: [] as string[],
        ownDepartments: [] as string[],
        volunteerId: volunteer?.id,
      };
    }
    const headDepartments = new Set<string>(
      roles
        .filter((item) => isDepartmentHead(item.role.name) && item.departmentId)
        .map((item) => item.departmentId!) as string[],
    );
    // A Head's own Volunteer.department (set via RBAC role assignment, which
    // enforces the role's canonical department) is authoritative when present
    // — falling back to the hardcoded per-role default only for Heads who
    // don't have a department recorded yet.
    const isHead = roleNames.some((name) => isDepartmentHead(name));
    if (isHead && volunteer?.department)
      headDepartments.add(volunteer.department);
    if (isHead && !headDepartments.size) {
      for (const roleName of roleNames)
        if (HEAD_ROLE_DEPARTMENT[roleName])
          headDepartments.add(HEAD_ROLE_DEPARTMENT[roleName]);
    }
    const sportIds = roles
      .filter((item) => item.role.name === 'SPORTS_COORDINATOR' && item.sportId)
      .map((item) => item.sportId!);
    if (sportIds.length) {
      const sports = await this.prisma.sport.findMany({
        where: { id: { in: sportIds } },
        select: { name: true },
      });
      headDepartments.add('Sports');
      sports.forEach((sport) => headDepartments.add(sport.name));
    }
    const ownDepartments = new Set<string>(
      volunteer?.department ? [volunteer.department] : [],
    );
    return {
      global: false,
      headDepartments: [...headDepartments],
      ownDepartments: [...ownDepartments],
      volunteerId: volunteer?.id,
    };
  }

  async getAssignableVolunteers(userId: string) {
    const access = await this.accessFor(userId);
    if (!access.global && !access.headDepartments.length) return [];
    const volunteers = await this.prisma.volunteer.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { name: 'asc' },
      include: { currentVenue: { select: { id: true, name: true } } },
    });
    return volunteers.filter(
      (volunteer) =>
        access.global ||
        departmentAllowed(volunteer.department, access.headDepartments),
    );
  }

  async getTasks(
    userId: string,
    filters?: { department?: string; volunteerId?: string; status?: string },
  ) {
    const access = await this.accessFor(userId);
    let list = await this.prisma.operationsTask.findMany({
      include: TASK_INCLUDE,
    });
    if (!access.global) {
      list = access.headDepartments.length
        ? list.filter(
            (task) =>
              task.assignees.some(
                (a) => a.volunteerId === access.volunteerId,
              ) || departmentAllowed(task.department, access.headDepartments),
          )
        : list.filter((task) =>
            task.assignees.some((a) => a.volunteerId === access.volunteerId),
          );
    }
    if (filters?.department) {
      const dep = filters.department.toLowerCase();
      list = list.filter((t) => t.department?.toLowerCase().includes(dep));
    }
    if (filters?.volunteerId) {
      list = list.filter((t) =>
        t.assignees.some((a) => a.volunteerId === filters.volunteerId),
      );
    }
    if (filters?.status) {
      const st = filters.status.toUpperCase();
      list = list.filter((t) => t.status.toUpperCase() === st);
    }
    return list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /** Roster + task summary shown on the Convener Dashboard's Workforce card. */
  async getSummary(userId: string) {
    const volunteers = await this.getAssignableVolunteers(userId);
    const totalRoster = volunteers.length;
    const activeOnGround = volunteers.filter(
      (v) => v.status.toUpperCase() === 'ACTIVE',
    ).length;
    const standbyReserve = totalRoster - activeOnGround;
    return {
      totalRoster,
      activeOnGround,
      standbyReserve,
      openTasks: (await this.getTasks(userId, {})).filter(
        (task) => task.status !== 'DONE',
      ).length,
    };
  }

  private async assertAssigneesAllowed(
    userId: string | undefined,
    assigneeIds: string[],
  ) {
    if (!assigneeIds.length) return [];
    const volunteers = await this.prisma.volunteer.findMany({
      where: { id: { in: assigneeIds } },
    });
    if (volunteers.length !== assigneeIds.length)
      throw new NotFoundException('One or more volunteers not found.');
    const allowed = await this.getAssignableVolunteers(userId || '');
    const allowedIds = new Set(allowed.map((item) => item.id));
    if (!assigneeIds.every((id) => allowedIds.has(id)))
      throw new ForbiddenException(
        'You can only assign tasks to volunteers in your department scope.',
      );
    return volunteers;
  }

  /**
   * Keeps MatchOfficial (scorekeeper) rows in sync with a match-linked task's
   * assignee list — this is what actually grants a Sports Volunteer the ability
   * to score the specific match they were tasked with (see ScoringService.
   * verifyScoringAuthority). Volunteers without a linked user account yet
   * (haven't been granted any role/logged in) are returned in `pendingLink`
   * instead of failing the whole task write.
   */
  private async syncMatchOfficials(
    actingUserId: string,
    previousMatchId: string | null | undefined,
    previousVolunteerIds: string[],
    nextMatchId: string | null | undefined,
    nextVolunteerIds: string[],
  ): Promise<{ pendingLink: string[] }> {
    const pendingLink: string[] = [];
    const matchUnchanged = previousMatchId && previousMatchId === nextMatchId;

    const removedIds = matchUnchanged
      ? previousVolunteerIds.filter((id) => !nextVolunteerIds.includes(id))
      : previousMatchId
        ? previousVolunteerIds
        : [];
    if (previousMatchId && removedIds.length) {
      const removedVolunteers = await this.prisma.volunteer.findMany({
        where: { id: { in: removedIds } },
      });
      for (const volunteer of removedVolunteers) {
        if (!volunteer.userId) continue;
        await this.matchesService
          .removeOfficial(previousMatchId, volunteer.userId, actingUserId)
          .catch(() => undefined);
      }
    }

    const addedIds = matchUnchanged
      ? nextVolunteerIds.filter((id) => !previousVolunteerIds.includes(id))
      : nextVolunteerIds;
    if (nextMatchId && addedIds.length) {
      const addedVolunteers = await this.prisma.volunteer.findMany({
        where: { id: { in: addedIds } },
      });
      for (const volunteer of addedVolunteers) {
        if (!volunteer.userId) {
          pendingLink.push(volunteer.id);
          continue;
        }
        await this.matchesService.assignOfficial(
          nextMatchId,
          { userId: volunteer.userId, role: 'SCOREKEEPER' },
          actingUserId,
        );
      }
    }

    return { pendingLink };
  }

  async createTask(dto: CreateOperationsTaskDto, userId?: string) {
    if (!dto.title?.trim()) {
      throw new BadRequestException('Task title is required.');
    }
    const assigneeIds = [...new Set(dto.assigneeIds || [])];
    if (!dto.department?.trim() && !assigneeIds.length) {
      throw new BadRequestException(
        'Assign the task to a department or at least one volunteer.',
      );
    }

    let sportId: string | undefined;
    if (dto.matchId) {
      if (!userId)
        throw new ForbiddenException(
          'You are not authorized to link tasks to this match.',
        );
      const match = await this.assertMatchAuthority(userId, dto.matchId);
      sportId = match.tournament?.sportId;
    }

    const volunteers = await this.assertAssigneesAllowed(userId, assigneeIds);
    if (!dto.department && volunteers.length)
      dto.department = volunteers[0].department;

    if (dto.department && userId) {
      const access = await this.accessFor(userId);
      if (
        !access.global &&
        !departmentAllowed(dto.department, access.headDepartments)
      )
        throw new ForbiddenException(
          'You can only assign tasks within your department scope.',
        );
    }

    const task = await this.prisma.operationsTask.create({
      data: {
        title: dto.title.trim(),
        department: dto.department?.trim() || undefined,
        matchId: dto.matchId || undefined,
        sportId,
        priority: (dto.priority || 'STANDARD').toUpperCase(),
        status: 'STANDBY',
        assignedBy: userId,
        assignees: {
          create: assigneeIds.map((volunteerId) => ({ volunteerId })),
        },
      },
      include: TASK_INCLUDE,
    });

    let pendingLink: string[] = [];
    if (dto.matchId && assigneeIds.length && userId) {
      pendingLink = (
        await this.syncMatchOfficials(
          userId,
          null,
          [],
          dto.matchId,
          assigneeIds,
        )
      ).pendingLink;
    }

    for (const assignee of task.assignees) {
      void this.notificationsService.sendTaskAssignment({
        contactNumber: assignee.volunteer.contactNumber,
        volunteerName: assignee.volunteer.name,
        taskTitle: task.title,
        department: task.department,
      });
    }

    return {
      ...task,
      pendingOfficialLink: pendingLink.length ? pendingLink : undefined,
    };
  }

  async updateTask(id: string, dto: UpdateOperationsTaskDto, userId: string) {
    const current = await this.prisma.operationsTask.findUnique({
      where: { id },
      include: TASK_INCLUDE,
    });
    if (!current) {
      throw new NotFoundException(`Operations task "${id}" not found`);
    }
    const visible = await this.getTasks(userId, {});
    if (!visible.some((task) => task.id === id))
      throw new ForbiddenException(
        'This task is outside your department scope.',
      );

    const previousVolunteerIds = current.assignees.map((a) => a.volunteerId);
    const assigneesChanged = dto.assigneeIds !== undefined;
    const nextAssigneeIds = assigneesChanged
      ? [...new Set(dto.assigneeIds)]
      : previousVolunteerIds;
    if (assigneesChanged)
      await this.assertAssigneesAllowed(userId, nextAssigneeIds);

    const matchChanged =
      dto.matchId !== undefined && (dto.matchId || null) !== current.matchId;
    let nextSportId = current.sportId;
    if (matchChanged) {
      if (dto.matchId) {
        const match = await this.assertMatchAuthority(userId, dto.matchId);
        nextSportId = match.tournament?.sportId ?? null;
      } else {
        nextSportId = null;
      }
    }

    const updated = await this.prisma.operationsTask.update({
      where: { id },
      data: {
        title: dto.title !== undefined ? dto.title.trim() : current.title,
        department:
          dto.department !== undefined ? dto.department : current.department,
        matchId: matchChanged ? dto.matchId || null : undefined,
        sportId: matchChanged ? nextSportId : undefined,
        priority:
          dto.priority !== undefined
            ? dto.priority.toUpperCase()
            : current.priority,
        status:
          dto.status !== undefined ? dto.status.toUpperCase() : current.status,
        updatedAt: new Date(),
        ...(assigneesChanged
          ? {
              assignees: {
                deleteMany: { volunteerId: { notIn: nextAssigneeIds } },
                connectOrCreate: nextAssigneeIds.map((volunteerId) => ({
                  where: { taskId_volunteerId: { taskId: id, volunteerId } },
                  create: { volunteerId },
                })),
              },
            }
          : {}),
      },
      include: TASK_INCLUDE,
    });

    let pendingLink: string[] = [];
    if (matchChanged || assigneesChanged) {
      pendingLink = (
        await this.syncMatchOfficials(
          userId,
          current.matchId,
          previousVolunteerIds,
          updated.matchId,
          nextAssigneeIds,
        )
      ).pendingLink;
    }

    if (assigneesChanged) {
      const addedAssignees = updated.assignees.filter(
        (a) => !previousVolunteerIds.includes(a.volunteerId),
      );
      for (const assignee of addedAssignees) {
        void this.notificationsService.sendTaskAssignment({
          contactNumber: assignee.volunteer.contactNumber,
          volunteerName: assignee.volunteer.name,
          taskTitle: updated.title,
          department: updated.department,
        });
      }
    }

    return {
      ...updated,
      pendingOfficialLink: pendingLink.length ? pendingLink : undefined,
    };
  }
}
