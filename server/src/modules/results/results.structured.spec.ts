import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { ResultsService } from './results.service.js';

const match = (sport: string, extra: Record<string, unknown> = {}) => ({
  id: 'm1',
  tournamentId: 't1',
  teamAId: 'A',
  teamBId: 'B',
  matchNumber: 'Match 1',
  nextMatchId: null,
  scoringMode: 'RESULT_ONLY',
  status: 'SCHEDULED',
  scoreDetails: null,
  actualEndTime: null,
  result: null,
  officials: [],
  tournament: { sportId: 's1', eventId: 'e1', sport: { name: sport } },
  ...extra,
});

describe('ResultsService: sport-specific final results', () => {
  let prisma: any;
  let service: ResultsService;

  beforeEach(() => {
    prisma = {
      match: { findUnique: vi.fn(), update: vi.fn() },
      result: {
        findUnique: vi.fn(),
        upsert: vi.fn(async ({ create }: any) => ({ id: 'r1', ...create })),
        update: vi.fn(async ({ data }: any) => ({ id: 'r1', ...data })),
      },
      team: { findMany: vi.fn() },
      auditLog: { create: vi.fn() },
    };
    prisma.$queryRaw = vi.fn().mockResolvedValue([]);
    prisma.$transaction = vi.fn(async (work: any) => work(prisma));
    service = new ResultsService(prisma, {
      hasPermission: vi.fn().mockResolvedValue(true),
    } as any);
  });

  it('derives sets won and the winner from the set scores, ignoring client totals', async () => {
    prisma.match.findUnique.mockResolvedValue(match('Badminton (Women)'));
    await service.submitResult(
      'm1',
      {
        finalScoreA: 0,
        finalScoreB: 9 as never,
        scoreDetails: {
          kind: 'SETS',
          sets: [
            { a: 21, b: 10 },
            { a: 21, b: 12 },
          ],
        },
      },
      'u1',
    );
    expect(prisma.result.upsert.mock.calls[0][0].create).toMatchObject({
      finalScoreA: 2,
      finalScoreB: 0,
      winnerTeamId: 'A',
      scoreDetails: { kind: 'SETS', bestOf: 3 },
    });
    expect(prisma.match.update.mock.calls[0][0].data).toMatchObject({
      teamAScore: 2,
      teamBScore: 0,
      winnerTeamId: 'A',
      status: 'COMPLETED',
    });
  });

  it('rejects a results-only fixture submitted without its scorecard', async () => {
    prisma.match.findUnique.mockResolvedValue(match('Basketball (Men)'));
    await expect(
      service.submitResult('m1', { finalScoreA: 50, finalScoreB: 40 }, 'u1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects an invalid scorecard with an organiser-readable reason', async () => {
    prisma.match.findUnique.mockResolvedValue(match('Volleyball (Women)'));
    await expect(
      service.submitResult(
        'm1',
        {
          scoreDetails: {
            kind: 'SETS',
            sets: [
              { a: 25, b: 10 },
              { a: 25, b: 10 },
              { a: 25, b: 25 },
            ],
          },
        },
        'u1',
      ),
    ).rejects.toThrow(/cannot end level/);
  });

  it('stores half points for a chess team match', async () => {
    prisma.match.findUnique.mockResolvedValue(match('Chess (Women)'));
    await service.submitResult(
      'm1',
      {
        scoreDetails: {
          kind: 'CHESS',
          boards: [{ a: 1 }, { a: 0.5 }, { a: 0.5 }, { a: 0.5 }],
        },
      },
      'u1',
    );
    expect(prisma.result.upsert.mock.calls[0][0].create).toMatchObject({
      finalScoreA: 2.5,
      finalScoreB: 1.5,
      winnerTeamId: 'A',
    });
  });

  it('records a team-less athletics event for the registered athletics teams', async () => {
    prisma.match.findUnique.mockResolvedValue(
      match('Athletics', {
        teamAId: null,
        teamBId: null,
        matchNumber: '100m Final — Men',
      }),
    );
    prisma.team.findMany.mockResolvedValue([
      { id: 'cu', name: 'CU Athletics', institute: { shortName: 'CU' } },
      { id: 'miet', name: 'MIET Athletics', institute: { shortName: 'MIET' } },
    ]);
    await service.submitResult(
      'm1',
      {
        scoreDetails: {
          kind: 'TRACK',
          round: 'FINAL',
          sections: [
            {
              category: 'Men',
              entries: [
                { teamId: 'miet', rank: 2, mark: '10.91' },
                { teamId: 'cu', rank: 1, mark: '10.85' },
              ],
            },
          ],
        },
      },
      'u1',
    );
    const create = prisma.result.upsert.mock.calls[0][0].create;
    expect(create.winnerTeamId).toBe('cu');
    expect(create.scoreDetails.sections[0].entries[1]).toMatchObject({
      teamName: 'CU Athletics',
      shortName: 'CU',
    });
  });

  it('rejects an athletics entry from a team of another sport', async () => {
    prisma.match.findUnique.mockResolvedValue(
      match('Athletics', { teamAId: null, teamBId: null }),
    );
    prisma.team.findMany.mockResolvedValue([
      { id: 'cu', name: 'CU', institute: null },
    ]);
    await expect(
      service.submitResult(
        'm1',
        {
          scoreDetails: {
            kind: 'TRACK',
            sections: [
              {
                category: 'Men',
                entries: [{ teamId: 'football-team', rank: 1 }],
              },
            ],
          },
        },
        'u1',
      ),
    ).rejects.toThrow(/registered/);
  });

  it('publishes the scorecard onto the match so public pages can render it', async () => {
    const details = {
      kind: 'SETS',
      bestOf: 3,
      sets: [
        { a: 21, b: 10 },
        { a: 21, b: 12 },
      ],
    };
    prisma.result.findUnique.mockResolvedValue({
      id: 'r1',
      matchId: 'm1',
      status: 'SUBMITTED',
      finalScoreA: 2,
      finalScoreB: 0,
      winnerTeamId: 'A',
      scoreDetails: details,
      match: {
        nextMatchId: null,
        tournamentId: 't1',
        tournament: { sportId: 's1', eventId: 'e1' },
      },
    });
    await service.approveResult('r1', {}, 'approver');
    expect(prisma.match.update.mock.calls.at(-1)[0].data).toMatchObject({
      teamAScore: 2,
      winnerTeamId: 'A',
      scoreDetails: details,
    });
  });
});

describe('ResultsService.addLobbyTeam', () => {
  const setup = (existing: { name: string }[], allowed = true) => {
    const prisma: any = {
      sport: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ id: 's1', eventId: 'e1', name: 'E-Sports' }),
      },
      institute: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'i1',
          eventId: 'e1',
          name: 'Govt College',
          shortName: 'GCET',
        }),
      },
      team: {
        findMany: vi.fn().mockResolvedValue(existing),
        create: vi.fn(async ({ data }: any) => ({ id: 't-new', ...data })),
      },
      auditLog: { create: vi.fn() },
    };
    const service = new ResultsService(prisma, {
      hasPermission: vi.fn().mockResolvedValue(allowed),
    } as any);
    return { prisma, service };
  };
  const dto = { sportId: 's1', instituteId: 'i1', game: 'BGMI' };

  it('names a college’s first team plainly and later teams as numbered squads', async () => {
    const first = setup([]);
    await first.service.addLobbyTeam(dto, 'u1');
    expect(first.prisma.team.create.mock.calls[0][0].data.name).toBe(
      'GCET E-Sports (BGMI)',
    );
    const second = setup([{ name: 'GCET E-Sports (BGMI)' }]);
    await second.service.addLobbyTeam(dto, 'u1');
    expect(second.prisma.team.create.mock.calls[0][0].data.name).toBe(
      'GCET E-Sports (BGMI - Team 2)',
    );
    const named = setup([{ name: 'GCET E-Sports (BGMI)' }]);
    await named.service.addLobbyTeam({ ...dto, squad: 'Alpha' }, 'u1');
    expect(named.prisma.team.create.mock.calls[0][0].data.name).toBe(
      'GCET E-Sports (BGMI - Alpha)',
    );
  });

  it('refuses duplicates, non-E-Sports sports and unauthorised users', async () => {
    await expect(
      setup([{ name: 'GCET E-Sports (BGMI - Alpha)' }]).service.addLobbyTeam(
        { ...dto, squad: 'alpha' },
        'u1',
      ),
    ).rejects.toThrow(/already registered/);
    const wrong = setup([]);
    wrong.prisma.sport.findUnique.mockResolvedValue({
      id: 's1',
      eventId: 'e1',
      name: 'Football',
    });
    await expect(wrong.service.addLobbyTeam(dto, 'u1')).rejects.toThrow(
      /E-Sports/,
    );
    await expect(
      setup([], false).service.addLobbyTeam(dto, 'u1'),
    ).rejects.toThrow();
  });
});
