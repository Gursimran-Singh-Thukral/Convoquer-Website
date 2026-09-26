// One-off import of the real Convoquer'26 organizing team (from
// reports/Hard Coded Data/Organizing Team.xlsx) as Volunteer records.
//
// Role assignment needs a User row, which only exists once someone signs in
// with Google — so this writes each person's intended role/department/sport
// scope onto pendingRoleName/pendingSportIds instead of a live UserRole.
// RbacService.linkPendingVolunteerRole (called from GoogleStrategy.validate)
// grants it automatically the moment they first log in with a matching
// @iitjammu.ac.in email.
//
// Run with: npx tsx prisma/import-organizing-team.ts
import 'dotenv/config';
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface OrgRecord {
  name: string;
  studentId: string | null;
  position: string;
  email: string;
  phone: string | null;
}

interface PositionRule {
  role: string;
  department: string;
  /** Matches every Sport whose name starts with this (covers the Men's/Women's split). */
  sportKeyword?: string;
}

const POSITION_MAP: Record<string, PositionRule> = {
  Convener: { role: 'CONVENER', department: 'General Operations' },
  'Co-convener': { role: 'CO_CONVENER', department: 'General Operations' },
  'Overall Sports coordination - Head': {
    role: 'OVERALL_SPORTS_COORDINATOR',
    department: 'Sports',
  },
  'Overall Sports coordination - Volunteer': {
    role: 'VOLUNTEER',
    department: 'Sports',
  },
  'Sponsorship - Head': { role: 'SPONSORSHIP_HEAD', department: 'Sponsorship' },
  'Sponsorship - Volunteer': { role: 'VOLUNTEER', department: 'Sponsorship' },
  'Event Management - Head': {
    role: 'EVENT_MANAGEMENT_HEAD',
    department: 'Event Management',
  },
  'Event Management - Volunteer': {
    role: 'VOLUNTEER',
    department: 'Event Management',
  },
  'Event Management': { role: 'VOLUNTEER', department: 'Event Management' },
  'Media - Head': { role: 'MEDIA_HEAD', department: 'Media' },
  Media: { role: 'VOLUNTEER', department: 'Media' },
  'Hospitality & Security Head': {
    role: 'HOSPITALITY_SECURITY_HEAD',
    department: 'Hospitality & Security',
  },
  'Hospitality & Security Volunteer': {
    role: 'VOLUNTEER',
    department: 'Hospitality & Security',
  },
  'Web Development Head': { role: 'WEB_DEV_HEAD', department: 'Web' },
  'Web Development Volunteer': { role: 'VOLUNTEER', department: 'Web' },
  'Design - Head': { role: 'DESIGN_HEAD', department: 'Design' },
  Design: { role: 'VOLUNTEER', department: 'Design' },
  'Coordinator - Volleyball': {
    role: 'SPORTS_COORDINATOR',
    department: 'Sports',
    sportKeyword: 'Volleyball',
  },
  'Coordinator - Basketball': {
    role: 'SPORTS_COORDINATOR',
    department: 'Sports',
    sportKeyword: 'Basketball',
  },
  'Coordinator - Chess': {
    role: 'SPORTS_COORDINATOR',
    department: 'Sports',
    sportKeyword: 'Chess',
  },
  'Coordinator - Football': {
    role: 'SPORTS_COORDINATOR',
    department: 'Sports',
    sportKeyword: 'Football',
  },
  'Coordinator - Table Tennis': {
    role: 'SPORTS_COORDINATOR',
    department: 'Sports',
    sportKeyword: 'Table Tennis',
  },
  'Coordinator - E-Sports': {
    role: 'SPORTS_COORDINATOR',
    department: 'Sports',
    sportKeyword: 'E-Sports',
  },
  'Coordinator - Badminton': {
    role: 'SPORTS_COORDINATOR',
    department: 'Sports',
    sportKeyword: 'Badminton',
  },
  'Coordinator - Cricket': {
    role: 'SPORTS_COORDINATOR',
    department: 'Sports',
    sportKeyword: 'Cricket',
  },
  'Coordinator - Weightlifting': {
    role: 'SPORTS_COORDINATOR',
    department: 'Sports',
    sportKeyword: 'Weight Lifting',
  },
  'Coordinator - Athletics': {
    role: 'SPORTS_COORDINATOR',
    department: 'Sports',
    sportKeyword: 'Athletics',
  },
};

async function main() {
  const records: OrgRecord[] = JSON.parse(
    readFileSync(path.join(__dirname, 'org-team-data.json'), 'utf-8'),
  );

  const sports = await prisma.sport.findMany({
    select: { id: true, name: true },
  });

  let created = 0;
  let updated = 0;
  let skippedUnmapped = 0;

  for (const record of records) {
    const rule = POSITION_MAP[record.position];
    if (!rule) {
      console.warn(
        `No role mapping for position "${record.position}" (${record.name}) — skipped.`,
      );
      skippedUnmapped++;
      continue;
    }

    const sportIds = rule.sportKeyword
      ? sports
          .filter((s) => s.name.startsWith(rule.sportKeyword!))
          .map((s) => s.id)
      : [];
    if (rule.sportKeyword && sportIds.length === 0) {
      console.warn(
        `No Sport matched keyword "${rule.sportKeyword}" for ${record.name} (${record.position}) — pending role saved without a sport scope.`,
      );
    }

    const existing = await prisma.volunteer.findFirst({
      where: { email: { equals: record.email, mode: 'insensitive' } },
    });

    const data = {
      name: record.name,
      email: record.email,
      contactNumber: record.phone,
      department: rule.department,
      pendingRoleName: rule.role,
      pendingSportIds: sportIds,
    };

    if (existing) {
      if (existing.userId) {
        // Already linked to a live login — never overwrite a real account's
        // role/department out from under it via a bulk re-import.
        continue;
      }
      await prisma.volunteer.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      await prisma.volunteer.create({
        data: {
          ...data,
          volunteerCode: `VOL-${randomUUID()}`,
          shift: 'MORNING',
          status: 'ACTIVE',
        },
      });
      created++;
    }
  }

  console.log(
    `Organizing team import complete: ${created} created, ${updated} updated, ${skippedUnmapped} skipped (no role mapping).`,
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
