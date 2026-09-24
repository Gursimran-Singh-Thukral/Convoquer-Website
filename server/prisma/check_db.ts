import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function check() {
  const event = await prisma.event.findFirst();
  const sports = await prisma.sport.findMany();
  const venues = await prisma.venue.findMany();
  const teams = await prisma.team.findMany();
  const tournaments = await prisma.tournament.findMany();
  const matches = await prisma.match.findMany();
  console.log({
    event: event?.name,
    sportsCount: sports.length,
    venuesCount: venues.length,
    teamsCount: teams.length,
    tournamentsCount: tournaments.length,
    matchesCount: matches.length,
  });
}

check().finally(async () => {
  await prisma.$disconnect();
  await pool.end();
});
