// TEST/DUMMY results — publishes plausible final-result scorecards for every
// fixture that already has both teams, so the per-sport standings pages
// (/standings, /standings/chess) can be checked end to end. Every result it
// writes carries notes = 'TEST-DATA'. LOCAL/DEV USE ONLY — never run on production.
//
//   npx tsx prisma/seed-test-results.ts           add results (fixtures with no result yet)
//   npx tsx prisma/seed-test-results.ts --wipe    remove them and reopen those fixtures
//
// Each scorecard goes through the same buildResult() the API uses, so it is
// validated exactly like a coordinator's entry.
import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { seedKnockouts } from '../src/modules/results/knockout-seeding.js';
import {
  buildResult,
  gamesConfigFor,
  resultKindFor,
} from '../src/modules/results/result-formats.js';

const TAG = 'TEST-DATA';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

// Deterministic pseudo-random so a run is repeatable.
let seed = 20261002;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const between = (lo: number, hi: number) =>
  lo + Math.floor(rnd() * (hi - lo + 1));

type Pair = { a: number; b: number };
/** A set won by `side` ('a'|'b') to `to` points, by 2. */
const set = (side: 'a' | 'b', to: number): Pair => {
  const lose = between(Math.max(0, to - 12), to - 3);
  return side === 'a' ? { a: to, b: lose } : { a: lose, b: to };
};
const other = (s: 'a' | 'b') => (s === 'a' ? 'b' : 'a');

function detailsFor(
  kind: string,
  sportName: string,
  win: 'a' | 'b',
  ctx: { games?: ReturnType<typeof gamesConfigFor> },
): Record<string, unknown> | null {
  const lose = other(win);
  switch (kind) {
    case 'SETS': {
      // Volleyball: best of 5, winner takes 3 (sometimes after losing a set).
      const sets = [set(win, 25), set(win, 25), set(win, 25)];
      if (rnd() < 0.4) sets.splice(1, 0, set(lose, 25));
      return { kind, bestOf: 5, sets };
    }
    case 'GAMES': {
      const cfg = ctx.games!;
      const need = (cfg.count + 1) / 2;
      const to = cfg.setTo ?? 21;
      const games: unknown[] = [];
      let w = 0;
      let l = 0;
      while (w < need) {
        // The favourite wins most games, but not always.
        const g = l < need - 1 && rnd() < 0.3 ? lose : win;
        const sets = Array.from(
          { length: ((cfg.setsPerGame ?? 3) + 1) / 2 },
          () => set(g, to),
        );
        if (g === win) w++;
        else l++;
        games.push({
          sets,
          setsA: g === 'a' ? sets.length : 0,
          setsB: g === 'b' ? sets.length : 0,
        });
      }
      return {
        kind,
        bestOf: cfg.count,
        playAll: cfg.playAll,
        unit: cfg.unit,
        games,
      };
    }
    case 'QUARTERS': {
      const periods = [0, 1, 2, 3].map(() => ({
        a: between(8, 22),
        b: between(8, 22),
      }));
      const sum = (s: 'a' | 'b') => periods.reduce((t, p) => t + p[s], 0);
      periods[3][win] += Math.max(0, sum(lose) - sum(win)) + between(1, 6);
      return { kind, periods, overtime: [] };
    }
    case 'CRICKET': {
      const first = rnd() < 0.5 ? 'A' : 'B';
      const winSide = win.toUpperCase();
      const runsFirst = between(120, 190);
      const chasingWins = winSide !== first;
      const runsSecond = chasingWins
        ? runsFirst + between(1, 8)
        : runsFirst - between(5, 40);
      const inn = (runs: number, out: boolean) => ({
        runs,
        wickets: out ? 10 : between(3, 8),
        overs: out ? '19.2' : '20',
      });
      const innings = {
        A:
          first === 'A' ? inn(runsFirst, false) : inn(runsSecond, !chasingWins),
        B:
          first === 'B' ? inn(runsFirst, false) : inn(runsSecond, !chasingWins),
      };
      return { kind, overs: 20, battingFirst: first, innings };
    }
    case 'FOOTBALL':
      return {
        kind,
        regulation:
          win === 'a' ? { a: between(1, 4), b: 0 } : { a: 0, b: between(1, 4) },
      };
    case 'CHESS': {
      // 4 boards; draws on one board sometimes, so a drawn tie is possible too.
      const boards = [0, 1, 2, 3].map((i) => {
        const r = rnd();
        if (i === 3 && r < 0.35) return { a: 0.5, b: 0.5 };
        const bw = r < 0.78 || i < 2 ? win : lose;
        return bw === 'a' ? { a: 1, b: 0 } : { a: 0, b: 1 };
      });
      return { kind, boards };
    }
    case 'SCORE':
      return win === 'a'
        ? { kind, a: 13, b: between(4, 11) }
        : { kind, a: between(4, 11), b: 13 };
    default:
      void sportName;
      return null;
  }
}

