// One-off import of the real Convoquer'26 fixture list from
// reports/Hard Coded Data/Fixtures/Fixtures.csv (produced from Fixtures.pdf by
// scripts/convert-fixtures.py).
//
// Creates, per sport (gender-split sports become two tournaments): a
// Tournament, its Stages (derived from the match label), and every Match with
// venue, IST start/end time and — where the PDF names real institutes — the
// two teams. "Winner of ..." slots stay empty and are wired with
// nextMatchId/nextMatchSlot, so publishing a result advances the winner into
// the next fixture exactly like a generated bracket. "Loser of ...", pool and
// rank placeholders are left as labelled, team-less fixtures (the bracket has
// no loser-progression), to be filled in by an organizer.
//
// Idempotent: a tournament that already has matches is skipped, unless
// --replace is given AND every one of its matches is still SCHEDULED.
//
// Run with: npx tsx prisma/import-fixtures.ts [--dry-run] [--replace] [--csv=path]
// (/reports is gitignored, so on a deployed host copy the CSV over and pass --csv.)
import 'dotenv/config';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const DRY_RUN = process.argv.includes('--dry-run');
const REPLACE = process.argv.includes('--replace');
// --only=<regex> restricts the run to matching sports, e.g. --only=chess
const ONLY = process.argv.find((a) => a.startsWith('--only='))?.slice(7);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_ARG = process.argv.find((a) => a.startsWith('--csv='))?.slice(6);
const CSV_PATH = CSV_ARG
  ? path.resolve(CSV_ARG)
  : path.join(
      __dirname,
      '..',
      '..',
      'reports',
      'Hard Coded Data',
      'Fixtures',
      'Fixtures.csv',
    );

/** Same quoted-CSV parsing rules as import-convoquer-teams.ts. */
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

// PDF institute wording -> Institute.name in seed.ts.
const INSTITUTE_ALIASES: Record<string, string> = {
  miet: 'MIET',
  'amity university': 'Amity University, Punjab',
  'amity university punjab': 'Amity University, Punjab',
  'amity punjab': 'Amity University, Punjab',
  'iim amritsar': 'IIM Amritsar',
  'ggms jammu': 'GGMS Jammu',
  smvdu: 'SMVDU',
  'iit jammu': 'Indian Institute of Technology Jammu',
  iit: 'Indian Institute of Technology Jammu',
  aiims: 'AIIMS',
  'aiims jammu': 'AIIMS',
  'iim jammu': 'IIM Jammu',
  iim: 'IIM Jammu',
  'central university': 'Central University of Jammu',
  'central university jammu': 'Central University of Jammu',
  cu: 'Central University of Jammu',
  'cu jammu': 'Central University of Jammu',
  gcet: 'GCET',
  gmc: 'GMC Jammu',
  'gmc jammu': 'GMC Jammu',
  'baba ghulam shah': 'Baba Ghulam Shah Badshah University',
  'baba ghulam shah badshah university': 'Baba Ghulam Shah Badshah University',
  'bgsbu rajouri': 'Baba Ghulam Shah Badshah University',
  'bhaskar degree college': 'Bhaskar Degree College Udhampur',
  'sher-e-kashmir':
    'Sher-e-Kashmir University of Agricultural Sciences and Technology',
  ascoms: 'ASCOMS',
  'central sanskrit university': 'Central Sanskrit University',
};

const GENDER_SPLIT = new Set([
  'Badminton',
  'Basketball',
  'Chess',
  'Table Tennis',
  'Volleyball',
]);

