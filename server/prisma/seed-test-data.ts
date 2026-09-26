// TEST/DUMMY data only — teams + participants for checking the Tournament
// Builder, Matches, and roster UIs end to end. NOT part of the real "final
// entries" dataset (prisma/seed.ts). Everything this script creates is
// tagged so it's trivial to find and wipe before real registrations land:
//   - Every participant's name starts with "TEST "
//   - Every gate pass number starts with "TEST-"
//   - Every roll number starts with "TEST-"
// To remove it all: delete Participants whose gatePassNumber starts with
// 'TEST-' (TeamMembers cascade), then delete Teams whose name ends with
// ' [TEST]'.
//
// Run with: npx tsx prisma/seed-test-data.ts
import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { encryptField, blindIndex } from '../src/common/crypto/field-crypto.js';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Real institute short names (from the confirmed participation sheet, see
// prisma/seed.ts) per sport — the same fields Convoquer'26 will actually run,
// so this test data exercises the real bracket shapes (byes, groups, round
// robin) instead of arbitrary numbers.
const SPORT_TEAMS: Record<string, string[]> = {
  'Badminton (Men)': [
    'MIET',
    'IIMJ',
    'SMVDU',
    'ASCOMS',
    'CU',
    'GGMS',
    'LPU',
    'IIMA',
    'AMITY',
    'AIIMS',
    'CSU',
    'IIT Jammu',
  ],
  'Badminton (Women)': [
    'MIET',
    'IIMJ',
    'SMVDU',
    'ASCOMS',
    'CU',
    'GGMS',
    'LPU',
    'AIIMS',
    'IIT Jammu',
  ],
  'Basketball (Men)': [
    'MIET',
    'IIMJ',
    'SMVDU',
    'CU',
    'BDC',
    'IIMA',
    'BGSBU',
    'SKUAST',
    'IIT Jammu',
  ],
  'Basketball (Women)': ['MIET', 'IIMJ', 'SMVDU', 'CU', 'IIT Jammu'],
  Cricket: [
    'MIET',
    'IIMJ',
    'SMVDU',
    'CU',
    'GMC',
    'LPU',
    'IIMA',
    'AMITY',
    'AIIMS',
    'CSU',
    'IIT Jammu',
  ],
  Football: [
    'MIET',
    'IIMJ',
    'SMVDU',
    'ASCOMS',
    'CU',
    'GMC',
    'GCET',
    'IIMA',
    'AMITY',
    'BGSBU',
    'AIIMS',
    'IIT Jammu',
  ],
  'Table Tennis (Men)': [
    'MIET',
    'IIMJ',
    'SMVDU',
    'CU',
    'GMC',
    'GCET',
    'IIMA',
    'AIIMS',
    'IIT Jammu',
  ],
  'Table Tennis (Women)': ['IIMJ', 'SMVDU', 'CU', 'IIT Jammu'],
  'Volleyball (Men)': [
    'MIET',
    'IIMJ',
    'SMVDU',
    'CU',
    'GMC',
    'IIMA',
    'AMITY',
    'BGSBU',
    'CSU',
    'IIT Jammu',
  ],
  'Volleyball (Women)': ['IIMJ', 'SMVDU', 'CU', 'IIT Jammu'],
  'Chess (Men)': ['MIET', 'IIMJ', 'CU', 'IIMA', 'IIT Jammu'],
  'Chess (Women)': ['IIMJ', 'CU', 'IIMA', 'IIT Jammu'],
};

const PLAYERS_PER_TEAM = 5;

async function main() {
  const event = await prisma.event.findFirst({
    where: { slug: 'convoquer-26' },
  });
  if (!event) {
    throw new Error("No Convoquer'26 event found — run prisma/seed.ts first.");
  }

  const institutes = await prisma.institute.findMany({
    where: { eventId: event.id },
  });
  const instituteByShortName = new Map(institutes.map((i) => [i.shortName, i]));

  let gatePassCounter = 1;
  let teamsCreated = 0;
  let teamsSkipped = 0;
  let participantsCreated = 0;

  for (const [sportName, shortNames] of Object.entries(SPORT_TEAMS)) {
    const sport = await prisma.sport.findFirst({
      where: { eventId: event.id, name: sportName },
    });
    if (!sport) {
      console.warn(`Sport "${sportName}" not found — skipped.`);
      continue;
    }

    for (const shortName of shortNames) {
      const institute = instituteByShortName.get(shortName);
      if (!institute) {
        console.warn(`Institute shortName "${shortName}" not found — skipped.`);
        continue;
      }

      const teamName = `${institute.shortName} ${sport.name} [TEST]`;
      let team = await prisma.team.findFirst({
        where: {
          eventId: event.id,
          sportId: sport.id,
          instituteId: institute.id,
        },
      });
      if (team) {
        teamsSkipped++;
      } else {
        team = await prisma.team.create({
          data: {
            eventId: event.id,
            sportId: sport.id,
            instituteId: institute.id,
            name: teamName,
          },
        });
        teamsCreated++;
      }

      const existingMembers = await prisma.teamMember.count({
        where: { teamId: team.id },
      });
      if (existingMembers > 0) continue;

      for (let i = 1; i <= PLAYERS_PER_TEAM; i++) {
        const rollNumber = `TEST-${sport.id.slice(0, 4)}-${institute.shortName}-${i}`;
        const gatePassNumber = `TEST-${String(gatePassCounter++).padStart(5, '0')}`;
        const participant = await prisma.participant.create({
          data: {
            eventId: event.id,
            instituteId: institute.id,
            name: `TEST ${institute.shortName} Player ${i}`,
            rollNumber: encryptField(rollNumber),
            rollNumberHash: blindIndex(rollNumber),
            gender: i % 2 === 0 ? 'FEMALE' : 'MALE',
            category: 'ATHLETE',
            gatePassNumber,
          },
        });
        await prisma.teamMember.create({
          data: {
            teamId: team.id,
            participantId: participant.id,
            role: i === 1 ? 'CAPTAIN' : 'PLAYER',
          },
        });
        participantsCreated++;
      }
    }
  }

  console.log(
    `Test data seeded: ${teamsCreated} teams created (${teamsSkipped} already existed), ${participantsCreated} participants created.`,
  );
  console.log(
    "To remove later: delete Participants where gatePassNumber starts with 'TEST-' (cascades to TeamMembers), then Teams whose name ends with ' [TEST]'.",
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
