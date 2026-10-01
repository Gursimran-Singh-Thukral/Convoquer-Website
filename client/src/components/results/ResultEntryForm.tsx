'use client';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiAuthedGet, apiPatch, apiPost, type Institute, type Match, type Team } from '@/lib/api';
import {
  dash,
  formatHalf,
  gamesConfigFor,
  type GamesConfig,
  isRankedKind,
  resultKindFor,
  type ResultKind,
} from '@/lib/resultFormat';

type Payload = Record<string, unknown>;
interface SideNames {
  a: string;
  b: string;
}

const box = 'block w-full bg-zinc-900 border border-white/20 rounded p-2';
const numBox = `${box} text-center font-mono`;

function Num({
  label,
  value,
  onChange,
  max = 999,
  step = 1,
  width = 'w-full',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  max?: number;
  step?: number;
  width?: string;
}) {
  return (
    <input
      aria-label={label}
      type="number"
      inputMode="numeric"
      min={0}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${numBox} ${width}`}
    />
  );
}

const n = (v: string) => (v.trim() === '' ? NaN : Number(v));
const filled = (v: string) => v.trim() !== '';

function Legend({ children }: { children: ReactNode }) {
  return <p className="text-xs text-zinc-400">{children}</p>;
}

/** Two team names heading a two-column score grid. */
function Heads({ names }: { names: SideNames }) {
  return (
    <div className="grid grid-cols-[6rem_1fr_1fr] gap-2 text-xs font-bold uppercase tracking-wider text-zinc-300">
      <span />
      <span className="truncate text-center" title={names.a}>
        {names.a}
      </span>
      <span className="truncate text-center" title={names.b}>
        {names.b}
      </span>
    </div>
  );
}

function PairRow({
  label,
  a,
  b,
  onA,
  onB,
  max,
  extra,
  ariaPrefix = '',
}: {
  ariaPrefix?: string;
  label: string;
  a: string;
  b: string;
  onA: (v: string) => void;
  onB: (v: string) => void;
  max?: number;
  extra?: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[6rem_1fr_1fr] gap-2 items-center">
      <span className="text-sm text-zinc-300">
        {label}
        {extra}
      </span>
      <Num label={`${ariaPrefix}${label} team A`} value={a} onChange={onA} max={max} />
      <Num label={`${ariaPrefix}${label} team B`} value={b} onChange={onB} max={max} />
    </div>
  );
}

// --------------------------------------------------------------------- SETS
function SetsForm({
  names,
  emit,
  bestOf = 3,
}: {
  names: SideNames;
  emit: (p: Payload | null) => void;
  bestOf?: number;
}) {
  const need = (bestOf + 1) / 2; // sets a team must win
  const [sets, setSets] = useState<SetRow[]>(() =>
    Array.from({ length: bestOf }, () => ({ a: '', b: '' })),
  );
  // Rows in play: the first `need` always, then one more only while undecided.
  const inPlay = (all: SetRow[]) => {
    let a = 0;
    let b = 0;
    const rows: number[] = [];
    let complete = true; // every earlier set has both scores
    for (let i = 0; i < bestOf; i++) {
      if (i >= need && (!complete || a === need || b === need)) break;
      rows.push(i);
      const s = all[i];
      if (filled(s.a) && filled(s.b)) {
        if (n(s.a) > n(s.b)) a++;
        else if (n(s.a) < n(s.b)) b++;
      } else complete = false;
    }
    return { rows, a, b };
  };
  useEffect(() => {
    const { rows } = inPlay(sets);
    const played = rows
      .map((i) => sets[i])
      .filter((s) => filled(s.a) && filled(s.b))
      .map((s) => ({ a: n(s.a), b: n(s.b) }));
    emit(played.length ? { kind: 'SETS', sets: played } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sets, emit, bestOf]);
  const { rows, a, b } = inPlay(sets);
  return (
    <div className="space-y-2">
      <Legend>
        Best of {bestOf} sets (first to {need}). Enter the points scored by each team in every set
        played; the next set only appears while the match is still open.
      </Legend>
      <Heads names={names} />
      {rows.map((i) => (
        <PairRow
          key={i}
          label={i === bestOf - 1 ? `Set ${i + 1} (decider)` : `Set ${i + 1}`}
          a={sets[i].a}
          b={sets[i].b}
          max={99}
          onA={(v) => setSets((all) => all.map((x, j) => (j === i ? { ...x, a: v } : x)))}
          onB={(v) => setSets((all) => all.map((x, j) => (j === i ? { ...x, b: v } : x)))}
        />
      ))}
      <p className="text-sm font-bold text-[#FFD700]">
        Sets: {a}
        {dash}
        {b}
      </p>
    </div>
  );
}

// ------------------------------------------------------------------- GAMES
type SetRow = { a: string; b: string };
const blankSets = (): SetRow[] => [
  { a: '', b: '' },
  { a: '', b: '' },
  { a: '', b: '' },
];

/** One game (best of 3 sets): the sets actually played and who has won it. */
function evalGame(g: SetRow[]) {
  const diff = (i: number) => (filled(g[i].a) && filled(g[i].b) ? n(g[i].a) - n(g[i].b) : 0);
  const level = diff(0) * diff(1) < 0; // a set each → a deciding set is needed
  const played = (level ? g : g.slice(0, 2)).filter((x) => filled(x.a) && filled(x.b));
  let a = 0;
  let b = 0;
  for (const x of played) {
    if (n(x.a) > n(x.b)) a++;
    else if (n(x.a) < n(x.b)) b++;
  }
  return { level, played, a, b, decided: a === 2 || b === 2 };
}

function GamesForm({
  names,
  emit,
  cfg,
}: {
  names: SideNames;
  emit: (p: Payload | null) => void;
  cfg: GamesConfig;
}) {
  const total = cfg.count;
  const need = (total + 1) / 2; // majority
  const unit = cfg.unit;
  const plural = unit === 'Match' ? 'matches' : 'games';
  const [games, setGames] = useState<SetRow[][]>(() => Array.from({ length: total }, blankSets));
  const [who, setWho] = useState(() => Array.from({ length: total }, () => ({ a: '', b: '' })));

  // Which games are in play and the running tally. A tie that stops at a
  // majority hides later games once decided; "play all" ties show every game.
  const walk = (all: SetRow[][]) => {
    let gA = 0;
    let gB = 0;
    const rows: number[] = [];
    for (let i = 0; i < total; i++) {
      if (!cfg.playAll && (gA === need || gB === need)) break;
      rows.push(i);
      const g = evalGame(all[i]);
      if (g.decided) {
        if (g.a > g.b) gA++;
        else gB++;
      } else if (!cfg.playAll) break;
    }
    return { rows, gA, gB };
  };
  useEffect(() => {
    const out: Payload[] = [];
    for (const i of walk(games).rows) {
      const g = evalGame(games[i]);
      if (!g.played.length) {
        if (cfg.playAll) continue;
        break;
      }
      out.push({
        sets: g.played.map((x) => ({ a: n(x.a), b: n(x.b) })),
        ...(who[i].a.trim() ? { playerA: who[i].a.trim() } : {}),
        ...(who[i].b.trim() ? { playerB: who[i].b.trim() } : {}),
      });
    }
    emit(out.length ? { kind: 'GAMES', games: out } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [games, who, emit, total]);

  const { rows, gA, gB } = walk(games);
  const setAt = (i: number, k: number, side: 'a' | 'b', v: string) =>
    setGames((all) =>
      all.map((gm, j) => (j === i ? gm.map((x, m) => (m === k ? { ...x, [side]: v } : x)) : gm)),
    );
  return (
    <div className="space-y-3">
      <Legend>
        {cfg.playAll
          ? `${total} ${plural} are played, each best of 3 sets to ${cfg.setTo ?? 21} points (win by 2). Enter every ${unit.toLowerCase()}: the team that wins more ${plural} wins the tie.`
          : `Best of ${total} ${plural}. Each ${unit.toLowerCase()} is best of 3 sets: enter the set scores. The tie ends as soon as one team wins ${need} ${plural}, so the next ${unit.toLowerCase()} only appears while it is still open.`}
      </Legend>
      <Heads names={names} />
      {rows.map((i) => {
        const g = evalGame(games[i]);
        const shown = g.level ? games[i] : games[i].slice(0, 2);
        return (
          <fieldset key={i} className="space-y-2 rounded border border-white/10 p-3">
            <legend className="px-1 font-bold text-[#FFD700]">
              {unit} {i + 1}
              {g.decided ? ` — ${g.a}${dash}${g.b} sets` : ''}
            </legend>
            <div className="grid grid-cols-2 gap-2">
              <input
                aria-label={`${unit} ${i + 1} team A players`}
                placeholder={`${names.a} player(s)`}
                className={box}
                maxLength={80}
                value={who[i].a}
                onChange={(e) =>
                  setWho((w) => w.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))
                }
              />
              <input
                aria-label={`${unit} ${i + 1} team B players`}
                placeholder={`${names.b} player(s)`}
                className={box}
                maxLength={80}
                value={who[i].b}
                onChange={(e) =>
                  setWho((w) => w.map((x, j) => (j === i ? { ...x, b: e.target.value } : x)))
                }
              />
            </div>
            {shown.map((st, k) => (
              <PairRow
                key={k}
                label={k === 2 ? 'Set 3 (decider)' : `Set ${k + 1}`}
                a={st.a}
                b={st.b}
                max={99}
                ariaPrefix={`${unit} ${i + 1} `}
                onA={(v) => setAt(i, k, 'a', v)}
                onB={(v) => setAt(i, k, 'b', v)}
              />
            ))}
          </fieldset>
        );
      })}
      <p className="text-sm font-bold text-[#FFD700]">
        {unit === 'Match' ? 'Matches' : 'Games'}: {gA}
        {dash}
        {gB}
      </p>
    </div>
  );
}

// ----------------------------------------------------------------- QUARTERS
function QuartersForm({ names, emit }: { names: SideNames; emit: (p: Payload | null) => void }) {
  const blank = () => ({ a: '', b: '' });
  const [q, setQ] = useState([blank(), blank(), blank(), blank()]);
  const [ot, setOt] = useState<{ a: string; b: string }[]>([]);
  useEffect(() => {
    const ready =
      q.every((p) => filled(p.a) && filled(p.b)) && ot.every((p) => filled(p.a) && filled(p.b));
    emit(
      ready
        ? {
            kind: 'QUARTERS',
            periods: q.map((p) => ({ a: n(p.a), b: n(p.b) })),
            overtime: ot.map((p) => ({ a: n(p.a), b: n(p.b) })),
          }
        : null,
    );
  }, [q, ot, emit]);
  const total = (side: 'a' | 'b') =>
    [...q, ...ot].reduce((t, p) => t + (filled(p[side]) ? n(p[side]) : 0), 0);
  const upd = (setter: typeof setQ, i: number, side: 'a' | 'b') => (v: string) =>
    setter((all) => all.map((x, j) => (j === i ? { ...x, [side]: v } : x)));
  return (
    <div className="space-y-2">
      <Legend>
        4 quarters. Add an overtime period only if the game was level after the fourth.
      </Legend>
      <Heads names={names} />
      {q.map((p, i) => (
        <PairRow
          key={i}
          label={`Quarter ${i + 1}`}
          a={p.a}
          b={p.b}
          max={200}
          onA={upd(setQ, i, 'a')}
          onB={upd(setQ, i, 'b')}
        />
      ))}
      {ot.map((p, i) => (
        <PairRow
          key={`ot${i}`}
          label={`Overtime ${i + 1}`}
          a={p.a}
          b={p.b}
          max={100}
          onA={upd(setOt, i, 'a')}
          onB={upd(setOt, i, 'b')}
          extra={
            <button
              type="button"
              className="ml-1 text-xs text-red-300 underline"
              onClick={() => setOt((x) => x.filter((_, j) => j !== i))}
            >
              remove
            </button>
          }
        />
      ))}
      <button
        type="button"
        className="text-sm underline text-[#FFD700]"
        onClick={() => setOt((x) => [...x, blank()])}
      >
        + Add overtime period
      </button>
      <p className="text-sm font-bold text-[#FFD700]">
        Total: {total('a')}
        {dash}
        {total('b')}
      </p>
    </div>
  );
}

// ------------------------------------------------------------------ CRICKET
function CricketForm({
  match,
  names,
  emit,
  setWinner,
}: {
  match: Match;
  names: SideNames;
  emit: (p: Payload | null) => void;
  setWinner: (id: string) => void;
}) {
  const [first, setFirst] = useState<'A' | 'B'>('A');
  const [inn, setInn] = useState({
    A: { runs: '', wickets: '', overs: '20' },
    B: { runs: '', wickets: '', overs: '20' },
  });
  const [tie, setTie] = useState({ so: false, a: '', b: '', winner: '' });
  const ready = (['A', 'B'] as const).every(
    (s) => filled(inn[s].runs) && filled(inn[s].wickets) && inn[s].overs.trim(),
  );
  const tied = ready && n(inn.A.runs) === n(inn.B.runs);
  useEffect(() => {
    if (!ready) return emit(null);
    const d: Payload = {
      kind: 'CRICKET',
      battingFirst: first,
      innings: {
        A: { runs: n(inn.A.runs), wickets: n(inn.A.wickets), overs: inn.A.overs.trim() },
        B: { runs: n(inn.B.runs), wickets: n(inn.B.wickets), overs: inn.B.overs.trim() },
      },
    };
    if (tied && tie.so && filled(tie.a) && filled(tie.b))
      d.superOver = { a: n(tie.a), b: n(tie.b) };
    emit(d);
  }, [ready, tied, first, inn, tie, emit]);
  useEffect(() => {
    setWinner(tied && !tie.so ? tie.winner : '');
  }, [tied, tie, setWinner]);
  const set = (s: 'A' | 'B', k: 'runs' | 'wickets' | 'overs') => (v: string) =>
    setInn((x) => ({ ...x, [s]: { ...x[s], [k]: v } }));
  return (
    <div className="space-y-3">
      <Legend>
        Each side bats a maximum of 20 overs. Overs are written as 20 or 18.3 (18 overs, 3 balls).
      </Legend>
      <fieldset className="flex flex-wrap gap-4 text-sm">
        <legend className="mb-1 text-zinc-300">Batted first</legend>
        {(['A', 'B'] as const).map((s) => (
          <label key={s} className="flex items-center gap-2">
            <input
              type="radio"
              name="batting-first"
              checked={first === s}
              onChange={() => setFirst(s)}
            />
            {s === 'A' ? names.a : names.b}
          </label>
        ))}
      </fieldset>
      {(['A', 'B'] as const).map((s) => (
        <div key={s} className="grid grid-cols-[1fr_5rem_5rem_5rem] gap-2 items-end">
          <span className="font-semibold truncate" title={s === 'A' ? names.a : names.b}>
            {s === 'A' ? names.a : names.b}
          </span>
          <label className="text-[11px] text-zinc-400">
            Runs
            <Num
              label={`${s === 'A' ? names.a : names.b} runs`}
              value={inn[s].runs}
              onChange={set(s, 'runs')}
              max={1000}
            />
          </label>
          <label className="text-[11px] text-zinc-400">
            Wickets
            <Num
              label={`${s === 'A' ? names.a : names.b} wickets`}
              value={inn[s].wickets}
              onChange={set(s, 'wickets')}
              max={10}
            />
          </label>
          <label className="text-[11px] text-zinc-400">
            Overs
            <input
              aria-label={`${s === 'A' ? names.a : names.b} overs`}
              value={inn[s].overs}
              onChange={(e) => set(s, 'overs')(e.target.value)}
              className={numBox}
            />
          </label>
        </div>
      ))}
      {tied && (
        <div className="rounded border border-amber-400/40 p-3 space-y-2">
          <p className="text-sm text-amber-300 font-bold">Scores are level</p>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={tie.so}
              onChange={(e) => setTie((t) => ({ ...t, so: e.target.checked }))}
            />
            Decided by a super over
          </label>
          {tie.so ? (
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[11px] text-zinc-400">
                {names.a} super over runs
                <Num
                  label="Super over team A"
                  value={tie.a}
                  onChange={(v) => setTie((t) => ({ ...t, a: v }))}
                  max={100}
                />
              </label>
              <label className="text-[11px] text-zinc-400">
                {names.b} super over runs
                <Num
                  label="Super over team B"
                  value={tie.b}
                  onChange={(v) => setTie((t) => ({ ...t, b: v }))}
                  max={100}
                />
              </label>
            </div>
          ) : (
            <label className="block text-sm">
              Winner (bowl-out / boundary count / organiser decision)
              <select
                aria-label="Tie winner"
                className={box}
                value={tie.winner}
                onChange={(e) => setTie((t) => ({ ...t, winner: e.target.value }))}
              >
                <option value="">Match tied — no winner</option>
                {match.teamA && <option value={match.teamA.id}>{match.teamA.name}</option>}
                {match.teamB && <option value={match.teamB.id}>{match.teamB.name}</option>}
              </select>
            </label>
          )}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------- FOOTBALL
function FootballForm({ names, emit }: { names: SideNames; emit: (p: Payload | null) => void }) {
  const [reg, setReg] = useState({ a: '', b: '' });
  const [et, setEt] = useState({ on: false, a: '', b: '' });
  const [pen, setPen] = useState({ on: false, a: '', b: '' });
  useEffect(() => {
    if (!filled(reg.a) || !filled(reg.b)) return emit(null);
    const d: Payload = { kind: 'FOOTBALL', regulation: { a: n(reg.a), b: n(reg.b) } };
    if (et.on && filled(et.a) && filled(et.b)) d.extraTime = { a: n(et.a), b: n(et.b) };
    if (pen.on && filled(pen.a) && filled(pen.b)) d.penalties = { a: n(pen.a), b: n(pen.b) };
    emit(d);
  }, [reg, et, pen, emit]);
  const level =
    filled(reg.a) &&
    filled(reg.b) &&
    n(reg.a) + (et.on ? n(et.a) || 0 : 0) === n(reg.b) + (et.on ? n(et.b) || 0 : 0);
  return (
    <div className="space-y-3">
      <Legend>
        Full-time score first. Extra time applies to semi-finals and the final. If the score is
        still level, record the penalty shoot-out.
      </Legend>
      <Heads names={names} />
      <PairRow
        label="Full time"
        a={reg.a}
        b={reg.b}
        max={50}
        onA={(v) => setReg((x) => ({ ...x, a: v }))}
        onB={(v) => setReg((x) => ({ ...x, b: v }))}
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={et.on}
          onChange={(e) => setEt((x) => ({ ...x, on: e.target.checked }))}
        />
        Went to extra time
      </label>
      {et.on && (
        <PairRow
          label="Extra-time goals"
          a={et.a}
          b={et.b}
          max={50}
          onA={(v) => setEt((x) => ({ ...x, a: v }))}
          onB={(v) => setEt((x) => ({ ...x, b: v }))}
        />
      )}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={pen.on}
          onChange={(e) => setPen((x) => ({ ...x, on: e.target.checked }))}
        />
        Decided on penalties
      </label>
      {pen.on && (
        <PairRow
          label="Penalties"
          a={pen.a}
          b={pen.b}
          max={50}
          onA={(v) => setPen((x) => ({ ...x, a: v }))}
          onB={(v) => setPen((x) => ({ ...x, b: v }))}
        />
      )}
      {level && !pen.on && (
        <p className="text-xs text-amber-300">
          The score is level — tick “Decided on penalties” for a knockout match.
        </p>
      )}
    </div>
  );
}

// -------------------------------------------------------------------- CHESS
type BoardRow = { playerA: string; playerB: string; result: '1' | '0.5' | '0' };
const BOARDS = 4;

function useRoster(teamId?: string | null): string[] {
  const [names, setNames] = useState<string[]>([]);
  useEffect(() => {
    if (!teamId) return;
    let live = true;
    apiAuthedGet<{ members?: { participant?: { name?: string } }[] }>(`/teams/${teamId}`)
      .then(
        (t) =>
          live && setNames((t.members ?? []).map((m) => m.participant?.name ?? '').filter(Boolean)),
      )
      .catch(() => live && setNames([]));
    return () => {
      live = false;
    };
  }, [teamId]);
  return names;
}

function ChessForm({
  match,
  names,
  emit,
}: {
  match: Match;
  names: SideNames;
  emit: (p: Payload | null) => void;
}) {
  const [boards, setBoards] = useState<BoardRow[]>(() =>
    Array.from({ length: BOARDS }, () => ({ playerA: '', playerB: '', result: '0.5' as const })),
  );
  const rosterA = useRoster(match.teamAId);
  const rosterB = useRoster(match.teamBId);
  useEffect(() => {
    emit({
      kind: 'CHESS',
      boards: boards.map((b) => ({
        a: Number(b.result),
        ...(b.playerA.trim() ? { playerA: b.playerA.trim() } : {}),
        ...(b.playerB.trim() ? { playerB: b.playerB.trim() } : {}),
      })),
    });
  }, [boards, emit]);
  const a = boards.reduce((t, b) => t + Number(b.result), 0);
  const b = boards.length - a;
  const upd = (i: number, patch: Partial<BoardRow>) =>
    setBoards((all) => all.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <div className="space-y-2">
      <Legend>
        Each team plays {BOARDS} players, paired board by board: board N of one team meets board N
        of the other. Player names are optional (suggestions come from the team roster). The team
        total decides the match: winner 2 points, draw 1 each.
      </Legend>
      <datalist id="roster-a">
        {rosterA.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
      <datalist id="roster-b">
        {rosterB.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
      <div className="grid grid-cols-[2.5rem_1fr_7rem_1fr] gap-2 text-xs font-bold uppercase tracking-wider text-zinc-300">
        <span>Bd</span>
        <span className="truncate">{names.a}</span>
        <span className="text-center">Result</span>
        <span className="truncate">{names.b}</span>
      </div>
      {boards.map((bd, i) => (
        <div key={i} className="grid grid-cols-[2.5rem_1fr_7rem_1fr] gap-2 items-center">
          <span className="text-zinc-400">{i + 1}</span>
          <input
            aria-label={`Board ${i + 1} team A player`}
            list="roster-a"
            className={box}
            value={bd.playerA}
            maxLength={80}
            onChange={(e) => upd(i, { playerA: e.target.value })}
          />
          <select
            aria-label={`Board ${i + 1} result`}
            className={box}
            value={bd.result}
            onChange={(e) => upd(i, { result: e.target.value as BoardRow['result'] })}
          >
            <option value="1">1 – 0</option>
            <option value="0.5">½ – ½</option>
            <option value="0">0 – 1</option>
          </select>
          <input
            aria-label={`Board ${i + 1} team B player`}
            list="roster-b"
            className={box}
            value={bd.playerB}
            maxLength={80}
            onChange={(e) => upd(i, { playerB: e.target.value })}
          />
        </div>
      ))}
      <p className="text-sm font-bold text-[#FFD700]">
        Team score: {formatHalf(a)}
        {dash}
        {formatHalf(b)}
        {a === b ? ' — match drawn' : ''}
      </p>
    </div>
  );
}

// ------------------------------------------------------- RANKED (TRACK/LOBBY)
interface Row {
  teamId: string;
  athlete: string;
  mark: string;
  rank: string;
  note: string;
  qualified: boolean;
  kills: string;
  pp: string;
  kp: string;
}
const blankRow = (rank?: number, teamId = ''): Row => ({
  teamId,
  athlete: '',
  mark: '',
  rank: rank ? String(rank) : '',
  note: '',
  qualified: false,
  kills: '',
  pp: '',
  kp: '',
});

function categoriesFor(label: string | null | undefined): ('Men' | 'Women' | 'Mixed')[] {
  const l = label ?? '';
  if (/mix/i.test(l)) return ['Mixed'];
  if (/—\s*Men$/i.test(l)) return ['Men'];
  if (/—\s*Women$/i.test(l)) return ['Women'];
  return ['Men', 'Women'];
}

function TrackForm({
  match,
  teams,
  emit,
  onTeamAdded,
}: {
  match: Match;
  teams: Team[];
  emit: (p: Payload | null) => void;
  onTeamAdded: (team: Team) => void;
}) {
  const label = match.matchNumber ?? '';
  const cats = categoriesFor(label);
  const semi = /semi/i.test(label);
  const round = semi ? 'SEMIFINAL' : /final/i.test(label) ? 'FINAL' : 'DIRECT';
  const [rows, setRows] = useState<Record<string, Row[]>>(() =>
    Object.fromEntries(cats.map((c) => [c, Array.from({ length: 8 }, (_, i) => blankRow(i + 1))])),
  );
  useEffect(() => {
    const sections = cats
      .map((category) => ({
        category,
        entries: rows[category]
          .filter((r) => r.teamId)
          .map((r) => ({
            teamId: r.teamId,
            ...(r.note ? { note: r.note } : { rank: Number(r.rank) }),
            ...(r.athlete.trim() ? { athlete: r.athlete.trim() } : {}),
            ...(r.mark.trim() ? { mark: r.mark.trim() } : {}),
            ...(r.qualified ? { qualified: true } : {}),
          })),
      }))
      .filter((s) => s.entries.length);
    emit(sections.length ? { kind: 'TRACK', round, sections } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, emit, round]);
  const upd = (cat: string, i: number, patch: Partial<Row>) =>
    setRows((all) => ({
      ...all,
      [cat]: all[cat].map((r, j) => (j === i ? { ...r, ...patch } : r)),
    }));
  return (
    <div className="space-y-5">
      <Legend>
        {semi
          ? 'Semi-final: enter every finisher and tick Q for the teams that qualify for the final.'
          : 'Enter the full result of the event in one go. Leave unused rows without a team.'}{' '}
        Use DNS / DNF / DQ / NM for athletes without a valid mark.
      </Legend>
      {cats.map((cat) => (
        <fieldset key={cat} className="space-y-2">
          <legend className="font-bold text-[#FFD700] mb-1">
            {cat === 'Mixed' ? 'Mixed' : `${cat}’s`}
          </legend>
          <div className="grid grid-cols-[3rem_1fr_1fr_6rem_5rem_2.5rem] gap-2 text-[10px] uppercase tracking-widest text-zinc-400">
            <span>Pos</span>
            <span>Team</span>
            <span>Athlete</span>
            <span>Time / mark</span>
            <span>Status</span>
            {semi ? <span>Q</span> : <span />}
          </div>
          {rows[cat].map((r, i) => (
            <div
              key={i}
              className="grid grid-cols-[3rem_1fr_1fr_6rem_5rem_2.5rem] gap-2 items-center"
            >
              <input
                aria-label={`${cat} position ${i + 1}`}
                className={numBox}
                type="number"
                min={1}
                value={r.rank}
                onChange={(e) => upd(cat, i, { rank: e.target.value })}
              />
              <select
                aria-label={`${cat} team ${i + 1}`}
                className={box}
                value={r.teamId}
                onChange={(e) => upd(cat, i, { teamId: e.target.value })}
              >
                <option value="">—</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.institute?.shortName || t.name}
                  </option>
                ))}
              </select>
              <input
                aria-label={`${cat} athlete ${i + 1}`}
                className={box}
                value={r.athlete}
                maxLength={60}
                onChange={(e) => upd(cat, i, { athlete: e.target.value })}
              />
              <input
                aria-label={`${cat} mark ${i + 1}`}
                className={numBox}
                placeholder="10.85 / 6.42m"
                value={r.mark}
                maxLength={60}
                onChange={(e) => upd(cat, i, { mark: e.target.value })}
              />
              <select
                aria-label={`${cat} status ${i + 1}`}
                className={box}
                value={r.note}
                onChange={(e) => upd(cat, i, { note: e.target.value })}
              >
                <option value="">OK</option>
                <option value="DNS">DNS</option>
                <option value="DNF">DNF</option>
                <option value="DQ">DQ</option>
                <option value="NM">NM</option>
              </select>
              {semi ? (
                <input
                  aria-label={`${cat} qualified ${i + 1}`}
                  type="checkbox"
                  checked={r.qualified}
                  onChange={(e) => upd(cat, i, { qualified: e.target.checked })}
                />
              ) : (
                <span />
              )}
            </div>
          ))}
          <button
            type="button"
            className="text-sm underline text-[#FFD700]"
            onClick={() =>
              setRows((all) => ({ ...all, [cat]: [...all[cat], blankRow(all[cat].length + 1)] }))
            }
          >
            + Add row
          </button>
        </fieldset>
      ))}
      {match.tournament?.sport?.id && (
        <AddLobbyTeam sportId={match.tournament.sport.id} game="Athletics" onAdded={onTeamAdded} />
      )}
    </div>
  );
}

/** "+ Add team": registers another Free Fire / BGMI team for a college. */
function AddLobbyTeam({
  sportId,
  game,
  onAdded,
}: {
  sportId: string;
  game: 'Free Fire' | 'BGMI' | 'Valorant' | 'Athletics';
  onAdded: (team: Team) => void;
}) {
  const [open, setOpen] = useState(false);
  const [added, setAdded] = useState('');
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [instituteId, setInstituteId] = useState('');
  const [squad, setSquad] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!open || institutes.length) return;
    let live = true;
    apiAuthedGet<Institute[]>('/institutes')
      .then((list) => live && setInstitutes(list))
      .catch(() => live && setMessage('Could not load the colleges.'));
    return () => {
      live = false;
    };
  }, [open, institutes.length]);
  async function add() {
    setBusy(true);
    setMessage('');
    try {
      const team = await apiPost<Team>('/lobby-teams', {
        sportId,
        instituteId,
        game,
        ...(squad.trim() ? { squad: squad.trim() } : {}),
      });
      setSquad('');
      setOpen(false);
      setAdded(team?.name ? `Added “${team.name}”. It is now in the list above.` : 'Team added.');
      onAdded(team);
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!open)
    return (
      <div className="space-y-1">
        <button
          type="button"
          className="text-sm underline text-[#FFD700]"
          onClick={() => {
            setAdded('');
            setOpen(true);
          }}
        >
          + Add team
        </button>
        {added && (
          <p role="status" className="text-sm text-emerald-300">
            {added}
          </p>
        )}
      </div>
    );
  return (
    <fieldset className="space-y-2 rounded border border-white/15 p-3">
      <legend className="px-1 text-sm font-bold text-[#FFD700]">
        {game === 'Athletics' ? 'Add a college team' : `Add a ${game} team`}
      </legend>
      <p className="text-xs text-zinc-400">
        {game === 'Athletics'
          ? 'One athletics team per college. Name its athletes in each result.'
          : 'A college can field more than one team. Leave the squad name empty for its first team; further teams are numbered automatically (Team 2, Team 3…).'}
      </p>
      <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
        <select
          aria-label="College"
          className={box}
          value={instituteId}
          onChange={(e) => setInstituteId(e.target.value)}
        >
          <option value="">Choose college…</option>
          {institutes.map((i) => (
            <option key={i.id} value={i.id}>
              {i.shortName || i.name}
            </option>
          ))}
        </select>
        {game !== 'Athletics' ? (
          <input
            aria-label="Squad name"
            className={box}
            placeholder="Squad name (optional)"
            maxLength={40}
            value={squad}
            onChange={(e) => setSquad(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (instituteId && !busy) void add();
              }
            }}
          />
        ) : (
          <span />
        )}
        <button
          type="button"
          disabled={busy || !instituteId}
          className="bg-[#800020] rounded px-3 py-2 disabled:opacity-50"
          onClick={() => void add()}
        >
          Add
        </button>
      </div>
      {message && (
        <p role="alert" className="text-sm text-red-300">
          {message}
        </p>
      )}
      <button
        type="button"
        className="text-xs underline text-zinc-400"
        onClick={() => setOpen(false)}
      >
        Cancel
      </button>
    </fieldset>
  );
}

/**
 * Position of each team in a lobby, from the points alone: highest total first;
 * level teams are split by the game's own rule (Free Fire: kill points then
 * placement points; BGMI: placement points then kill points); teams level on
 * everything share a position. Mirrors the server, which recomputes it.
 */
function lobbyPositions(
  rows: { teamId: string; kills: number; pp: number; kp: number }[],
  bgmi: boolean,
): Map<string, number> {
  const key = (r: { kills: number; pp: number; kp: number }) => [
    r.pp + r.kp,
    bgmi ? r.pp : r.kp,
    bgmi ? r.kp : r.pp,
  ];
  const cmp = (x: (typeof rows)[number], y: (typeof rows)[number]) => {
    const kx = key(x);
    const ky = key(y);
    for (let i = 0; i < kx.length; i++) if (kx[i] !== ky[i]) return ky[i] - kx[i];
    return 0;
  };
  const sorted = [...rows].sort(cmp);
  const out = new Map<string, number>();
  sorted.forEach((r, i) =>
    out.set(
      r.teamId,
      i > 0 && cmp(sorted[i - 1], r) === 0 ? out.get(sorted[i - 1].teamId)! : i + 1,
    ),
  );
  return out;
}

function LobbyForm({
  match,
  teams,
  emit,
  onTeamAdded,
}: {
  match: Match;
  teams: Team[];
  emit: (p: Payload | null) => void;
  onTeamAdded: (team: Team) => void;
}) {
  const game = /bgmi/i.test(match.matchNumber ?? '') ? 'BGMI' : 'Free Fire';
  const field = useMemo(
    () => teams.filter((t) => t.name.toLowerCase().includes(`(${game.toLowerCase()}`)),
    [teams, game],
  );
  // Only what the coordinator types per team; positions are calculated.
  const [edits, setEdits] = useState<Record<string, { kills: string; pp: string; kp: string }>>({});
  const read = (id: string) => edits[id] ?? { kills: '', pp: '', kp: '' };
  const played = useMemo(
    () =>
      field
        .map((t) => {
          const e = edits[t.id] ?? { kills: '', pp: '', kp: '' };
          const touched = e.kills.trim() !== '' || e.pp.trim() !== '' || e.kp.trim() !== '';
          const kills = Number(e.kills || 0);
          return {
            teamId: t.id,
            touched,
            kills,
            pp: Number(e.pp || 0),
            kp: e.kp.trim() === '' ? kills : Number(e.kp),
          };
        })
        .filter((r) => r.touched),
    [field, edits],
  );
  const positions = useMemo(() => lobbyPositions(played, game === 'BGMI'), [played, game]);
  useEffect(() => {
    emit(
      played.length >= 2
        ? {
            kind: 'LOBBY',
            entries: played.map((r) => ({
              teamId: r.teamId,
              kills: r.kills,
              placementPoints: r.pp,
              killPoints: r.kp,
            })),
          }
        : null,
    );
  }, [played, emit]);
  const upd = (id: string, patch: Partial<{ kills: string; pp: string; kp: string }>) =>
    setEdits((all) => ({
      ...all,
      [id]: { ...(all[id] ?? { kills: '', pp: '', kp: '' }), ...patch },
    }));
  const ordered = field; // stable order while typing; only the position is calculated
  return (
    <div className="space-y-2">
      <Legend>
        {game} game: for every team that played, enter its <strong>kills</strong> and its{' '}
        <strong>placement points (PP)</strong> from the results screen. Kill points (KP) default to
        the kills, so type a value only if they differ. The position is calculated automatically
        from the total points
        {game === 'BGMI'
          ? ' (a tie goes to the higher placement points, then kill points)'
          : ' (a tie goes to the higher kill points, then placement points)'}
        . Leave a team blank if it did not play. The overall table adds up every game.
      </Legend>
      {field.length === 0 && (
        <p className="text-sm text-zinc-400">
          No {game} teams yet. Add each team with <strong>+ Add team</strong> below.
        </p>
      )}
      {ordered.map((t) => {
        const e = read(t.id);
        const row = played.find((r) => r.teamId === t.id);
        const pos = positions.get(t.id);
        const cell = 'text-[10px] uppercase tracking-widest text-zinc-400';
        return (
          <div key={t.id} className="space-y-2 rounded-lg border border-white/10 p-3">
            {/* The team name gets the full width and wraps — long names stay readable. */}
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 break-words text-sm font-semibold leading-snug">{t.name}</p>
              <span
                title="Position: calculated automatically from the points"
                className={`shrink-0 rounded px-2 py-0.5 font-mono text-sm font-bold ${
                  pos === 1 ? 'bg-[#FFD700]/15 text-[#FFD700]' : 'bg-white/10 text-zinc-300'
                }`}
              >
                {pos ? `Pos ${pos}` : 'Pos —'}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <label className={cell}>
                Kills
                <input
                  aria-label={`Kills ${t.name}`}
                  className={numBox}
                  type="number"
                  min={0}
                  value={e.kills}
                  onChange={(ev) => upd(t.id, { kills: ev.target.value })}
                />
              </label>
              <label className={cell}>
                PP
                <input
                  aria-label={`Placement points ${t.name}`}
                  className={numBox}
                  type="number"
                  min={0}
                  value={e.pp}
                  onChange={(ev) => upd(t.id, { pp: ev.target.value })}
                />
              </label>
              <label className={cell}>
                KP
                <input
                  aria-label={`Kill points ${t.name}`}
                  className={numBox}
                  type="number"
                  min={0}
                  placeholder={String(Number(e.kills || 0))}
                  value={e.kp}
                  onChange={(ev) => upd(t.id, { kp: ev.target.value })}
                />
              </label>
              <div className={cell}>
                Total
                <p className="mt-1 rounded border border-transparent p-2 text-center font-mono text-lg font-bold text-[#FFD700]">
                  {row ? row.pp + row.kp : '—'}
                </p>
              </div>
            </div>
          </div>
        );
      })}
      {match.tournament?.sport?.id && (
        <AddLobbyTeam sportId={match.tournament.sport.id} game={game} onAdded={onTeamAdded} />
      )}
    </div>
  );
}

// -------------------------------------------------------------------- SCORE
function ScoreForm({ names, emit }: { names: SideNames; emit: (p: Payload | null) => void }) {
  const [s, setS] = useState({ a: '', b: '' });
  useEffect(() => {
    emit(filled(s.a) && filled(s.b) ? { kind: 'SCORE', a: n(s.a), b: n(s.b) } : null);
  }, [s, emit]);
  return (
    <div className="space-y-2">
      <Heads names={names} />
      <PairRow
        label="Final score"
        a={s.a}
        b={s.b}
        max={1000}
        onA={(v) => setS((x) => ({ ...x, a: v }))}
        onB={(v) => setS((x) => ({ ...x, b: v }))}
      />
    </div>
  );
}

// --------------------------------------------------------------------- MAIN
export const KIND_TITLE: Record<ResultKind, string> = {
  SETS: 'Enter set-wise result',
  GAMES: 'Enter game-wise result',
  QUARTERS: 'Enter quarter-wise result',
  CRICKET: 'Enter match result',
  FOOTBALL: 'Enter match result',
  CHESS: 'Enter board-wise result',
  TRACK: 'Enter event results',
  LOBBY: 'Enter lobby results',
  SCORE: 'Enter final result',
};

/**
 * Sport-specific final-result entry. The server validates the scorecard and
 * derives the winner and headline score, so this form only collects facts.
 */
export function ResultEntryForm({ match, onSaved }: { match: Match; onSaved: () => void }) {
  const kind = resultKindFor(match.tournament?.sport?.name, match.matchNumber);
  const ranked = isRankedKind(kind);
  const [payload, setPayload] = useState<Payload | null>(null);
  const [winner, setWinner] = useState('');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [pickA, setPickA] = useState('');
  const [pickB, setPickB] = useState('');
  const names = useMemo<SideNames>(
    () => ({
      a: match.teamA?.name || teams.find((t) => t.id === pickA)?.name || 'Team A',
      b: match.teamB?.name || teams.find((t) => t.id === pickB)?.name || 'Team B',
    }),
    [match.teamA?.name, match.teamB?.name, teams, pickA, pickB],
  );
  const sportId = match.tournament?.sport?.id;
  const [teamsVersion, setTeamsVersion] = useState(0);
  // E-Sports (Valorant) matches are created without teams: the coordinator
  // picks or adds the two teams here before entering the score.
  const pickTeams =
    kind === 'SCORE' &&
    /e-?sports/i.test(match.tournament?.sport?.name ?? '') &&
    (!match.teamAId || !match.teamBId);
  const addTeam = (t: Team) => {
    if (t?.id && t.name) setTeams((all) => (all.some((x) => x.id === t.id) ? all : [...all, t]));
    setTeamsVersion((v) => v + 1);
  };
  useEffect(() => {
    if (!(ranked || pickTeams) || !sportId) return;
    let live = true;
    apiAuthedGet<Team[]>(`/teams?sportId=${sportId}`)
      .then((t) => live && setTeams(t))
      .catch(() => live && setTeams([]));
    return () => {
      live = false;
    };
  }, [ranked, pickTeams, sportId, teamsVersion]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!payload) {
      setError(true);
      setMessage('Complete the scorecard before submitting.');
      return;
    }
    if (pickTeams && (!pickA || !pickB || pickA === pickB)) {
      setError(true);
      setMessage('Choose the two different teams that played this match.');
      return;
    }
    setBusy(true);
    setMessage('');
    setError(false);
    try {
      if (pickTeams) await apiPatch(`/matches/${match.id}`, { teamAId: pickA, teamBId: pickB });
      await apiPost(`/matches/${match.id}/result`, {
        scoreDetails: payload,
        ...(winner ? { winnerTeamId: winner } : {}),
        ...(notes.trim() ? { notes } : {}),
      });
      setDone(true);
      setMessage(
        'Final result submitted for approval. Publish it from Approvals to update standings and advance the bracket.',
      );
      onSaved();
    } catch (err) {
      setError(true);
      setMessage((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const needTeams = !ranked && !pickTeams && (!match.teamAId || !match.teamBId);
  return (
    <form aria-label="Enter final result" onSubmit={submit} className="space-y-4">
      <h4 className="font-bold">{KIND_TITLE[kind]}</h4>
      {needTeams && (
        <p role="note" className="text-amber-300 text-sm">
          Both teams must be decided (the earlier rounds published) before a result can be entered.
        </p>
      )}
      {kind === 'SETS' && (
        <SetsForm
          names={names}
          emit={setPayload}
          bestOf={/volleyball/i.test(match.tournament?.sport?.name ?? '') ? 5 : 3}
        />
      )}
      {kind === 'GAMES' && (
        <GamesForm
          names={names}
          emit={setPayload}
          cfg={
            gamesConfigFor(match.tournament?.sport?.name) ?? {
              count: 5,
              playAll: false,
              unit: 'Game',
            }
          }
        />
      )}
      {kind === 'QUARTERS' && <QuartersForm names={names} emit={setPayload} />}
      {kind === 'CRICKET' && (
        <CricketForm match={match} names={names} emit={setPayload} setWinner={setWinner} />
      )}
      {kind === 'FOOTBALL' && <FootballForm names={names} emit={setPayload} />}
      {kind === 'CHESS' && <ChessForm match={match} names={names} emit={setPayload} />}
      {kind === 'TRACK' && (
        <TrackForm match={match} teams={teams} emit={setPayload} onTeamAdded={addTeam} />
      )}
      {kind === 'LOBBY' && (
        <LobbyForm match={match} teams={teams} emit={setPayload} onTeamAdded={addTeam} />
      )}
      {pickTeams && (
        <div className="space-y-3 rounded border border-white/15 p-3">
          <p className="text-sm text-zinc-300">
            This Valorant match has no teams yet. Choose the two teams that played, or add them.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                ['Team A', pickA, setPickA],
                ['Team B', pickB, setPickB],
              ] as const
            ).map(([label, value, set]) => (
              <label key={label} className="text-sm">
                {label}
                <select
                  aria-label={label}
                  className={box}
                  value={value}
                  onChange={(e) => set(e.target.value)}
                >
                  <option value="">Choose team…</option>
                  {teams
                    .filter((t) => /valorant/i.test(t.name))
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                </select>
              </label>
            ))}
          </div>
          {sportId && <AddLobbyTeam sportId={sportId} game="Valorant" onAdded={addTeam} />}
        </div>
      )}
      {kind === 'SCORE' && <ScoreForm names={names} emit={setPayload} />}
      <label className="block">
        Result notes
        <textarea
          className={`${box} mt-1`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={10000}
        />
      </label>
      {message && (
        <p
          role={error ? 'alert' : 'status'}
          className={error ? 'text-red-300' : 'text-emerald-300'}
        >
          {message}
        </p>
      )}
      <button
        type="submit"
        disabled={busy || done || needTeams}
        className="bg-[#800020] rounded px-4 py-2 disabled:opacity-50"
      >
        Submit final result
      </button>
    </form>
  );
}