type Format = 'KNOCKOUT' | 'GROUP_KNOCKOUT' | 'ROUND_ROBIN' | 'LEAGUE';
const FORMATS: Record<string, Format> = {
  Athletics: 'LEAGUE',
  'Badminton (Men)': 'GROUP_KNOCKOUT',
  'Badminton (Women)': 'GROUP_KNOCKOUT',
  'Basketball (Men)': 'KNOCKOUT',
  'Basketball (Women)': 'KNOCKOUT',
  'Chess (Men)': 'LEAGUE', // 5-round Swiss
  'Chess (Women)': 'ROUND_ROBIN',
  Cricket: 'KNOCKOUT',
  'E-Sports': 'LEAGUE',
  // E-Sports is one tournament per game: Valorant is a knockout, Free Fire and
  // BGMI are multi-game points tables.
  'E-Sports — Valorant': 'KNOCKOUT',
  'E-Sports — Free Fire': 'LEAGUE',
  'E-Sports — BGMI': 'LEAGUE',
  Football: 'KNOCKOUT',
  'Table Tennis (Men)': 'GROUP_KNOCKOUT',
  'Table Tennis (Women)': 'ROUND_ROBIN',
  'Volleyball (Men)': 'KNOCKOUT',
  'Volleyball (Women)': 'ROUND_ROBIN',
};

// Used only when the PDF gives a start time and no end time. Derived from the
// spacing of consecutive slots in the PDF itself.
const DEFAULT_MINUTES: Record<string, number> = {
  Athletics: 30,
  Badminton: 90,
  Chess: 75,
  Cricket: 240,
  'E-Sports': 45,
  Volleyball: 90,
};

// The fixture PDF's Chess block was superseded by "Chess Fixtures.pdf", whose
// layout does not extract reliably, so its content is transcribed into
// "Chess Fixtures.csv" (girls' round robin + the boys' Swiss banner row).
const CHESS_CSV = 'Chess Fixtures.csv';

// Participating teams in seeding order, from "Chess Fixtures.pdf".
const CHESS_FIELD: Record<string, string[]> = {
  'Chess (Men)': [
    'IIT Jammu',
    'IIM Jammu',
    'AIIMS Jammu',
    'IIM Amritsar',
    'Central University',
    'MIET',
    'SMVDU',
  ],
  'Chess (Women)': [
    'IIT Jammu',
    'IIM Jammu',
    'AIIMS Jammu',
    'IIM Amritsar',
    'Central University',
    'SMVDU',
  ],
};

// Chess: 2 points for a win, 1 for a draw, 0 for a loss.
const POINTS: Record<string, [number, number, number]> = {
  'Chess (Men)': [2, 1, 0],
  'Chess (Women)': [2, 1, 0],
};

const VENUE_CRICKET = /^Cricket County Stadium, Jammu - (Ground G\d)$/;

function resolveVenue(sport: string, pdfVenue: string) {
  const v = pdfVenue.trim();
  if (/^Khel Gao/i.test(v)) return { name: 'Khel Gaon' };
  if (/^multipurpose ground$/i.test(v)) return { name: 'Football Ground' };
  if (/^Basketball Court$/i.test(v)) return { name: 'Basketball Court' };
  if (/^Volleyball Court$/i.test(v)) return { name: 'Volleyball Court' };
  if (/^01AC1001$/i.test(v)) return { name: '01AC1001' };
  const cricket = VENUE_CRICKET.exec(v);
  if (cricket)
    return {
      name: `Cricket County Stadium - ${cricket[1]}`,
      location: 'Cricket County Stadium, Jammu',
    };
  if (/^Chinar Sports Complex\s*\(\s*Table \d+\s*\)$/i.test(v))
    return { name: 'Table Tennis Court' };
  if (/^Chinar Sports Complex$/i.test(v))
    return sport === 'Chess'
      ? { name: 'Student Activity Centre' }
      : { name: 'Badminton Courts' };
  throw new Error(`Unmapped venue "${v}" for ${sport}`);
}

function parseTime(time: string): { h: number; m: number } {
  const hit = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(time.trim());
  if (!hit) throw new Error(`Unparseable time "${time}"`);
  let h = Number(hit[1]) % 12;
  if (hit[3].toUpperCase() === 'PM') h += 12;
  return { h, m: Number(hit[2]) };
}