const PP: Record<string, number[]> = {
  'Free Fire': [12, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 0],
  BGMI: [15, 12, 10, 8, 6, 4, 2, 1, 0, 0, 0, 0],
};

/**
 * E-Sports fixtures have no teams until a coordinator adds them, so this adds
 * six test squads per game and fills the lobbies / Valorant fixtures.
 */
async function esports() {
  const sport = await prisma.sport.findFirst({ where: { name: 'E-Sports' } });
  if (!sport) return 0;
  const insts = await prisma.institute.findMany({
    where: { teams: { some: {} } },
    orderBy: { name: 'asc' },
    take: 6,
  });
  const fixtures = await prisma.match.findMany({
    where: { tournament: { sportId: sport.id }, result: null },
    orderBy: { scheduledStartTime: 'asc' },
  });
  let done = 0;
  for (const game of ['Free Fire', 'BGMI', 'Valorant']) {
    const squads = [];
    for (const [i, inst] of insts.entries()) {
      const name = `${inst.shortName || inst.name} E-Sports (${game} - Team ${i + 1})`;
      const found = await prisma.team.findFirst({
        where: { sportId: sport.id, instituteId: inst.id, name },
      });
      squads.push(
        found ??
          (await prisma.team.create({
            data: {
              eventId: inst.eventId,
              instituteId: inst.id,
              sportId: sport.id,
              name,
            },
          })),
      );
    }
    const mine = fixtures.filter((m) =>
      new RegExp(game, 'i').test(m.matchNumber ?? ''),
    );
    for (const m of mine) {
      const label = m.matchNumber;
      let built;
      let teamIds: { teamAId?: string; teamBId?: string } = {};
      if (game === 'Valorant') {
        const [a, b] = [squads[done % 6], squads[(done + 1 + (done % 5)) % 6]];
        if (a.id === b.id) continue;
        teamIds = { teamAId: a.id, teamBId: b.id };
        built = buildResult(
          'SCORE',
          rnd() < 0.5
            ? { kind: 'SCORE', a: 13, b: between(3, 11) }
            : { kind: 'SCORE', a: between(3, 11), b: 13 },
          {
            teamAId: a.id,
            teamBId: b.id,
            knockout: false,
            mustDecide: true,
            label,
          },
        );
      } else {
        const order = [...squads].sort(() => rnd() - 0.5);
        const entries = order.map((t, i) => {
          const kills = between(0, 9);
          return {
            teamId: t.id,
            rank: i + 1,
            kills,
            placementPoints: PP[game][i] ?? 0,
            killPoints: kills,
          };
        });
        built = buildResult(
          'LOBBY',
          { kind: 'LOBBY', game, entries },
          {
            teamAId: null,
            teamBId: null,
            knockout: false,
            label,
            fieldTeams: new Map(
              squads.map((t) => [t.id, { name: t.name, shortName: null }]),
            ),
          },
        );
      }
      const now = new Date();
      await prisma.result.create({
        data: {
          matchId: m.id,
          status: 'PUBLISHED',
          finalScoreA: built.finalScoreA,
          finalScoreB: built.finalScoreB,
          winnerTeamId: built.winnerTeamId,
          scoreDetails: built.scoreDetails as never,
          notes: TAG,
          submittedAt: now,
          approvedAt: now,
          publishedAt: now,
        },
      });
      await prisma.match.update({
        where: { id: m.id },
        data: {
          ...teamIds,
          status: 'COMPLETED',
          winnerTeamId: built.winnerTeamId,
          scoreDetails: built.scoreDetails as never,
        },
      });
      done++;
    }
  }
  console.log(`  E-Sports: ${done} result(s)`);
  return done;
}

