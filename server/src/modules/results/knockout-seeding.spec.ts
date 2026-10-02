import { describe, expect, it, vi } from 'vitest';
import { groupsOf, seedKnockouts, wants } from './knockout-seeding.js';

const at = (h: number) => new Date(Date.UTC(2026, 9, 1, h));
const fx = (
  id: string,
  label: string,
  hour: number,
  a: string | null,
  b: string | null,
  stage = 'Group Stage',
  winner: string | null | undefined = undefined,
) => ({
  id,
  matchNumber: label,
  stage: { name: stage },
  scheduledStartTime: at(hour),
  teamAId: a,
  teamBId: b,
  result:
    winner === undefined ? null : { status: 'PUBLISHED', winnerTeamId: winner },
});

describe('reading a knockout slot', () => {
  it('understands every printed form', () => {
    expect(wants('Semifinal 1: Group A 1st vs Group B 2nd')).toEqual([
      { kind: 'group', group: 'A', place: 1 },
      { kind: 'group', group: 'B', place: 2 },
    ]);
    expect(
      wants(
        'Semifinal 1 (Match 13): Winner Pool-A vs Runner-up Pool-B — Table 1',
      ),
    ).toEqual([
      { kind: 'group', group: 'A', place: 1 },
      { kind: 'group', group: 'B', place: 2 },
    ]);
    expect(wants('Match 4: Rank-1 vs Rank-2 (Final) — Table 1')).toEqual([
      { kind: 'rank', place: 1 },
      { kind: 'rank', place: 2 },
    ]);
    expect(wants('3rd Place Match: Loser SF 1 vs Loser SF 2')).toEqual([
      { kind: 'loser', semi: 1 },
      { kind: 'loser', semi: 2 },
    ]);
    // winners of a semi-final are wired by the bracket itself
    expect(wants('Championship Final: Winner SF 1 vs Winner SF 2')).toEqual([]);
  });
});

describe('groups without printed letters', () => {
  it('splits teams that played each other and letters them by first fixture', () => {
    const groups = groupsOf([
      fx('1', 'Match 1: MIET vs AMITY', 11, 'miet', 'amity'),
      fx('2', 'Match 2: IIMA vs GGMS', 11, 'iima', 'ggms'),
      fx('3', 'Match 3: SMVDU vs IITJ', 11, 'smvdu', 'iitj'),
      fx('4', 'Match 4: MIET vs GGMS', 12, 'miet', 'ggms'),
      fx('5', 'Match 5: IITJ vs AIIMS', 12, 'iitj', 'aiims'),
    ]);
    expect([...groups.keys()]).toEqual(['A', 'B']);
    expect([...groups.get('A')!].sort()).toEqual([
      'amity',
      'ggms',
      'iima',
      'miet',
    ]);
    expect([...groups.get('B')!].sort()).toEqual(['aiims', 'iitj', 'smvdu']);
  });
});

describe('seedKnockouts', () => {
  const team = (id: string) => ({
    id,
    name: id,
    instituteId: id,
    institute: { name: id, shortName: id },
  });
  // Group A: a1 beats a2 ; Group B: b1 beats b2.
  const build = (published: boolean) => {
    const rows = [
      fx(
        'g1',
        'Match 1: a1 vs a2',
        10,
        'a1',
        'a2',
        'Group Stage',
        published ? 'a1' : undefined,
      ),
      fx('g2', 'Match 2: b1 vs b2', 10, 'b1', 'b2', 'Group Stage', 'b1'),
      fx(
        's1',
        'Semifinal 1: Group A 1st vs Group B 2nd',
        15,
        null,
        null,
        'Semifinals',
      ),
      fx(
        's2',
        'Semifinal 2: Group B 1st vs Group A 2nd',
        15,
        null,
        null,
        'Semifinals',
      ),
      fx(
        'p3',
        '3rd Place Match: Loser SF 1 vs Loser SF 2',
        16,
        null,
        null,
        '3rd Place',
      ),
    ];
    const update = vi.fn();
    const full = (id: string, a: string, b: string, w: string) => ({
      id,
      teamAId: a,
      teamBId: b,
      teamA: team(a),
      teamB: team(b),
      result: {
        status: 'PUBLISHED',
        finalScoreA: 2,
        finalScoreB: 0,
        winnerTeamId: w,
        scoreDetails: {},
      },
      winnerTeamId: w,
    });
    const prisma: any = {
      match: {
        findMany: vi.fn(async (args: any) =>
          args.select
            ? rows
            : [full('g1', 'a1', 'a2', 'a1'), full('g2', 'b1', 'b2', 'b1')],
        ),
        update,
      },
      tournament: {
        findUnique: vi.fn().mockResolvedValue({
          id: 't',
          name: 'T',
          format: 'LEAGUE',
          sportId: 's',
          sport: { name: 'Badminton (Men)' },
          seeds: [],
        }),
      },
      tournamentStage: { findUnique: vi.fn() },
    };
    return { prisma, update };
  };

  it('waits until every group match is published', async () => {
    const { prisma, update } = build(false);
    expect(await seedKnockouts(prisma, 't')).toBe(0);
    expect(update).not.toHaveBeenCalled();
  });

  it('puts group winners and runners-up into the semi-finals', async () => {
    const { prisma, update } = build(true);
    expect(await seedKnockouts(prisma, 't')).toBe(4);
    expect(update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { teamAId: 'a1', teamBId: 'b2' },
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: 's2' },
      data: { teamAId: 'b1', teamBId: 'a2' },
    });
  });
});