function istDate(
  year: number,
  month: number,
  day: number,
  t: { h: number; m: number },
) {
  const p = (n: number) => String(n).padStart(2, '0');
  return new Date(`${year}-${p(month)}-${p(day)}T${p(t.h)}:${p(t.m)}:00+05:30`);
}

/** Stage (name, sequence, type) from the match label. */
function stageOf(label: string) {
  if (/swiss/i.test(label))
    return { name: 'Swiss Rounds', sequence: 1, type: 'SWISS' };
  if (/3rd place/i.test(label))
    return { name: '3rd Place', sequence: 7, type: 'KNOCKOUT' };
  if (/semi/i.test(label))
    return { name: 'Semifinals', sequence: 6, type: 'KNOCKOUT' };
  if (/\bPQF\b/i.test(label))
    return { name: 'Pre-Quarterfinals', sequence: 3, type: 'KNOCKOUT' };
  if (/\bQF\b|quarter/i.test(label))
    return { name: 'Quarterfinals', sequence: 5, type: 'KNOCKOUT' };
  if (/\bfinal\b/i.test(label))
    return { name: 'Final', sequence: 8, type: 'KNOCKOUT' };
  if (/preliminary/i.test(label))
    return { name: 'Preliminary', sequence: 2, type: 'KNOCKOUT' };
  if (/round 1/i.test(label))
    return { name: 'Round 1', sequence: 2, type: 'KNOCKOUT' };
  if (/round 2/i.test(label))
    return { name: 'Round 2', sequence: 4, type: 'KNOCKOUT' };
  return { name: 'Group Stage', sequence: 1, type: 'ROUND_ROBIN' };
}

/** Identifiers other fixtures can refer to ("Winner of QF 1", "Winner M4"). */
function keysOf(label: string): string[] {
  const colon = label.indexOf(':');
  const head = colon >= 0 ? label.slice(0, colon) : label;
  const keys = new Set<string>();
  let hit: RegExpExecArray | null;
  if ((hit = /\bMatch\s*(\d+)/i.exec(head))) keys.add(`M${hit[1]}`);
  for (const re of [/\b(PQF|QF|SF)\s*-?\s*(\d+)/gi]) {
    for (const m of head.matchAll(re)) keys.add(`${m[1].toUpperCase()}${m[2]}`);
  }
  if ((hit = /Semifinal\s*(\d+)/i.exec(head))) keys.add(`SF${hit[1]}`);
  if ((hit = /Quarterfinal\s*(\d+)/i.exec(head))) keys.add(`QF${hit[1]}`);
  return [...keys];
}

/** E-Sports reuses "Match 1" numbering per game; scope references to it. */
function gameOf(label: string): string {
  return /^(Valorant|Free Fire|BGMI)/i.exec(label)?.[1].toLowerCase() ?? '';
}

/** "Winner of Match 2" / "Winner M1" / "Winner SF-1" -> "M2" / "M1" / "SF1". */
function winnerRef(side: string): string | null {
  const hit =
    /^winner(?:\s+of)?\s+(?:match\s*)?(M\d+|\d+|(?:PQF|QF|SF)\s*-?\s*\d+)\b/i.exec(
      side.trim(),
    );
  if (!hit) return null;
  const raw = hit[1].replace(/[\s-]/g, '').toUpperCase();
  return /^\d+$/.test(raw) ? `M${raw}` : raw;
}

const PLACEHOLDER = /^(winner|loser|rank|league|group|pool|runner)/i;

type Fixture = {
  sportName: string;
  label: string;
  start: Date;
  end: Date;
  venue: { name: string; location?: string };
  sides: [string, string] | null;
  stage: ReturnType<typeof stageOf>;
  /** E-Sports only: which game's tournament this belongs to. */
  game?: 'Valorant' | 'Free Fire' | 'BGMI';
};

