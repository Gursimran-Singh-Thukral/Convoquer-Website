import { describe, expect, it, vi } from 'vitest';
import { ParticipantsService } from './participants.service.js';
import { ResultsService } from '../results/results.service.js';

const participant = {
  id: 'p1',
  eventId: 'e1',
  instituteId: 'i1',
  institute: {
    name: 'Indian Institute of Technology Mandi',
    shortName: 'IIT Mandi',
  },
};

function svc(
  sport: { id: string; eventId: string; name: string } | null,
  existingTeam: unknown = null,
) {
  const prisma: any = {
    participant: { findUnique: vi.fn().mockResolvedValue(participant) },
    sport: { findUnique: vi.fn().mockResolvedValue(sport) },
    team: {
      findFirst: vi.fn().mockResolvedValue(existingTeam),
      create: vi.fn(async ({ data }: any) => ({ id: 't-new', ...data })),
    },
    teamMember: {
      upsert: vi.fn(),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    auditLog: { create: vi.fn() },
  };
  return { prisma, svc: new ParticipantsService(prisma) };
}

describe('ParticipantsService.assignSport', () => {
  it('adds the person to their college team for the sport, creating the team once', async () => {
    const { prisma, svc: s } = svc({
      id: 'ath',
      eventId: 'e1',
      name: 'Athletics',
    });
    const team = await s.assignSport('p1', 'ath', 'admin');
    expect(team.name).toBe('IIT Mandi Athletics');
    expect(prisma.team.create).toHaveBeenCalledTimes(1);
    expect(prisma.teamMember.upsert.mock.calls[0][0].create).toMatchObject({
      teamId: 't-new',
      participantId: 'p1',
    });
    const again = svc(
      { id: 'ath', eventId: 'e1', name: 'Athletics' },
      { id: 't-old', name: 'IIT Mandi Athletics' },
    );
    await again.svc.assignSport('p1', 'ath', 'admin');
    expect(again.prisma.team.create).not.toHaveBeenCalled();
  });

  it('refuses E-Sports (coordinators add those teams) and a sport of another event', async () => {
    await expect(
      svc({ id: 'es', eventId: 'e1', name: 'E-Sports' }).svc.assignSport(
        'p1',
        'es',
        'a',
      ),
    ).rejects.toThrow(/E-Sports coordinator/);
    await expect(
      svc({ id: 'x', eventId: 'other', name: 'Athletics' }).svc.assignSport(
        'p1',
        'x',
        'a',
      ),
    ).rejects.toThrow(/this event/);
  });

  it('removes a membership without deleting the person', async () => {
    const { prisma, svc: s } = svc(null);
    await s.removeFromTeam('p1', 't1', 'admin');
    expect(prisma.teamMember.deleteMany).toHaveBeenCalledWith({
      where: { participantId: 'p1', teamId: 't1' },
    });
  });
});

describe('ResultsService.addLobbyTeam for athletics', () => {
  const make = (existing: unknown[]) => {
    const prisma: any = {
      sport: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ id: 'ath', eventId: 'e1', name: 'Athletics' }),
      },
      institute: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'i1',
          eventId: 'e1',
          name: 'IIT Mandi',
          shortName: 'IIT Mandi',
        }),
      },
      team: {
        findMany: vi.fn().mockResolvedValue(existing),
        create: vi.fn(async ({ data }: any) => ({ id: 't', ...data })),
      },
      auditLog: { create: vi.fn() },
    };
    return {
      prisma,
      svc: new ResultsService(prisma, {
        hasPermission: vi.fn().mockResolvedValue(true),
      } as any),
    };
  };
  it('creates one plain "<college> Athletics" team per college', async () => {
    const { prisma, svc: s } = make([]);
    const team = await s.addLobbyTeam(
      { sportId: 'ath', instituteId: 'i1', game: 'Athletics' },
      'u1',
    );
    expect(team.name).toBe('IIT Mandi Athletics');
    expect(prisma.team.create).toHaveBeenCalledTimes(1);
    const dup = make([{ name: 'IIT Mandi Athletics' }]);
    await expect(
      dup.svc.addLobbyTeam(
        { sportId: 'ath', instituteId: 'i1', game: 'Athletics' },
        'u1',
      ),
    ).rejects.toThrow(/already registered/);
  });
});