async function wipe() {
  const done = await prisma.result.findMany({
    where: { notes: TAG },
    select: { matchId: true },
  });
  const ids = done.map((r) => r.matchId);
  await prisma.result.deleteMany({ where: { notes: TAG } });
  await prisma.match.updateMany({
    where: { id: { in: ids } },
    data: {
      status: 'SCHEDULED',
      teamAScore: null,
      teamBScore: null,
      winnerTeamId: null,
      scoreDetails: undefined,
    },
  });
  await prisma.$executeRaw`UPDATE "Match" SET "scoreDetails" = NULL WHERE id = ANY(${ids})`;
  // E-Sports fixtures were team-less; drop the test squads and their pairings.
  const sport = await prisma.sport.findFirst({ where: { name: 'E-Sports' } });
  if (sport) {
    await prisma.match.updateMany({
      where: { id: { in: ids }, tournament: { sportId: sport.id } },
      data: { teamAId: null, teamBId: null },
    });
    await prisma.team.deleteMany({ where: { sportId: sport.id } });
  }
  console.log(
    `Removed ${ids.length} test result(s); those fixtures are scheduled again.`,
  );
}

async function main() {
  if (/(convoquer\.in|187\.126\.112\.119)/.test(process.env.DATABASE_URL ?? ''))
    throw new Error('Refusing to write test data to a production database');
  if (process.argv.includes('--wipe')) return wipe();

  const matches = await prisma.match.findMany({
    where: { result: null, teamAId: { not: null }, teamBId: { not: null } },
    include: { tournament: { include: { sport: true } } },
    orderBy: { scheduledStartTime: 'asc' },
  });
  const perSport = new Map<string, number>();
  for (const m of matches) {
    const sportName = m.tournament?.sport?.name ?? '';
    const kind = resultKindFor(sportName, m.matchNumber);
    const win: 'a' | 'b' = rnd() < 0.5 ? 'a' : 'b';
    const games = gamesConfigFor(sportName, m.matchNumber) ?? undefined;
    const details = detailsFor(kind, sportName, win, { games });
    if (!details) continue;
    const built = buildResult(kind, details, {
      teamAId: m.teamAId,
      teamBId: m.teamBId,
      knockout: false,
      bestOf: /volleyball/i.test(sportName) ? 5 : 3,
      games,
      mustDecide: /valorant/i.test(m.matchNumber ?? ''),
      label: m.matchNumber,
    });
    const now = new Date();
    await prisma.result.create({
      data: {
        matchId: m.id,
        status: 'PUBLISHED',
        finalScoreA: built.finalScoreA,
        finalScoreB: built.finalScoreB,
        winnerTeamId: built.winnerTeamId,
        scoreDetails: built.scoreDetails as never,
        notes: TAG,
        submittedAt: now,
        approvedAt: now,
        publishedAt: now,
      },
    });
    await prisma.match.update({
      where: { id: m.id },
      data: {
        status: 'COMPLETED',
        teamAScore: built.finalScoreA,
        teamBScore: built.finalScoreB,
        winnerTeamId: built.winnerTeamId,
        scoreDetails: built.scoreDetails as never,
      },
    });
    perSport.set(sportName, (perSport.get(sportName) ?? 0) + 1);
  }
  for (const [s, n] of perSport) console.log(`  ${s}: ${n} result(s)`);
  const extra = await esports();
  // Move winners into their next round, as approving a result does.
  for (const t of await prisma.tournament.findMany())
    await seedKnockouts(prisma, t.id);
  console.log(
    `Published ${[...perSport.values()].reduce((a, b) => a + b, extra)} test result(s).`,
  );
}

main()
  .catch((e) => {
    console.error('ERROR:', e.message ?? e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
