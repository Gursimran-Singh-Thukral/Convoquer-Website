import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

// Wipes all event/organizer/participant data for a clean slate, while
// keeping the Role/Permission/RolePermission scaffolding — there is no
// self-service way to recreate those from the UI, and every permission
// check in the app depends on them existing.
async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.log(
    'Flushing all event/organizer/participant data (keeping Role/Permission scaffolding)...',
  );

  // Children first, respecting foreign keys.
  await prisma.medal.deleteMany();
  await prisma.result.deleteMany();
  await prisma.scoreEvent.deleteMany();
  await prisma.matchOfficial.deleteMany();
  await prisma.match.deleteMany();
  await prisma.tournamentStage.deleteMany();
  await prisma.tournamentTeamSeed.deleteMany();
  await prisma.tournament.deleteMany();
  await prisma.teamMember.deleteMany();
  await prisma.participant.deleteMany();
  await prisma.team.deleteMany();
  await prisma.institute.deleteMany();
  await prisma.venue.deleteMany();
  await prisma.sport.deleteMany();
  await prisma.event.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.session.deleteMany();
  await prisma.userRole.deleteMany();
  await prisma.user.deleteMany();

  console.log(
    'Flush complete. Roles and permissions are untouched — sign in again to re-grant yourself a role.',
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
