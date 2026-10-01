import type { ReactNode } from 'react';
import {
  cricketResultText,
  dash,
  formatHalf,
  inningsLine,
  isResultDetails,
  teamLabel,
  type ChessDetails,
  type CricketDetails,
  type FootballDetails,
  type GamesDetails,
  type LobbyDetails,
  type QuartersDetails,
  type RankedEntry,
  type SetsDetails,
  type TrackDetails,
} from '@/lib/resultFormat';

export interface ScorecardTeam {
  id?: string | null;
  name?: string | null;
  shortName?: string | null;
  institute?: { shortName?: string | null } | null;
}

export interface ResultScorecardProps {
  details: unknown;
  teamA?: ScorecardTeam | null;
  teamB?: ScorecardTeam | null;
  scoreA?: number | null;
  scoreB?: number | null;
  winnerTeamId?: string | null;
  /** e.g. "Semifinal", shown as a chip above the scorecard. */
  stageName?: string | null;
  matchLabel?: string | null;
  /** Smaller type and no header chips, for list cards. */
  compact?: boolean;
}

const code = (t?: ScorecardTeam | null) => teamLabel(t);

const MEDAL = ['bg-[#FFD700] text-black', 'bg-zinc-300 text-black', 'bg-[#cd7f32] text-black'];