async function main() {
  const event = await prisma.event.findUnique({
    where: { slug: 'convoquer-26' },
  });
  if (!event) {
    console.error("Convoquer'26 event not found — run prisma/seed.ts first.");
    process.exitCode = 1;
    return;
  }
  const year = event.startDate.getUTCFullYear();

  const rows = parseCsv(readFileSync(CSV_PATH, 'utf-8')).filter(
    (r) => r.sport !== 'Chess',
  );
  rows.push(
    ...parseCsv(
      readFileSync(path.join(path.dirname(CSV_PATH), CHESS_CSV), 'utf-8'),
    ),
  );
  console.log(`Parsed ${rows.length} fixture rows from ${CSV_PATH}`);

  // ---- 1. Normalise every row (pure; no DB writes) ----------------------
  const bySport = new Map<string, Fixture[]>();
  const warnings: string[] = [];
  for (const r of rows) {
    const base = r.sport === 'Esports' ? 'E-Sports' : r.sport;
    let sportName = base;
    if (GENDER_SPLIT.has(base)) {
      const c = r.category.toLowerCase();
      if (c.startsWith('boys') || c.startsWith('men'))
        sportName = `${base} (Men)`;
      else if (c.startsWith('girls') || c.startsWith('women'))
        sportName = `${base} (Women)`;
      else {
        // The PDF has one Badminton row whose category cell says "Punjab" (a
        // stray fragment of "Amity University Punjab"); it sits in the Boys
        // block on 1 Oct, continuing the Boys match numbering (Match 6).
        sportName = `${base} (Men)`;
        warnings.push(
          `Category "${r.category}" is not a gender — treated as Boys: ${r.sport} | ${r.date} | ${r.match}`,
        );
      }
    }

    // The boys' chess Swiss is paired round by round with the Swiss generator
    // (Tournaments → Manage → Generate), so it has a tournament + seeded field
    // but no pre-made fixtures.
    if (base === 'Chess' && /swiss/i.test(r.match)) {
      if (!bySport.has(sportName)) bySport.set(sportName, []);
      continue;
    }

    const day = Number(/^(\d+)/.exec(r.date)?.[1]);
    const [startText, endText] = r.time.split('-').map((s) => s.trim());
    let startT: { h: number; m: number };
    if (/tbc/i.test(startText)) {
      // Basketball Grand Final: "Time TBC" on 4 Oct, after the girls' final
      // (9-10 AM). Placeholder slot — organizer to reschedule.
      startT = { h: 10, m: 0 };
      warnings.push(
        `Time TBC — placed at 10:00 AM on ${r.date}: ${r.sport} | ${r.match} (reschedule when known)`,
      );
    } else startT = parseTime(startText);
    const start = istDate(year, 10, day, startT);
    const end = endText
      ? istDate(year, 10, day, parseTime(endText))
      : new Date(start.getTime() + (DEFAULT_MINUTES[base] ?? 90) * 60_000);

    const tableNo = /Table (\d+)/i.exec(r.venue)?.[1];
    let label = r.match;
    if (tableNo) label += ` — Table ${tableNo}`;
    if (base === 'Athletics') label += ` — ${r.category}`;

    const colon = r.match.indexOf(':');
    const body = (colon >= 0 ? r.match.slice(colon + 1) : r.match)
      .replace(/\s*\([^)]*\)\s*$/, '')
      .trim();
    const parts = body.split(/\s+vs\s+/i);
    const sides = parts.length === 2 ? (parts as [string, string]) : null;

    const game =
      base === 'E-Sports'
        ? /valorant/i.test(r.match)
          ? 'Valorant'
          : /free fire/i.test(r.match)
            ? 'Free Fire'
            : /bgmi/i.test(r.match)
              ? 'BGMI'
              : undefined
        : undefined;
    const fixture: Fixture = {
      sportName,
      label,
      start,
      end,
      venue: resolveVenue(base, r.venue),
      sides,
      // Free Fire / BGMI games are grouped by match day ("2 Oct"), not by round.
      stage:
        game === 'Free Fire' || game === 'BGMI'
          ? { name: `${day} Oct`, sequence: day, type: 'ROUND_ROBIN' }
          : game === 'Valorant' && /Match [12]:/.test(r.match)
            ? { name: 'Semifinals', sequence: 6, type: 'KNOCKOUT' }
            : stageOf(r.match),
      game,
    };
    const key = game ? `${sportName}::${game}` : sportName;
    bySport.set(key, [...(bySport.get(key) ?? []), fixture]);
  }

  // Free Fire and BGMI are played as numbered games across both days
  // (BGMI: 4 a day, Free Fire: 5 a day) — "BGMI - Game 5" is the first game of day 2.
  for (const [key, list] of bySport) {
    const game = key.split('::')[1];
    if (game !== 'Free Fire' && game !== 'BGMI') continue;
    [...list]
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .forEach((f, i) => {
        f.label = `${game} - Game ${i + 1}`;
      });
  }

  // Venue capacity = peak simultaneous matches the PDF itself schedules there.
  const peak = new Map<string, number>();
  const all = [...bySport.values()].flat();
  for (const f of all) {
    const overlapping = all.filter(
      (g) =>
        g.venue.name === f.venue.name && g.start <= f.start && f.start < g.end,
    ).length;
    peak.set(f.venue.name, Math.max(peak.get(f.venue.name) ?? 1, overlapping));
  }

  // ---- 2. Write (single transaction; rolled back on --dry-run) ----------
  const summary = {
    tournaments: 0,
    skipped: [] as string[],
    stages: 0,
    matches: 0,
    linked: 0,
    teamsCreated: [] as string[],
    teamsRemoved: [] as string[],
    venuesCreated: [] as string[],
    venuesCapacity: [] as string[],
    unlinkedPlaceholders: [] as string[],
  };
  class DryRunRollback extends Error {}

  try {
    await prisma.$transaction(
      async (tx) => {
        // Venues
        const venues = new Map<string, string>();
        for (const f of all) {
          if (venues.has(f.venue.name)) continue;
          let v = await tx.venue.findFirst({
            where: { eventId: event.id, name: f.venue.name },
          });
          if (!v) {
            v = await tx.venue.create({
              data: {
                eventId: event.id,
                name: f.venue.name,
                location: f.venue.location ?? null,
              },
            });
            summary.venuesCreated.push(v.name);
          }
          const capacity = Math.max(
            v.simultaneousMatches,
            peak.get(v.name) ?? 1,
          );
          if (capacity !== v.simultaneousMatches) {
            await tx.venue.update({
              where: { id: v.id },
              data: { simultaneousMatches: capacity },
            });
            summary.venuesCapacity.push(
              `${v.name}: ${v.simultaneousMatches} -> ${capacity}`,
            );
          }
          venues.set(v.name, v.id);
        }

        const institutes = new Map<
          string,
          { id: string; shortName: string | null; name: string }
        >();
        async function teamFor(
          text: string,
          sport: { id: string; name: string },
          fixtureLabel: string,
        ) {
          // E-Sports teams are NOT created here: coordinators add every
          // E-Sports team themselves (+ Add team on the result form).
          if (sport.name === 'E-Sports') return null;
          const alias = INSTITUTE_ALIASES[text.trim().toLowerCase()];
          if (!alias) {
            if (PLACEHOLDER.test(text.trim())) return null;
            throw new Error(
              `Unknown institute "${text}" in "${fixtureLabel}" (${sport.name})`,
            );
          }
          let inst = institutes.get(alias);
          if (!inst) {
            const found = await tx.institute.findFirst({
              where: { eventId: event!.id, name: alias },
            });
            if (!found)
              throw new Error(
                `Institute "${alias}" missing — run prisma/seed.ts`,
              );
            inst = found;
            institutes.set(alias, inst);
          }
          // Same naming rule as ParticipantsService.bulkImport, so a later
          // roster import lands in these teams instead of duplicating them.
          const squad = sport.name === 'E-Sports' ? 'Valorant' : null;
          const base = `${inst.shortName || inst.name} ${sport.name}`;
          const teamName = squad ? `${base} (${squad})` : base;
          let team = await tx.team.findFirst({
            where: {
              eventId: event!.id,
              instituteId: inst.id,
              sportId: sport.id,
              name: teamName,
            },
          });
          if (!team) {
            team = await tx.team.create({
              data: {
                eventId: event!.id,
                instituteId: inst.id,
                sportId: sport.id,
                name: teamName,
              },
            });
            summary.teamsCreated.push(teamName);
          }
          return team.id;
        }

        for (const [key, fixtures] of bySport) {
          const [sportName, game] = key.split('::');
          const sport = await tx.sport.findFirst({
            where: { eventId: event.id, name: sportName },
          });
          if (!sport)
            throw new Error(
              `Sport "${sportName}" not found — run prisma/seed.ts`,
            );
          if (ONLY && !new RegExp(ONLY, 'i').test(sportName)) continue;

          const name = game
            ? `${sportName} — ${game}`
            : `${sportName} Championship`;

          // E-Sports used to be a single tournament; replace it with one per game.
          if (game) {
            const legacy = await tx.tournament.findFirst({
              where: {
                eventId: event.id,
                sportId: sport.id,
                name: `${sportName} Championship`,
              },
              include: { matches: { select: { status: true } } },
            });
            if (legacy) {
              if (!REPLACE) {
                summary.skipped.push(
                  `${legacy.name} is the old single E-Sports tournament; use --replace to split it per game`,
                );
                continue;
              }
              if (legacy.matches.some((m) => m.status !== 'SCHEDULED'))
                throw new Error(
                  `${legacy.name}: matches already started — refusing to replace`,
                );
              await tx.tournament.delete({ where: { id: legacy.id } });
            }
          }
          let tournament = await tx.tournament.findFirst({
            where: { eventId: event.id, sportId: sport.id, name },
            include: { matches: { select: { status: true } } },
          });
          if (tournament && tournament.matches.length) {
            if (!REPLACE) {
              summary.skipped.push(
                `${name} (${tournament.matches.length} matches exist; use --replace)`,
              );
              continue;
            }
            if (tournament.matches.some((m) => m.status !== 'SCHEDULED'))
              throw new Error(
                `${name}: matches already started — refusing to replace`,
              );
            await tx.match.deleteMany({
              where: { tournamentId: tournament.id },
            });
            await tx.tournamentStage.deleteMany({
              where: { tournamentId: tournament.id },
            });
          }
          if (!tournament) {
            tournament = await tx.tournament.create({
              data: {
                eventId: event.id,
                sportId: sport.id,
                name,
                format:
                  FORMATS[game ? `${sportName} — ${game}` : sportName] ??
                  'KNOCKOUT',
                ...(POINTS[sportName]
                  ? {
                      pointsForWin: POINTS[sportName][0],
                      pointsForDraw: POINTS[sportName][1],
                      pointsForLoss: POINTS[sportName][2],
                    }
                  : {}),
              },
              include: { matches: { select: { status: true } } },
            });
            summary.tournaments++;
          }

          if (POINTS[sportName])
            await tx.tournament.update({
              where: { id: tournament.id },
              data: {
                pointsForWin: POINTS[sportName][0],
                pointsForDraw: POINTS[sportName][1],
                pointsForLoss: POINTS[sportName][2],
              },
            });

          const field = CHESS_FIELD[sportName];
          if (field) {
            // Seeded in the order the PDF lists the participating teams.
            const teamIds: string[] = [];
            for (const inst of field)
              teamIds.push((await teamFor(inst, sport, sportName))!);
            await tx.tournamentTeamSeed.deleteMany({
              where: { tournamentId: tournament.id },
            });
            for (const [i, teamId] of teamIds.entries())
              await tx.tournamentTeamSeed.create({
                data: {
                  tournamentId: tournament.id,
                  teamId,
                  seedNumber: i + 1,
                },
              });
            // Drop empty teams created by an earlier import for institutes the
            // newer fixtures no longer include.
            const stale = await tx.team.findMany({
              where: {
                sportId: sport.id,
                id: { notIn: teamIds },
                members: { none: {} },
                matchesAsTeamA: { none: {} },
                matchesAsTeamB: { none: {} },
              },
            });
            if (stale.length) {
              await tx.team.deleteMany({
                where: { id: { in: stale.map((t) => t.id) } },
              });
              summary.teamsRemoved.push(...stale.map((t) => t.name));
            }
          }

          const stageIds = new Map<string, string>();
          for (const f of fixtures) {
            if (stageIds.has(f.stage.name)) continue;
            const stage = await tx.tournamentStage.create({
              data: {
                tournamentId: tournament.id,
                name: f.stage.name,
                sequence: f.stage.sequence,
                stageType: f.stage.type,
              },
            });
            stageIds.set(f.stage.name, stage.id);
            summary.stages++;
          }

          // Chronological order so match creation order matches the day plan.
          const ordered = [...fixtures].sort(
            (a, b) => a.start.getTime() - b.start.getTime(),
          );
          const created: { id: string; fixture: Fixture }[] = [];
          for (const f of ordered) {
            const [a, b] = f.sides
              ? [
                  await teamFor(f.sides[0], sport, f.label),
                  await teamFor(f.sides[1], sport, f.label),
                ]
              : [null, null];
            const match = await tx.match.create({
              data: {
                tournamentId: tournament.id,
                stageId: stageIds.get(f.stage.name),
                venueId: venues.get(f.venue.name),
                matchNumber: f.label,
                teamAId: a,
                teamBId: b,
                scheduledStartTime: f.start,
                scheduledEndTime: f.end,
                scoringMode: sport.scoringMode,
              },
            });
            created.push({ id: match.id, fixture: f });
            summary.matches++;
          }

          // Wire "Winner of X" slots: the feeder's winner advances into slot A/B.
          const index = new Map<string, string[]>();
          for (const c of created)
            for (const k of keysOf(c.fixture.label))
              index.set(gameOf(c.fixture.label) + k, [
                ...(index.get(gameOf(c.fixture.label) + k) ?? []),
                c.id,
              ]);
          for (const c of created) {
            if (!c.fixture.sides) continue;
            for (const [i, side] of c.fixture.sides.entries()) {
              if (!PLACEHOLDER.test(side.trim())) continue;
              const ref = winnerRef(side);
              const targets = ref
                ? index.get(gameOf(c.fixture.label) + ref)
                : undefined;
              if (
                !ref ||
                !targets ||
                targets.length !== 1 ||
                targets[0] === c.id
              ) {
                summary.unlinkedPlaceholders.push(
                  `${sportName}: ${c.fixture.label} [${side}]`,
                );
                continue;
              }
              await tx.match.update({
                where: { id: targets[0] },
                data: { nextMatchId: c.id, nextMatchSlot: i === 0 ? 'A' : 'B' },
              });
              summary.linked++;
            }
          }
        }

        if (DRY_RUN) throw new DryRunRollback();
      },
      { timeout: 120_000, maxWait: 30_000 },
    );
  } catch (err) {
    if (!(err instanceof DryRunRollback)) throw err;
  }

  console.log(
    DRY_RUN
      ? '\n--dry-run: everything below was rolled back.'
      : '\nImport committed.',
  );
  console.log(JSON.stringify(summary, null, 2));
  if (warnings.length)
    console.warn('\nWarnings:\n - ' + warnings.join('\n - '));
}

main()
  .catch((err) => {
    console.error('ERROR:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
