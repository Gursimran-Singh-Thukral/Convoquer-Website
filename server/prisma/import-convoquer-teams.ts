// One-off import of the real Convoquer'26 team/participant roster from
// reports/Hard Coded Data/Convoquer Teams - Participant Import - Fixed.csv
// (the manually corrected output of scripts/convert-convoquer-teams.py).
//
// Reuses ParticipantsService.bulkImport directly — same institute/team
// find-or-create, sport gender resolution, and participant-overwrite logic
// the organizer CSV upload page uses — so this is not a parallel
// implementation to keep in sync by hand.
//
// Run with: npx tsx prisma/import-convoquer-teams.ts
import 'dotenv/config';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { ParticipantsService } from '../src/modules/teams/participants.service.js';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
// ParticipantsService only calls generic PrismaClient methods (findFirst,
// create, update, $transaction) — a plain PrismaClient satisfies it exactly
// like PrismaService does at runtime.
const participantsService = new ParticipantsService(prisma as never);

// The CSV's `college` values come from scripts/convert-convoquer-teams.py's
// per-sheet descriptive names, which don't always match seed.ts's canonical
// Institute.name/shortName exactly (e.g. punctuation, an appended city, a
// fuller descriptive name) — left as-is, bulkImport's institute lookup
// wouldn't match the existing seeded row and would create a duplicate
// institute instead of reusing it. Normalize the ones known to differ.
const COLLEGE_ALIASES: Record<string, string> = {
  'Baba Ghulam Shah Badshah University, Rajouri':
    'Baba Ghulam Shah Badshah University',
  'Model Institute of Engineering and Technology (MIET)': 'MIET',
  'Acharya Shiri Chander College of Medical Sciences and Hospital (ASCOMS)':
    'ASCOMS',
  'Amity University Punjab': 'Amity University, Punjab',
  'Government College of Engineering and Technology': 'GCET',
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH = path.join(
  __dirname,
  '..',
  '..',
  'reports',
  'Hard Coded Data',
  'Convoquer Teams - Participant Import - Fixed.csv',
);

/** Same quoted-CSV parsing rules as client/src/lib/csv.ts, ported for Node. */
function parseCsv(input: string): Record<string, string>[] {
  const records: string[][] = [];
  let row: string[] = [],
    field = '',
    quoted = false;
  const text = input.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(field.trim());
      field = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(field.trim());
      if (row.some(Boolean)) records.push(row);
      row = [];
      field = '';
    } else field += char;
  }
  row.push(field.trim());
  if (row.some(Boolean)) records.push(row);
  const headers = records.shift() || [];
  return records.map((values) =>
    Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ''])),
  );
}

async function main() {
  const event = await prisma.event.findUnique({
    where: { slug: 'convoquer-26' },
  });
  if (!event) {
    console.error("Convoquer'26 event not found — run prisma/seed.ts first.");
    process.exitCode = 1;
    return;
  }

  const csvRaw = readFileSync(CSV_PATH, 'utf-8');
  const parsed = parseCsv(csvRaw);
  console.log(`Parsed ${parsed.length} rows from ${CSV_PATH}`);

  const allRows = parsed.map((r) => ({
    name: r.name,
    college: COLLEGE_ALIASES[r.college?.trim()] || r.college,
    rollNumber: r.rollNumber,
    sport: r.sport || undefined,
    team: r.team || undefined,
    gender: r.gender || undefined,
    contactNumber: r.contactNumber || undefined,
    role: r.role || undefined,
    category: r.category || undefined,
  }));

  // The source sheet has occasional exact-identity duplicates (same person
  // entered twice, sometimes with a slightly fuller name the second time —
  // e.g. "Udaif Sajad" / "Udaif Sajad Bhat" at the same BGSBU roll number).
  // Keep the last occurrence of each (college, rollNumber, sport, team)
  // identity — it's consistently the more complete entry in this sheet —
  // and log what got dropped so it stays auditable.
  const byIdentity = new Map<string, (typeof allRows)[number]>();
  for (const row of allRows) {
    const identity = [
      row.college?.trim().toLowerCase(),
      row.rollNumber?.trim().toLowerCase(),
      row.sport?.trim().toLowerCase() || '',
      row.team?.trim().toLowerCase() || '',
    ].join('|');
    if (byIdentity.has(identity)) {
      console.warn(
        `Dropping duplicate row for ${JSON.stringify(byIdentity.get(identity))} in favor of ${JSON.stringify(row)}`,
      );
    }
    byIdentity.set(identity, row);
  }
  const rows = [...byIdentity.values()];
  console.log(
    `${allRows.length} rows parsed, ${rows.length} after de-duplication.`,
  );

  const dryRun = await participantsService.bulkImport({
    eventId: event.id,
    rows,
    dryRun: true,
  });
  console.log('Dry run validation passed:', dryRun);

  if (process.argv.includes('--dry-run')) {
    console.log('--dry-run passed, stopping before the real import.');
    return;
  }

  const result = await participantsService.bulkImport({
    eventId: event.id,
    rows,
    dryRun: false,
  });
  console.log('Import result:', result);
}

main()
  .catch((err) => {
    console.error('ERROR:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
