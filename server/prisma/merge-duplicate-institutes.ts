// One-off clean-up for a database whose roster was imported before the college
// alias table existed: colleges were created under long descriptive names
// ("Model Institute of Engineering and Technology (MIET)") and seeding later
// added the canonical short-named ones ("MIET") beside them.
//
// For each known alias this MERGES the long-named college into the canonical
// one: its teams and participants are re-pointed at the canonical college, any
// contact details it had (city, state, logo) are kept if the canonical one is
// blank, teams named after the old college are renamed to the canonical short
// name ("<Old name> Cricket" → "MIET Cricket"), and the empty duplicate is
// deleted. Nothing is deleted that still has teams, participants or medals.
//
//   npx tsx prisma/merge-duplicate-institutes.ts --dry-run   (rolled back)
//   npx tsx prisma/merge-duplicate-institutes.ts
import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@prisma/client';

/** Same aliases as prisma/import-convoquer-teams.ts: old name → canonical Institute.name. */
export const COLLEGE_ALIASES: Record<string, string> = {
  'Baba Ghulam Shah Badshah University, Rajouri':
    'Baba Ghulam Shah Badshah University',
  'Model Institute of Engineering and Technology (MIET)': 'MIET',
  'Acharya Shiri Chander College of Medical Sciences and Hospital (ASCOMS)':
    'ASCOMS',
  'Amity University Punjab': 'Amity University, Punjab',
  'Government College of Engineering and Technology': 'GCET',
};

export interface MergeReport {
  merged: {
    from: string;
    into: string;
    teams: number;
    participants: number;
    teamsRenamed: string[];
  }[];
  /** Colleges that match no canonical college or known alias — review by hand. */
  unrecognised: string[];
  /** Teams still named after the full college name, shortened ("Central University of Jammu Football" → "CU Football"). */
  teamsShortened: string[];
}

/** Case- and punctuation-insensitive key: "GMC, Jammu" and "gmc jammu" match. */
const norm = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

// Known misspellings seen in the production roster.
const EXTRA_VARIANTS: Record<string, string> = {
  'Baba Ghulam Shah Badsha University': 'Baba Ghulam Shah Badshah University',
  // An earlier seed named this college "IIT Jammu" (and gave it a short name);
  // the current seed calls it "Indian Institute of Technology Jammu".
  'IIT Jammu': 'Indian Institute of Technology Jammu',
};

export async function mergeDuplicateInstitutes(
  tx: Prisma.TransactionClient,
  eventId: string,
): Promise<MergeReport> {
  const report: MergeReport = {
    merged: [],
    unrecognised: [],
    teamsShortened: [],
  };
  const all = await tx.institute.findMany({ where: { eventId } });
  // Canonical colleges are the ones seed.ts created — they carry a short name.
  const canonical = all.filter((i) => i.shortName);
  const byKey = new Map<string, (typeof all)[number]>();
  for (const c of canonical) {
    byKey.set(norm(c.name), c);
    byKey.set(norm(c.shortName!), c);
  }
  for (const [alias, canonName] of [
    ...Object.entries(COLLEGE_ALIASES),
    ...Object.entries(EXTRA_VARIANTS),
  ]) {
    const target = canonical.find((c) => c.name === canonName);
    if (target) byKey.set(norm(alias), target);
  }

  // Duplicates are colleges without a short name, plus any named in the alias
  // tables even though they have one (the old "IIT Jammu").
  const listed = new Set([
    ...Object.keys(COLLEGE_ALIASES),
    ...Object.keys(EXTRA_VARIANTS),
  ]);
  for (const old of all.filter((i) => !i.shortName || listed.has(i.name))) {
    const canon = byKey.get(norm(old.name));
    if (!canon || canon.id === old.id) {
      report.unrecognised.push(old.name);
      continue;
    }
    const oldDisplay = old.name;
    const canonDisplay = canon.shortName || canon.name;
    const teams = await tx.team.findMany({ where: { instituteId: old.id } });
    const renamed: string[] = [];
    for (const t of teams) {
      const name = t.name.startsWith(`${oldDisplay} `)
        ? `${canonDisplay} ${t.name.slice(oldDisplay.length + 1)}`
        : t.name;
      if (name !== t.name) renamed.push(`${t.name} → ${name}`);
      await tx.team.update({
        where: { id: t.id },
        data: { instituteId: canon.id, name },
      });
    }
    const moved = await tx.participant.updateMany({
      where: { instituteId: old.id },
      data: { instituteId: canon.id },
    });
    await tx.medal.updateMany({
      where: { instituteId: old.id },
      data: { instituteId: canon.id },
    });
    // Keep contact details the old record had, where the canonical one is blank.
    const fresh = await tx.institute.findUniqueOrThrow({
      where: { id: canon.id },
    });
    await tx.institute.update({
      where: { id: canon.id },
      data: {
        city: fresh.city ?? old.city,
        state: fresh.state ?? old.state,
        logoUrl: fresh.logoUrl ?? old.logoUrl,
      },
    });
    await tx.institute.delete({ where: { id: old.id } });
    report.merged.push({
      from: old.name,
      into: canon.name,
      teams: teams.length,
      participants: moved.count,
      teamsRenamed: renamed,
    });
  }
  // Team names follow "<college short name> <sport>" everywhere else (roster
  // and fixture imports look teams up by that exact name), so shorten any team
  // that was named after the college's full name.
  const teams = await tx.team.findMany({
    where: { eventId },
    include: { institute: true },
  });
  for (const t of teams) {
    const { name: full, shortName } = t.institute;
    if (!shortName || shortName === full || !t.name.startsWith(`${full} `))
      continue;
    const name = `${shortName} ${t.name.slice(full.length + 1)}`;
    await tx.team.update({ where: { id: t.id }, data: { name } });
    report.teamsShortened.push(`${t.name} → ${name}`);
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
          const report = await mergeDuplicateInstitutes(tx, event.id);
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

if (process.argv[1]?.includes('merge-duplicate-institutes')) {
  main().catch((e) => {
    console.error('ERROR:', e);
    process.exitCode = 1;
  });
}