function Chip({
  children,
  tone = 'plain',
}: {
  children: ReactNode;
  tone?: 'plain' | 'gold' | 'maroon';
}) {
  const tones = {
    plain: 'bg-white/10 text-zinc-300',
    gold: 'bg-[#FFD700]/15 text-[#FFD700] border border-[#FFD700]/40',
    maroon: 'bg-[#800020] text-white',
  };
  return (
    <span
      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function Frame({
  children,
  label,
  stageName,
  compact,
}: {
  children: ReactNode;
  label: string;
  stageName?: string | null;
  compact?: boolean;
}) {
  return (
    <section
      aria-label="Official scorecard"
      className="rounded-xl border border-white/15 bg-[#151417] overflow-hidden"
    >
      {!compact && (
        <header className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-white/10 bg-black/30">
          <Chip tone="maroon">{label}</Chip>
          {stageName && <Chip>{stageName}</Chip>}
        </header>
      )}
      <div className={compact ? 'p-3' : 'p-4'}>{children}</div>
    </section>
  );
}

/** Scoreboard table: one row per team, winner highlighted and marked "W". */
function Board({
  columns,
  rows,
  compact,
}: {
  columns: string[];
  rows: {
    key: string;
    name: string;
    sub?: string;
    cells: ReactNode[];
    total: ReactNode;
    winner: boolean;
    totalLabel?: string;
  }[];
  compact?: boolean;
}) {
  const totalLabel = rows[0]?.totalLabel ?? 'T';
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-[10px] uppercase tracking-widest text-zinc-400">
            <th className="text-left font-semibold pb-2 pr-3">Team</th>
            {columns.map((c) => (
              <th key={c} scope="col" className="text-center font-semibold pb-2 px-2 min-w-9">
                {c}
              </th>
            ))}
            <th scope="col" className="text-center font-bold pb-2 pl-3 text-[#FFD700]">
              {totalLabel}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.key}
              className={`border-t border-white/10 ${r.winner ? 'bg-[#FFD700]/[0.07]' : ''}`}
            >
              <th scope="row" className="text-left pr-3 py-2 font-semibold">
                <span className="flex items-center gap-2">
                  <span
                    className={`inline-block w-1 h-5 rounded ${r.winner ? 'bg-[#FFD700]' : 'bg-transparent'}`}
                    aria-hidden
                  />
                  <span className={compact ? 'text-sm' : 'text-base'}>{r.name}</span>
                  {r.winner && (
                    <span className="text-[10px] font-black text-[#FFD700]" title="Winner">
                      W
                    </span>
                  )}
                </span>
                {r.sub && (
                  <span className="block pl-3 text-[11px] font-normal text-zinc-400">{r.sub}</span>
                )}
              </th>
              {r.cells.map((cell, i) => (
                <td
                  key={i}
                  className={`text-center px-2 font-mono tabular-nums ${r.winner ? 'text-white' : 'text-zinc-300'}`}
                >
                  {cell}
                </td>
              ))}
              <td
                className={`text-center pl-3 font-mono font-black tabular-nums ${compact ? 'text-lg' : 'text-2xl'} ${r.winner ? 'text-[#FFD700]' : 'text-white'}`}
              >
                {r.total}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ResultLine({ children }: { children: ReactNode }) {
  return (
    <p className="mt-3 text-center text-sm font-bold text-[#FFD700] tracking-wide">{children}</p>
  );
}

function sideOf(p: ResultScorecardProps): 'A' | 'B' | null {
  if (!p.winnerTeamId) return null;
  if (p.winnerTeamId === p.teamA?.id) return 'A';
  if (p.winnerTeamId === p.teamB?.id) return 'B';
  return null;
}

// ---------------------------------------------------------------------------

function Sets({ d, p }: { d: SetsDetails; p: ResultScorecardProps }) {
  const w = sideOf(p);
  const cols = d.sets.map((_, i) => `Set ${i + 1}`);
  const cell = (side: 'a' | 'b') =>
    d.sets.map((s, i) => (
      <span key={i} className={s[side] > s[side === 'a' ? 'b' : 'a'] ? 'font-bold text-white' : ''}>
        {s[side]}
      </span>
    ));
  return (
    <>
      <Board
        compact={p.compact}
        columns={cols}
        rows={[
          {
            key: 'a',
            name: code(p.teamA),
            sub: p.teamA?.name ?? undefined,
            cells: cell('a'),
            total: p.scoreA ?? 0,
            winner: w === 'A',
            totalLabel: 'Sets',
          },
          {
            key: 'b',
            name: code(p.teamB),
            sub: p.teamB?.name ?? undefined,
            cells: cell('b'),
            total: p.scoreB ?? 0,
            winner: w === 'B',
            totalLabel: 'Sets',
          },
        ]}
      />
      <ResultLine>
        {code(w === 'B' ? p.teamB : p.teamA)} won {w === 'B' ? p.scoreB : p.scoreA}
        {dash}
        {w === 'B' ? p.scoreA : p.scoreB} (
        {d.sets.map((s) => (w === 'B' ? `${s.b}${dash}${s.a}` : `${s.a}${dash}${s.b}`)).join(', ')})
      </ResultLine>
    </>
  );
}

function Games({ d, p }: { d: GamesDetails; p: ResultScorecardProps }) {
  const w = sideOf(p);
  const unit = d.unit ?? 'Game';
  const plural = unit === 'Match' ? 'Matches' : 'Games';
  const cols = d.games.map((_, i) => `${unit} ${i + 1}`);
  const cell = (side: 'setsA' | 'setsB') =>
    d.games.map((g, i) => (
      <span
        key={i}
        className={g[side] > g[side === 'setsA' ? 'setsB' : 'setsA'] ? 'font-bold text-white' : ''}
      >
        {g[side]}
      </span>
    ));
  const winner = w === 'B' ? p.teamB : p.teamA;
  return (
    <>
      <Board
        compact={p.compact}
        columns={cols}
        rows={[
          {
            key: 'a',
            name: code(p.teamA),
            sub: p.teamA?.name ?? undefined,
            cells: cell('setsA'),
            total: p.scoreA ?? 0,
            winner: w === 'A',
            totalLabel: plural,
          },
          {
            key: 'b',
            name: code(p.teamB),
            sub: p.teamB?.name ?? undefined,
            cells: cell('setsB'),
            total: p.scoreB ?? 0,
            winner: w === 'B',
            totalLabel: plural,
          },
        ]}
      />
      <ol className="mt-3 space-y-1 text-xs text-zinc-400">
        {d.games.map((g, i) => {
          const gw = g.setsA > g.setsB ? p.teamA : p.teamB;
          return (
            <li key={i} className="flex flex-wrap items-baseline gap-x-2">
              <span className="w-16 font-semibold uppercase tracking-wider text-zinc-300">
                {unit} {i + 1}
              </span>
              <span className="font-mono text-zinc-200">
                {g.sets.map((x) => `${x.a}${dash}${x.b}`).join(', ')}
              </span>
              <span>· {code(gw)}</span>
              {(g.playerA || g.playerB) && (
                <span className="text-zinc-500">
                  ({g.playerA || '—'} v {g.playerB || '—'})
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <ResultLine>
        {code(winner)} won {w === 'B' ? p.scoreB : p.scoreA}
        {dash}
        {w === 'B' ? p.scoreA : p.scoreB}{' '}
        {d.playAll
          ? `(${d.bestOf ?? d.games.length} ${plural.toLowerCase()} played)`
          : `(best of ${d.bestOf ?? 5} ${plural.toLowerCase()})`}
      </ResultLine>
    </>
  );
}

function Quarters({ d, p }: { d: QuartersDetails; p: ResultScorecardProps }) {
  const w = sideOf(p);
  const ot = d.overtime ?? [];
  const cols = ['Q1', 'Q2', 'Q3', 'Q4', ...ot.map((_, i) => (ot.length > 1 ? `OT${i + 1}` : 'OT'))];
  const all = [...d.periods, ...ot];
  return (
    <Board
      compact={p.compact}
      columns={cols}
      rows={[
        {
          key: 'a',
          name: code(p.teamA),
          sub: p.teamA?.name ?? undefined,
          cells: all.map((x) => x.a),
          total: p.scoreA ?? 0,
          winner: w === 'A',
          totalLabel: 'Final',
        },
        {
          key: 'b',
          name: code(p.teamB),
          sub: p.teamB?.name ?? undefined,
          cells: all.map((x) => x.b),
          total: p.scoreB ?? 0,
          winner: w === 'B',
          totalLabel: 'Final',
        },
      ]}
    />
  );
}

function Cricket({ d, p }: { d: CricketDetails; p: ResultScorecardProps }) {
  const w = sideOf(p);
  const first = d.battingFirst;
  const order: ('A' | 'B')[] = first === 'A' ? ['A', 'B'] : ['B', 'A'];
  return (
    <>
      <div className="space-y-2">
        {order.map((side, idx) => {
          const team = side === 'A' ? p.teamA : p.teamB;
          const inn = d.innings[side];
          const won = w === side;
          return (
            <div
              key={side}
              className={`flex items-center justify-between rounded-lg px-3 py-2 border ${won ? 'border-[#FFD700]/50 bg-[#FFD700]/[0.07]' : 'border-white/10 bg-white/[0.03]'}`}
            >
              <div>
                <p className="font-semibold">{code(team)}</p>
                <p className="text-[11px] text-zinc-400">{idx === 0 ? 'Batted first' : 'Chased'}</p>
              </div>
              <p className="text-right font-mono tabular-nums">
                <span
                  className={`font-black ${p.compact ? 'text-lg' : 'text-2xl'} ${won ? 'text-[#FFD700]' : ''}`}
                >
                  {inningsLine(inn)}
                </span>
                <span className="block text-xs text-zinc-400">({inn.overs} ov)</span>
              </p>
            </div>
          );
        })}
      </div>
      {d.superOver && (
        <p className="mt-2 text-center text-xs text-zinc-400">
          Super over: {code(p.teamA)} {d.superOver.a}
          {dash}
          {d.superOver.b} {code(p.teamB)}
        </p>
      )}
      <ResultLine>{cricketResultText(d, code(p.teamA), code(p.teamB), w)}</ResultLine>
      <p className="mt-1 text-center text-[11px] text-zinc-500">{d.overs} overs a side</p>
    </>
  );
}

function Football({ d, p }: { d: FootballDetails; p: ResultScorecardProps }) {
  const w = sideOf(p);
  const tag = d.penalties
    ? 'Full time · Penalties'
    : d.extraTime
      ? 'After extra time'
      : 'Full time';
  return (
    <>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
        <p className={`font-bold ${w === 'A' ? 'text-[#FFD700]' : ''}`}>{code(p.teamA)}</p>
        <p className="font-mono font-black text-4xl tabular-nums">
          {p.scoreA ?? 0}
          <span className="text-zinc-500 mx-1">{dash}</span>
          {p.scoreB ?? 0}
        </p>
        <p className={`font-bold ${w === 'B' ? 'text-[#FFD700]' : ''}`}>{code(p.teamB)}</p>
      </div>
      <p className="mt-1 text-center text-[11px] uppercase tracking-widest text-zinc-400">{tag}</p>
      {d.penalties && (
        <p className="mt-2 text-center text-sm">
          <span className="text-zinc-400">Penalty shoot-out </span>
          <span className="font-mono font-bold">
            {d.penalties.a}
            {dash}
            {d.penalties.b}
          </span>
          <span className="block text-[#FFD700] font-bold mt-1">
            {code(w === 'B' ? p.teamB : p.teamA)} win {Math.max(d.penalties.a, d.penalties.b)}
            {dash}
            {Math.min(d.penalties.a, d.penalties.b)} on penalties
          </span>
        </p>
      )}
      {(d.extraTime || d.penalties) && (
        <p className="mt-2 text-center text-[11px] text-zinc-500">
          Full time {d.regulation.a}
          {dash}
          {d.regulation.b}
          {d.extraTime && ` · Extra time ${d.extraTime.a}${dash}${d.extraTime.b}`}
        </p>
      )}
      {!d.penalties && !w && (p.scoreA ?? 0) === (p.scoreB ?? 0) && (
        <ResultLine>Match drawn</ResultLine>
      )}
    </>
  );
}

const boardMark = (a: number) => (a === 1 ? '1 – 0' : a === 0 ? '0 – 1' : '½ – ½');

function Chess({ d, p }: { d: ChessDetails; p: ResultScorecardProps }) {
  const w = sideOf(p);
  const boards = d.boards ?? [];
  const a = p.scoreA ?? 0;
  const b = p.scoreB ?? 0;
  return (
    <>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
        <p className={`font-bold ${w === 'A' ? 'text-[#FFD700]' : ''}`}>{code(p.teamA)}</p>
        <p className="font-mono font-black text-3xl tabular-nums">
          {formatHalf(a)}
          <span className="text-zinc-500 mx-1">{dash}</span>
          {formatHalf(b)}
        </p>
        <p className={`font-bold ${w === 'B' ? 'text-[#FFD700]' : ''}`}>{code(p.teamB)}</p>
      </div>
      {boards.length > 0 && (
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-zinc-400">
                <th className="text-left pb-1">Bd</th>
                <th className="text-left pb-1">{code(p.teamA)}</th>
                <th className="pb-1">Result</th>
                <th className="text-right pb-1">{code(p.teamB)}</th>
              </tr>
            </thead>
            <tbody>
              {boards.map((bd, i) => (
                <tr key={i} className="border-t border-white/10">
                  <td className="py-1 text-zinc-400">{i + 1}</td>
                  <td className="py-1">{bd.playerA || '—'}</td>
                  <td className="py-1 text-center font-mono">{boardMark(bd.a)}</td>
                  <td className="py-1 text-right">{bd.playerB || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ResultLine>
        {w
          ? `${code(w === 'A' ? p.teamA : p.teamB)} win ${formatHalf(Math.max(a, b))}${dash}${formatHalf(Math.min(a, b))}`
          : 'Match drawn'}
      </ResultLine>
      <p className="mt-1 text-center text-[11px] text-zinc-500">
        {w ? '2 match points to the winner' : '1 match point each'}
      </p>
    </>
  );
}

function Position({ rank }: { rank: number | null }) {
  if (rank === null) return <span className="text-zinc-500">—</span>;
  return rank <= 3 ? (
    <span
      className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-black ${MEDAL[rank - 1]}`}
    >
      {rank}
    </span>
  ) : (
    <span className="font-mono text-zinc-300">{rank}</span>
  );
}

function RankedTable({
  entries,
  lobby,
  showMedals,
  showQualified,
}: {
  entries: RankedEntry[];
  lobby?: boolean;
  showMedals?: boolean;
  showQualified?: boolean;
}) {
  const sorted = [...entries].sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] uppercase tracking-widest text-zinc-400">
            <th className="text-center pb-2 w-10">Pos</th>
            <th className="text-left pb-2 px-2">Team</th>
            {!lobby && <th className="text-left pb-2 px-2">Athlete</th>}
            {lobby ? (
              <>
                <th className="text-center pb-2 px-2">Kills</th>
                <th className="text-center pb-2 px-2" title="Placement points">
                  PP
                </th>
                <th className="text-center pb-2 px-2" title="Kill points">
                  KP
                </th>
                <th className="text-center pb-2 px-2 text-[#FFD700]">Total</th>
              </>
            ) : (
              <th className="text-right pb-2 px-2 text-[#FFD700]">Mark</th>
            )}
            {showQualified && <th className="text-center pb-2 px-2 w-10">Q</th>}
          </tr>
        </thead>
        <tbody>
          {sorted.map((e, i) => (
            <tr
              key={`${e.teamId}-${i}`}
              className={`border-t border-white/10 ${showMedals && e.rank === 1 ? 'bg-[#FFD700]/[0.07]' : ''}`}
            >
              <td className="text-center py-2">
                <Position rank={e.rank} />
              </td>
              <td className="px-2 font-semibold">
                {teamLabel({ name: e.teamName, shortName: e.shortName }, 'Team')}
                {e.shortName && e.teamName && (
                  <span className="block text-[11px] font-normal text-zinc-400">{e.teamName}</span>
                )}
              </td>
              {!lobby && <td className="px-2 text-zinc-300">{e.athlete || '—'}</td>}
              {lobby ? (
                <>
                  <td className="text-center px-2 font-mono">{e.kills ?? 0}</td>
                  <td className="text-center px-2 font-mono">{e.placementPoints ?? 0}</td>
                  <td className="text-center px-2 font-mono">{e.killPoints ?? e.kills ?? 0}</td>
                  <td className="text-center px-2 font-mono font-black text-[#FFD700]">
                    {e.points ?? 0}
                  </td>
                </>
              ) : (
                <td className="text-right px-2 font-mono tabular-nums">
                  {e.note ? (
                    <span className="text-amber-300 font-bold">{e.note}</span>
                  ) : (
                    e.mark || '—'
                  )}
                </td>
              )}
              {showQualified && (
                <td className="text-center px-2">
                  {e.qualified && (
                    <span className="text-emerald-400 font-black" title="Qualified for the final">
                      Q
                    </span>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Track({ d }: { d: TrackDetails }) {
  const semi = d.round === 'SEMIFINAL';
  return (
    <div className="space-y-5">
      {d.sections.map((s) => (
        <div key={s.category}>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-widest text-[#FFD700]">
            {s.category === 'Mixed' ? 'Mixed' : `${s.category}’s`}{' '}
            {semi ? 'Semi-final' : d.round === 'FINAL' ? 'Final' : 'Result'}
          </h4>
          <RankedTable entries={s.entries} showMedals={!semi} showQualified={semi} />
        </div>
      ))}
      {semi && (
        <p className="text-[11px] text-zinc-400">
          Q = qualified for the final · DNS did not start · DNF did not finish · DQ disqualified
        </p>
      )}
    </div>
  );
}

function Lobby({ d }: { d: LobbyDetails }) {
  return (
    <>
      {d.game && (
        <h4 className="mb-2 text-xs font-bold uppercase tracking-widest text-[#FFD700]">
          {d.game} · Lobby standings
        </h4>
      )}
      <RankedTable entries={d.entries} lobby showMedals />
    </>
  );
}

// ---------------------------------------------------------------------------

/** Official, sport-specific scorecard for a published final result. */
export function ResultScorecard(props: ResultScorecardProps) {
  const { details, teamA, teamB, stageName, compact } = props;
  const w = sideOf(props);
  if (!isResultDetails(details) || details.kind === 'SCORE') {
    const score =
      isResultDetails(details) && details.kind === 'SCORE'
        ? { a: details.a, b: details.b }
        : { a: props.scoreA ?? 0, b: props.scoreB ?? 0 };
    return (
      <Frame label="Final result" stageName={stageName} compact={compact}>
        <Board
          compact={compact}
          columns={[]}
          rows={[
            {
              key: 'a',
              name: code(teamA),
              sub: teamA?.name ?? undefined,
              cells: [],
              total: score.a,
              winner: w === 'A',
              totalLabel: 'Score',
            },
            {
              key: 'b',
              name: code(teamB),
              sub: teamB?.name ?? undefined,
              cells: [],
              total: score.b,
              winner: w === 'B',
              totalLabel: 'Score',
            },
          ]}
        />
      </Frame>
    );
  }
  const label =
    details.kind === 'TRACK'
      ? 'Official results'
      : details.kind === 'LOBBY'
        ? 'Lobby results'
        : 'Final result';
  return (
    <Frame label={label} stageName={stageName} compact={compact}>
      {details.kind === 'SETS' && <Sets d={details} p={props} />}
      {details.kind === 'GAMES' && <Games d={details} p={props} />}
      {details.kind === 'QUARTERS' && <Quarters d={details} p={props} />}
      {details.kind === 'CRICKET' && <Cricket d={details} p={props} />}
      {details.kind === 'FOOTBALL' && <Football d={details} p={props} />}
      {details.kind === 'CHESS' && <Chess d={details} p={props} />}
      {details.kind === 'TRACK' && <Track d={details} />}
      {details.kind === 'LOBBY' && <Lobby d={details} />}
    </Frame>
  );
}
