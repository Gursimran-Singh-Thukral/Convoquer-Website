import { StandingsService } from './standings.service.js';

// Knockout fixtures printed as "Group A 1st vs Group B 2nd", "Winner Pool-A vs
// Runner-up Pool-B", "Rank-1 vs Rank-2" or "Loser SF 1 vs Loser SF 2" have no
// team until the earlier rounds are decided. This fills those empty slots from
// the published results — it never overwrites a team that is already there.
//
//  - Group / pool slots wait until EVERY group-stage match is published.
//  - Rank slots (a single league table) wait for the same.
//  - Loser slots wait for that semi-final's result.
//
// Groups are the "(Pool A)" in the fixture label when present; otherwise the
// teams that played each other form a group, and the group holding the
// earliest-scheduled fixture is Group A, the next Group B, and so on.

type Db = any; // PrismaService or a transaction client

interface Row {
  id: string;
  matchNumber: string | null;
  stage: { name: string } | null;
  scheduledStartTime: Date;
  teamAId: string | null;
  teamBId: string | null;
  result: { status: string; winnerTeamId: string | null } | null;
}

const isGroupStage = (m: Row) =>
  /group|league|round robin/i.test(m.stage?.name ?? '');
const isKnockout = (m: Row) => !isGroupStage(m);

const byPlay = (a: Row, b: Row) =>
  a.scheduledStartTime.getTime() - b.scheduledStartTime.getTime() ||
  (a.matchNumber ?? '').localeCompare(b.matchNumber ?? '', undefined, {
    numeric: true,
  });

/** { A: Set(teamIds), B: Set(...) } for the group-stage fixtures. */
export function groupsOf(group: Row[]): Map<string, Set<string>> {
  const labelled = group.map((m) =>
    /\((?:pool|group)\s*([A-Z])\)/i
      .exec(m.matchNumber ?? '')?.[1]
      ?.toUpperCase(),
  );
  const out = new Map<string, Set<string>>();
  if (labelled.every(Boolean)) {
    group.forEach((m, i) => {
      const set = out.get(labelled[i]!) ?? new Set<string>();
      for (const id of [m.teamAId, m.teamBId]) if (id) set.add(id);
      out.set(labelled[i]!, set);
    });
    return new Map([...out].sort(([a], [b]) => a.localeCompare(b)));
  }
  // Connected components of "played each other", lettered by first fixture.
  const comps: { teams: Set<string>; first: Row }[] = [];
  for (const m of [...group].sort(byPlay)) {
    const ids = [m.teamAId, m.teamBId].filter(Boolean) as string[];
    const hit = comps.filter((c) => ids.some((id) => c.teams.has(id)));
    if (!hit.length) {
      comps.push({ teams: new Set(ids), first: m });
      continue;
    }
    const [keep, ...rest] = hit;
    for (const id of ids) keep.teams.add(id);
    for (const c of rest) {
      c.teams.forEach((id) => keep.teams.add(id));
      comps.splice(comps.indexOf(c), 1);
    }
  }
  comps.sort((a, b) => byPlay(a.first, b.first));
  comps.forEach((c, i) => out.set(String.fromCharCode(65 + i), c.teams));
  return out;
}

const SLOT =
  /(?:(winner|runner-?up)\s+(?:group|pool)[\s-]*([A-Z])\b)|(?:(?:group|pool)[\s-]*([A-Z])\s+(1st|2nd|3rd))|(?:rank[\s-]*(\d+))|(?:loser\s+(?:of\s+)?(?:sf|semi-?finals?)[\s-]*(\d))/gi;

type Want =
  | { kind: 'group'; group: string; place: number }
  | { kind: 'rank'; place: number }
  | { kind: 'loser'; semi: number };

export function wants(label: string): Want[] {
  // "Match 13: Winner Pool-A vs Runner-up Pool-B" -> only the part after the colon.
  const text = label.includes(':')
    ? label.slice(label.indexOf(':') + 1)
    : label;
  const out: Want[] = [];
  for (const m of text.matchAll(SLOT)) {
    if (m[1])
      out.push({
        kind: 'group',
        group: m[2].toUpperCase(),
        place: /winner/i.test(m[1]) ? 1 : 2,
      });
    else if (m[3])
      out.push({
        kind: 'group',
        group: m[3].toUpperCase(),
        place: Number(m[4][0]),
      });
    else if (m[5]) out.push({ kind: 'rank', place: Number(m[5]) });
    else if (m[6]) out.push({ kind: 'loser', semi: Number(m[6]) });
  }
  return out;
}

/** Returns how many slots were filled. */
export async function seedKnockouts(
  prisma: Db,
  tournamentId: string,
): Promise<number> {
  const matches: Row[] = await prisma.match.findMany({
    where: { tournamentId },
    select: {
      id: true,
      matchNumber: true,
      stage: { select: { name: true } },
      scheduledStartTime: true,
      teamAId: true,
      teamBId: true,
      result: { select: { status: true, winnerTeamId: true } },
    },
  });
  const group = matches.filter(
    (m) => isGroupStage(m) && m.teamAId && m.teamBId,
  );
  const open = matches.filter(
    (m) => isKnockout(m) && (!m.teamAId || !m.teamBId) && m.matchNumber,
  );
  if (!open.length) return 0;

  const groupDone =
    group.length > 0 && group.every((m) => m.result?.status === 'PUBLISHED');
  let table: string[] | null = null;
  let groups: Map<string, Set<string>> | null = null;
  const rankedGroup = async (letter: string) => {
    if (!table) {
      const { standings } = await new StandingsService(
        prisma,
      ).getTournamentStandings(tournamentId);
      table = standings.map((s) => s.teamId);
    }
    groups ??= groupsOf(group);
    return table.filter((id) => groups!.get(letter)?.has(id));
  };

  // Semi-finals by number, for "Loser SF n".
  const semis = new Map<number, Row>();
  for (const m of matches) {
    const n = /semi-?final\s*(\d)/i.exec(m.matchNumber ?? '')?.[1];
    if (n) semis.set(Number(n), m);
  }

  let filled = 0;
  for (const m of open) {
    const slots = wants(m.matchNumber!);
    if (slots.length !== 2) continue;
    const ids: (string | null)[] = [];
    for (const w of slots) {
      let id: string | null = null;
      if (w.kind === 'group' && groupDone)
        id = (await rankedGroup(w.group))[w.place - 1] ?? null;
      else if (w.kind === 'rank' && groupDone) {
        await rankedGroup('A');
        id = table?.[w.place - 1] ?? null;
      } else if (w.kind === 'loser') {
        const s = semis.get(w.semi);
        if (s?.result?.status === 'PUBLISHED' && s.result.winnerTeamId)
          id =
            [s.teamAId, s.teamBId].find(
              (t) => t && t !== s.result!.winnerTeamId,
            ) ?? null;
      }
      ids.push(id);
    }
    const data: Record<string, string> = {};
    if (!m.teamAId && ids[0]) data.teamAId = ids[0];
    if (!m.teamBId && ids[1]) data.teamBId = ids[1];
    if (Object.keys(data).length) {
      await prisma.match.update({ where: { id: m.id }, data });
      filled += Object.keys(data).length;
    }
  }
  return filled;
}
