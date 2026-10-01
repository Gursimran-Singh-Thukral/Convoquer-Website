// Repairs sport-scoped roles (Sports Coordinator etc.) whose scope points at a
// sport that no longer exists. UserRole.sportId is a plain ID, so when the old
// unsplit "Badminton" / "Basketball" / "Chess" / "Table Tennis" / "Volleyball"
// sports were replaced by their "(Men)" and "(Women)" versions, the people
// scoped to the old ID lost access ("You are not authorized to perform
// result.submit for this sport/tournament").
//
// List who is affected (changes nothing):
//   npx tsx prisma/fix-sport-scopes.ts
// Re-scope one person onto the new sports (name as shown in the list):
//   npx tsx prisma/fix-sport-scopes.ts --user="Full Name" --sport=Badminton [--dry-run]
// "--sport=Badminton" grants both "Badminton (Men)" and "Badminton (Women)";
// for an unsplit sport (Cricket, Football…) it grants that sport alone.
import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const arg = (name: string) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const DRY = process.argv.includes('--dry-run');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  try {
    const sports = await prisma.sport.findMany();
    const live = new Set(sports.map((s) => s.id));
    const roles = await prisma.userRole.findMany({
      where: { sportId: { not: null } },
      include: { user: true, role: true },
    });
    const dangling = roles.filter((r) => r.sportId && !live.has(r.sportId));

    const user = arg('user');
    const base = arg('sport');
    if (!user || !base) {
      console.log(
        `${dangling.length} role(s) point at a sport that no longer exists:`,
      );
      for (const r of dangling)
        console.log(
          ` - ${r.user.name} | ${r.role.name} | old sport id ${r.sportId}`,
        );
      console.log(
        '\nFix one person: npx tsx prisma/fix-sport-scopes.ts --user="<name>" --sport=<Badminton|Basketball|Chess|"Table Tennis"|Volleyball|…>',
      );
      return;
    }

    const mine = dangling.filter(
      (r) => r.user.name.trim().toLowerCase() === user.trim().toLowerCase(),
    );
    if (!mine.length)
      throw new Error(
        `No broken sport-scoped role found for "${user}". Run without arguments to list them.`,
      );
    const targets = sports.filter(
      (s) =>
        s.name === base ||
        s.name === `${base} (Men)` ||
        s.name === `${base} (Women)`,
    );
    if (!targets.length) throw new Error(`No sport matches "${base}".`);

    await prisma.$transaction(async (tx) => {
      for (const old of mine)
        for (const sport of targets) {
          const exists = await tx.userRole.findFirst({
            where: {
              userId: old.userId,
              roleId: old.roleId,
              eventId: old.eventId,
              departmentId: old.departmentId,
              sportId: sport.id,
            },
          });
          if (!exists)
            await tx.userRole.create({
              data: {
                userId: old.userId,
                roleId: old.roleId,
                eventId: old.eventId,
                departmentId: old.departmentId,
                sportId: sport.id,
                assignedBy: old.assignedBy,
                expiresAt: old.expiresAt,
              },
            });
          console.log(`${old.user.name}: ${old.role.name} -> ${sport.name}`);
        }
      await tx.userRole.deleteMany({
        where: { id: { in: mine.map((m) => m.id) } },
      });
      if (DRY) throw new Error('DRY');
    });
    console.log('Done. The person must sign out and in again.');
  } catch (e) {
    if ((e as Error).message === 'DRY') console.log('--dry-run: rolled back.');
    else throw e;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}
main().catch((e) => {
  console.error('ERROR:', e.message ?? e);
  process.exitCode = 1;
});
