// One-off data migration for a database that was set up before Badminton,
// Basketball, Chess, Table Tennis and Volleyball were split into "(Men)" and
// "(Women)" sports: each of those sports then had ONE mixed-gender team per
// college. The fixtures need separate men's and women's teams.
//
// What it does, per college team in an old unsplit sport:
//   - reads each member's recorded gender (MALE / FEMALE, also M/F, Men/Women,
//     Boys/Girls), finds-or-creates "<College> <Sport> (Men|Women)" in the
//     split sport, and MOVES the membership there (role and jersey kept);
//   - leaves anyone with no recognisable gender where they are and lists them;
//   - then removes old teams left empty, and an old sport left with no teams.
// Participants themselves (passes, check-ins, contact data) are never touched.
//
// Run BEFORE prisma/import-fixtures.ts so the fixtures reuse these teams.
//   npx tsx prisma/split-gendered-sports.ts --dry-run   (rolled back)
//   npx tsx prisma/split-gendered-sports.ts
import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@prisma/client';

export const SPLIT_SPORTS = [
  'Badminton',
  'Basketball',
  'Chess',
  'Table Tennis',
  'Volleyball',
];

export function genderSuffix(raw: string | null | undefined) {
  const g = (raw ?? '').trim().toUpperCase();
  if (['FEMALE', 'F', 'WOMEN', 'WOMAN', 'GIRL', 'GIRLS'].includes(g))
    return 'Women';
  if (['MALE', 'M', 'MEN', 'MAN', 'BOY', 'BOYS'].includes(g)) return 'Men';
  return null;
}

export interface SplitReport {
  moved: Record<string, { men: number; women: number }>;
  teamsCreated: string[];
  unresolved: { sport: string; team: string; participant: string }[];
  teamsRemoved: string[];
  sportsRemoved: string[];
}

export async function splitGenderedSports(
  tx: Prisma.TransactionClient,
  eventId: string,
): Promise<SplitReport> {
  const report: SplitReport = {
    moved: {},
    teamsCreated: [],
    unresolved: [],
    teamsRemoved: [],
    sportsRemoved: [],
  };
  for (const base of SPLIT_SPORTS) {
    const old = await tx.sport.findFirst({ where: { eventId, name: base } });
    if (!old) continue;
    const targets = {
      Men: await tx.sport.findFirst({
        where: { eventId, name: `${base} (Men)` },
      }),
      Women: await tx.sport.findFirst({
        where: { eventId, name: `${base} (Women)` },
      }),
    };
    if (!targets.Men || !targets.Women)
      throw new Error(
        `"${base} (Men)" / "${base} (Women)" missing — run prisma/seed.ts first`,
      );
    report.moved[base] = { men: 0, women: 0 };

    const oldTeams = await tx.team.findMany({
      where: { sportId: old.id },
      include: {
        institute: true,
        members: { include: { participant: true } },
      },
    });
    for (const team of oldTeams) {
      const college = team.institute.shortName || team.institute.name;
      for (const m of team.members) {
        const side = genderSuffix(m.participant.gender);
        if (!side) {
          report.unresolved.push({
            sport: base,
            team: team.name,
            participant: m.participant.name,
          });
          continue;
        }
        const sport = targets[side]!;
        const name = `${college} ${sport.name}`;
        let dest = await tx.team.findFirst({
          where: {
            eventId,
            instituteId: team.instituteId,
            sportId: sport.id,
            name,
          },
        });
        if (!dest) {
          dest = await tx.team.create({
            data: {
              eventId,
              instituteId: team.instituteId,
              sportId: sport.id,
              name,
            },
          });
          report.teamsCreated.push(name);
        }
        await tx.teamMember.upsert({
          where: {
            teamId_participantId: {
              teamId: dest.id,
              participantId: m.participantId,
            },
          },
          update: {},
          create: {
            teamId: dest.id,
            participantId: m.participantId,
            role: m.role,
            jerseyNumber: m.jerseyNumber,
          },
        });
        await tx.teamMember.delete({ where: { id: m.id } });
        report.moved[base][side === 'Men' ? 'men' : 'women']++;
      }
    }
    // Remove old teams that are now empty (and unused by any fixture).
    for (const team of oldTeams) {
      const left = await tx.teamMember.count({ where: { teamId: team.id } });
      const used = await tx.match.count({
        where: { OR: [{ teamAId: team.id }, { teamBId: team.id }] },
      });
      if (!left && !used) {
        await tx.team.delete({ where: { id: team.id } });
        report.teamsRemoved.push(team.name);
      }
    }
    const remaining = await tx.team.count({ where: { sportId: old.id } });
    const tournaments = await tx.tournament.count({
      where: { sportId: old.id },
    });
    if (!remaining && !tournaments) {
      await tx.sport.delete({ where: { id: old.id } });
      report.sportsRemoved.push(base);
    }
  }
  return report;
}

class DryRunRollback extends Error {}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const dry = process.argv.includes('--dry-run');
  try {
    const event = await prisma.event.findUnique({
      where: { slug: 'convoquer-26' },
    });
    if (!event) throw new Error("Event 'convoquer-26' not found");
    try {
      await prisma.$transaction(
        async (tx) => {
          const report = await splitGenderedSports(tx, event.id);
          console.log(dry ? '--dry-run: rolled back.' : 'Committed.');
          console.log(JSON.stringify(report, null, 2));
          if (dry) throw new DryRunRollback();
        },
        { timeout: 120_000 },
      );
    } catch (e) {
      if (!(e instanceof DryRunRollback)) throw e;
    }
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

// Only run when executed directly (so tests can import the function).
if (process.argv[1]?.includes('split-gendered-sports')) {
  main().catch((e) => {
    console.error('ERROR:', e);
    process.exitCode = 1;
  });
}
