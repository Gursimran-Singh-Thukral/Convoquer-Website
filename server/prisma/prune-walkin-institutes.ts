// Walk-in visitors used to be able to TYPE their college, and every new spelling
// created an Institute record — which inflated "participating institutes".
// This finds institutes that are not participating (no team — only the institutes
// that came in with the imported fixtures have teams) and, only with --apply,
// deletes them. Their walk-in
// visitors are kept; they simply lose the college link (their pass stays valid).
//
// PREVIEW BY DEFAULT — nothing is deleted without --apply:
//   npx tsx prisma/prune-walkin-institutes.ts
//   npx tsx prisma/prune-walkin-institutes.ts --apply
import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const APPLY = process.argv.includes('--apply');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  try {
    const all = await prisma.institute.findMany({
      include: {
        _count: { select: { teams: true, participants: true, medals: true } },
      },
      orderBy: { name: 'asc' },
    });
    const stray = all.filter(
      (i) => i._count.teams === 0 && i._count.medals === 0,
    );
    console.log(
      `${all.length} institutes: ${all.length - stray.length} participating, ${stray.length} stray.`,
    );
    for (const i of stray)
      console.log(
        `  stray  ${i.name}  (${i._count.participants} person(s) linked)`,
      );
    if (!APPLY) {
      console.log(
        '\nPreview only. Run again with --apply to delete the stray ones.',
      );
      return;
    }
    const res = await prisma.institute.deleteMany({
      where: { id: { in: stray.map((i) => i.id) } },
    });
    console.log(
      `\nDeleted ${res.count} stray institute(s). People and passes were kept.`,
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
