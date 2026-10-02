// Fills empty knockout slots ("Group A 1st vs Group B 2nd", "Winner Pool-A vs
// Runner-up Pool-B", "Rank-1 vs Rank-2", "Loser SF 1 vs Loser SF 2") from the
// published results, for every tournament. This now happens automatically when
// a result is approved; run this once to catch up on results approved before.
// It also moves published winners into their "Winner of ..." slots if that never happened.
// It only fills EMPTY slots and is safe to run repeatedly.
//
//   npx tsx prisma/seed-knockouts.ts
import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { seedKnockouts } from '../src/modules/results/knockout-seeding.js';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const ts = await prisma.tournament.findMany({ orderBy: { name: 'asc' } });
  let total = 0;
  for (const t of ts) {
    const n = await seedKnockouts(prisma, t.id);
    if (n) console.log(`  ${t.name}: filled ${n} slot(s)`);
    total += n;
  }
  console.log(
    total
      ? `Filled ${total} knockout slot(s).`
      : 'Nothing to fill (groups not finished, or already filled).',
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
