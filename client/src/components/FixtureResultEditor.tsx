'use client';
import { useState } from 'react';
import Link from 'next/link';
import { apiPatch, apiPost, teamCodeFromName, type Match } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { SETS_AND_GAMES_SPORTS, type GameRecord } from '@/lib/scoreDetails';

// Local game-entry row: points can be blank mid-edit, unlike GameRecord's
// required numbers — reconciled into GameRecord shape only on submit.
interface GameInput {
  a: string;
  b: string;
}

function gameWinnerId(g: GameInput, match: Match): string | null {
  const a = Number(g.a);
  const b = Number(g.b);
  if (g.a === '' || g.b === '' || a === b) return null;
  return a > b ? (match.teamAId ?? null) : (match.teamBId ?? null);
}

export function FixtureResultEditor({ match, onSaved }: { match: Match; onSaved: () => void }) {
  const { hasPermission } = useAuth();
  const [mode, setMode] = useState(match.scoringMode || 'LIVE');
  const sportName = (match.tournament?.sport?.name || '').trim().toUpperCase();
  const isSetsAndGamesSport = SETS_AND_GAMES_SPORTS.includes(sportName);

  const [scoreA, setScoreA] = useState(String(match.teamAScore ?? ''));
  const [scoreB, setScoreB] = useState(String(match.teamBScore ?? ''));

  // Sets-and-games sports (table tennis, badminton, squash, volleyball) score
  // by games won, derived from each game's point score — never typed directly
  // — mirroring server/src/modules/scoring/engines/setsAndGames.ts.
  const existingGames = (match.scoreDetails as { games?: GameRecord[] } | null)?.games;
  const [games, setGames] = useState<GameInput[]>(
    existingGames?.length
      ? existingGames.map((g) => ({ a: String(g.teamAPoints), b: String(g.teamBPoints) }))
      : [{ a: '', b: '' }],
  );
  const [bestOf, setBestOf] = useState(5);
  const gamesWon = games.reduce(
    (acc, g) => {
      const w = gameWinnerId(g, match);
      if (w && w === match.teamAId) acc.a += 1;
      else if (w && w === match.teamBId) acc.b += 1;
      return acc;
    },
    { a: 0, b: 0 },
  );

  const [winner, setWinner] = useState('');
  const [wentToPenalties, setWentToPenalties] = useState(
    Boolean((match.scoreDetails as { shootout?: unknown } | null)?.shootout),
  );
  const existingShootout = (
    match.scoreDetails as { shootout?: { teamA?: number; teamB?: number } } | null
  )?.shootout;
  const [penA, setPenA] = useState(String(existingShootout?.teamA ?? ''));
  const [penB, setPenB] = useState(String(existingShootout?.teamB ?? ''));
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const canChangeMode =
    !submitted &&
    hasPermission('competition.manage') &&
    ['SCHEDULED', 'READY', 'RESCHEDULED'].includes(match.status);
  async function changeMode(value: string) {
    if (value !== 'LIVE' && value !== 'RESULT_ONLY') return;
    setBusy(true);
    setMessage('');
    try {
      await apiPatch(`/matches/${match.id}`, { scoringMode: value });
      setMode(value);
      onSaved();
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      // A shootout only decides the winner, never the recorded final score —
      // mirrors the live football engine's own scoreDetails.shootout shape
      // (server/src/modules/scoring/engines/football.engine.ts) so a manually
      // entered result reads the same way as one that went through live scoring.
      const shootoutWinner =
        wentToPenalties && penA !== '' && penB !== '' && Number(penA) !== Number(penB)
          ? Number(penA) > Number(penB)
            ? match.teamAId
            : match.teamBId
          : undefined;

      // For sets-and-games sports, the score IS the games-won tally and
      // scoreDetails.games mirrors server/src/modules/scoring/engines/setsAndGames.ts's
      // GameRecord shape, so a manually entered result reads the same as one
      // played out live.
      const playedGames = games.filter((g) => g.a !== '' || g.b !== '');
      const gamesWinner =
        isSetsAndGamesSport && gamesWon.a !== gamesWon.b
          ? gamesWon.a > gamesWon.b
            ? match.teamAId
            : match.teamBId
          : undefined;

      await apiPost(`/matches/${match.id}/result`, {
        finalScoreA: isSetsAndGamesSport ? gamesWon.a : Number(scoreA),
        finalScoreB: isSetsAndGamesSport ? gamesWon.b : Number(scoreB),
        ...(winner
          ? { winnerTeamId: winner }
          : isSetsAndGamesSport && gamesWinner
            ? { winnerTeamId: gamesWinner }
            : shootoutWinner
              ? { winnerTeamId: shootoutWinner }
              : {}),
        ...(isSetsAndGamesSport && playedGames.length
          ? {
              scoreDetails: {
                config: { pointsPerGame: 11, bestOfGames: bestOf },
                games: playedGames.map((g) => ({
                  teamAPoints: Number(g.a) || 0,
                  teamBPoints: Number(g.b) || 0,
                  winnerTeamId: gameWinnerId(g, match),
                })),
                gamesWon: { teamA: gamesWon.a, teamB: gamesWon.b },
              },
            }
          : wentToPenalties && penA !== '' && penB !== ''
            ? { scoreDetails: { shootout: { teamA: Number(penA), teamB: Number(penB) } } }
            : {}),
        notes,
      });
      setSubmitted(true);
      setMessage(
        'Final result submitted for approval. Publish it from Approvals to update standings and advance the bracket.',
      );
      onSaved();
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const input =
    'block w-full bg-[#201d24] border border-white/15 rounded-lg p-2.5 mt-1.5 text-sm text-white focus:outline-none focus:border-[#FFD700]/60';
  const canSubmitResult =
    hasPermission('result.submit') && !['CANCELLED', 'ABANDONED', 'BYE'].includes(match.status);

  return (
    <section className="space-y-5">
      {/* Scoreboard card — crest / name / score / score / name / crest,
          the same layout as the fixture card on the public results page,
          but editable. */}
      <div className="rounded-2xl bg-[#17171a] border border-[#FFD700]/20 p-5 space-y-4">
        <div className="flex items-center justify-center">
          <span className="px-2.5 py-1 rounded-full bg-[#201d24] border border-[#FFD700]/25 text-[10px] font-mono font-bold uppercase tracking-widest text-[#FFD700]">
            {mode === 'LIVE' ? 'Live scoring' : 'Results only'} · {match.status}
          </span>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="flex flex-col items-center gap-2 min-w-0">
            <span className="w-12 h-12 rounded-full bg-[#201d24] border border-[#FFD700]/30 text-[#e5c158] font-black text-sm flex items-center justify-center shrink-0">
              {teamCodeFromName(match.teamA?.name)}
            </span>
            <span className="text-xs font-bold text-white text-center truncate w-full">
              {match.teamA?.name || 'Team A'}
            </span>
          </div>

          {isSetsAndGamesSport ? (
            // Games-won isn't typed directly — it's derived from the games
            // entered below, the way the live scoring engine computes it.
            <div className="flex flex-col items-center gap-0.5">
              <div className="flex items-center gap-2">
                <span className="w-14 text-center font-mono text-2xl font-bold text-white">
                  {gamesWon.a}
                </span>
                <span className="text-neutral-500 text-lg">–</span>
                <span className="w-14 text-center font-mono text-2xl font-bold text-white">
                  {gamesWon.b}
                </span>
              </div>
              <span className="text-[9.5px] uppercase tracking-widest text-neutral-500">Games</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input
                aria-label="Team A final score"
                required
                type="number"
                min={0}
                step="any"
                disabled={!canSubmitResult}
                value={scoreA}
                onChange={(e) => setScoreA(e.target.value)}
                className="w-14 text-center font-mono text-2xl font-bold bg-[#201d24] border border-white/15 rounded-lg py-1.5 focus:outline-none focus:border-[#FFD700]/60 disabled:opacity-50"
              />
              <span className="text-neutral-500 text-lg">–</span>
              <input
                aria-label="Team B final score"
                required
                type="number"
                min={0}
                step="any"
                disabled={!canSubmitResult}
                value={scoreB}
                onChange={(e) => setScoreB(e.target.value)}
                className="w-14 text-center font-mono text-2xl font-bold bg-[#201d24] border border-white/15 rounded-lg py-1.5 focus:outline-none focus:border-[#FFD700]/60 disabled:opacity-50"
              />
            </div>
          )}

          <div className="flex flex-col items-center gap-2 min-w-0">
            <span className="w-12 h-12 rounded-full bg-[#201d24] border border-[#FFD700]/30 text-[#e5c158] font-black text-sm flex items-center justify-center shrink-0">
              {teamCodeFromName(match.teamB?.name)}
            </span>
            <span className="text-xs font-bold text-white text-center truncate w-full">
              {match.teamB?.name || 'Team B'}
            </span>
          </div>
        </div>

        {canSubmitResult && sportName === 'FOOTBALL' && (
          <div className="flex flex-col items-center gap-2.5 pt-1">
            <label className="flex items-center gap-1.5 text-xs text-neutral-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={wentToPenalties}
                onChange={(e) => {
                  setWentToPenalties(e.target.checked);
                  if (!e.target.checked) {
                    setPenA('');
                    setPenB('');
                  }
                }}
                className="accent-[#FFD700] w-3.5 h-3.5"
              />
              Decided on penalties
            </label>
            {wentToPenalties && (
              <div className="flex items-center gap-2">
                <span className="text-[9.5px] uppercase tracking-widest text-neutral-500 mr-0.5">
                  Pens
                </span>
                <input
                  aria-label="Team A penalty score"
                  type="number"
                  min={0}
                  value={penA}
                  onChange={(e) => setPenA(e.target.value)}
                  className="w-9 text-center font-mono text-sm font-bold bg-[#201d24] text-[#e5c158] border border-white/15 rounded-md py-1 focus:outline-none focus:border-[#FFD700]/60"
                />
                <span className="text-neutral-500 text-xs">–</span>
                <input
                  aria-label="Team B penalty score"
                  type="number"
                  min={0}
                  value={penB}
                  onChange={(e) => setPenB(e.target.value)}
                  className="w-9 text-center font-mono text-sm font-bold bg-[#201d24] text-[#e5c158] border border-white/15 rounded-md py-1 focus:outline-none focus:border-[#FFD700]/60"
                />
              </div>
            )}
          </div>
        )}

        {canSubmitResult && isSetsAndGamesSport && (
          <div className="pt-1 border-t border-dashed border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] font-bold uppercase tracking-widest text-neutral-400">
                Game-by-game score
              </span>
              <div className="flex gap-1 bg-[#201d24] border border-white/10 rounded-full p-0.5">
                {[3, 5, 7].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => {
                      setBestOf(n);
                      if (games.length > n) setGames(games.slice(0, n));
                    }}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                      bestOf === n ? 'bg-[#882236] text-white' : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    Bo{n}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              {games.map((g, i) => (
                <div key={i} className="grid grid-cols-[auto_1fr_auto_1fr_auto] items-center gap-2">
                  <span className="text-[11px] font-mono text-neutral-500 w-4 text-center">
                    {i + 1}
                  </span>
                  <input
                    aria-label={`Game ${i + 1} Team A points`}
                    type="number"
                    min={0}
                    value={g.a}
                    onChange={(e) => {
                      const next = [...games];
                      next[i] = { ...next[i], a: e.target.value };
                      setGames(next);
                    }}
                    className={`w-full text-center font-mono text-sm font-semibold bg-[#201d24] border rounded-lg py-1.5 focus:outline-none focus:border-[#FFD700]/60 ${
                      gameWinnerId(g, match) === match.teamAId
                        ? 'border-[#FFD700]/60 text-[#e5c158]'
                        : 'border-white/15 text-white'
                    }`}
                  />
                  <span className="text-neutral-500 text-xs text-center">–</span>
                  <input
                    aria-label={`Game ${i + 1} Team B points`}
                    type="number"
                    min={0}
                    value={g.b}
                    onChange={(e) => {
                      const next = [...games];
                      next[i] = { ...next[i], b: e.target.value };
                      setGames(next);
                    }}
                    className={`w-full text-center font-mono text-sm font-semibold bg-[#201d24] border rounded-lg py-1.5 focus:outline-none focus:border-[#FFD700]/60 ${
                      gameWinnerId(g, match) === match.teamBId
                        ? 'border-[#FFD700]/60 text-[#e5c158]'
                        : 'border-white/15 text-white'
                    }`}
                  />
                  <button
                    type="button"
                    aria-label={`Remove game ${i + 1}`}
                    onClick={() => setGames(games.filter((_, idx) => idx !== i))}
                    disabled={games.length <= 1}
                    className="w-6 h-6 rounded-md flex items-center justify-center text-neutral-500 hover:text-[#e6724e] disabled:opacity-30"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setGames([...games, { a: '', b: '' }])}
              disabled={games.length >= bestOf}
              className="text-xs font-semibold text-[#e5c158] hover:text-[#FFD700] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              + Add game
            </button>
          </div>
        )}
      </div>

      <label className="block text-sm">
        Scoring mode
        <select
          aria-label="Scoring mode"
          className={input}
          value={mode}
          disabled={busy || !canChangeMode}
          onChange={(e) => void changeMode(e.target.value)}
        >
          <option value="LIVE">Live scoring</option>
          <option value="RESULT_ONLY">Results only</option>
        </select>
      </label>
      <p className="text-sm text-zinc-400">
        Results-only fixtures need no start, pause, or live score events. You can change the mode
        before a fixture starts.
      </p>
      {mode === 'LIVE' && (
        <Link className="underline text-[#FFD700]" href={`/scorer?matchId=${match.id}`}>
          Open live scorer
        </Link>
      )}
      {message && (
        <p role="status" className="text-sm text-[#FFD700]">
          {message}
        </p>
      )}
      {canSubmitResult && (
        <form aria-label="Enter final result" onSubmit={submit} className="space-y-3">
          <h4 className="font-bold text-white">Enter final result</h4>
          <label className="block text-sm">
            Winner
            <select className={input} value={winner} onChange={(e) => setWinner(e.target.value)}>
              <option value="">Determine from scores (equal scores = draw)</option>
              {match.teamA && <option value={match.teamA.id}>{match.teamA.name}</option>}
              {match.teamB && <option value={match.teamB.id}>{match.teamB.name}</option>}
            </select>
          </label>
          <label className="block text-sm">
            Result notes
            <textarea
              className={input}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={10000}
            />
          </label>
          <button
            type="submit"
            disabled={
              busy ||
              submitted ||
              !match.teamAId ||
              !match.teamBId ||
              (isSetsAndGamesSport && gamesWon.a === gamesWon.b)
            }
            className="bg-[#800020] hover:bg-[#990026] transition-colors rounded-lg px-4 py-2.5 font-bold text-sm uppercase tracking-wide disabled:opacity-50"
          >
            Submit final result
          </button>
        </form>
      )}
      <Link href="/results/approvals" className="underline text-[#FFD700]">
        Result approvals
      </Link>
    </section>
  );
}
