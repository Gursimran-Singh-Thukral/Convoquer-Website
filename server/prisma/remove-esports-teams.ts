// Removes the pre-defined E-Sports teams (the ones created by the roster and
// fixture imports) so that coordinators add every E-Sports team themselves with
// "+ Add team" on the result form.
//
// SAFE BY DEFAULT: it only lists what it would do. Nothing is deleted without --apply.
//   npx tsx prisma/remove-esports-teams.ts            (preview)
//   npx tsx prisma/remove-esports-teams.ts --apply    (delete)
//
// What is removed: E-Sports teams that no match refers to, together with their
// team memberships. Participants (and their passes) are never deleted — they
// simply stop belonging to a pre-made E-Sports team. A team that appears in a
// match is kept and reported, so no result is ever orphaned.
import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const APPLY = process.argv.includes('--apply');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  try {
    const sports = await prisma.sport.findMany({
      where: { name: { in: ['E-Sports', 'Esports', 'E Sports'] } },
    });
    if (!sports.length) {
      console.log('No E-Sports sport found — nothing to do.');
      return;
    }
    const teams = await prisma.team.findMany({
      where: { sportId: { in: sports.map((s) => s.id) } },
      include: {
        _count: {
          select: { members: true, matchesAsTeamA: true, matchesAsTeamB: true },
        },
      },
      orderBy: { name: 'asc' },
    });
    const keep = teams.filter(
      (t) => t._count.matchesAsTeamA + t._count.matchesAsTeamB > 0,
    );
    const drop = teams.filter((t) => !keep.includes(t));
    console.log(
      `${teams.length} E-Sports team(s): ${drop.length} removable, ${keep.length} kept (used in a match).`,
    );
    for (const t of drop)
      console.log(`  remove  ${t.name}  (${t._count.members} member link(s))`);
    for (const t of keep) console.log(`  KEEP    ${t.name}  (used in a match)`);
    const links = drop.reduce((n, t) => n + t._count.members, 0);
    if (!APPLY) {
      console.log(
        `\nPreview only. ${links} team membership(s) would be removed; participants are untouched.`,
      );
      console.log('Run again with --apply to delete.');
      return;
    }
    const res = await prisma.team.deleteMany({
      where: { id: { in: drop.map((t) => t.id) } },
    });
    console.log(
      `\nDeleted ${res.count} team(s) and ${links} membership link(s). Participants were not touched.`,
    );
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}
main().catch((e) => {
  console.error('ERROR:', e.message ?? e);
  process.exitCode = 1;
});
