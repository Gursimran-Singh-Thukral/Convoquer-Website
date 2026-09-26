'use client';
import { useState } from 'react';
import Link from 'next/link';
import { apiPatch, apiPost, type Match } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export function FixtureResultEditor({ match, onSaved }: { match: Match; onSaved: () => void }) {
  const { hasPermission } = useAuth();
  const [mode, setMode] = useState(match.scoringMode || 'LIVE');
  const [scoreA, setScoreA] = useState(String(match.teamAScore ?? ''));
  const [scoreB, setScoreB] = useState(String(match.teamBScore ?? ''));
  const [winner, setWinner] = useState('');
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
      await apiPost(`/matches/${match.id}/result`, {
        finalScoreA: Number(scoreA),
        finalScoreB: Number(scoreB),
        ...(winner ? { winnerTeamId: winner } : {}),
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
  const input = 'block w-full bg-zinc-900 border border-white/20 rounded p-2 mt-1';
  return (
    <section className="space-y-4">
      <label className="block">
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
      {message && <p role="status">{message}</p>}
      {hasPermission('result.submit') &&
        !['CANCELLED', 'ABANDONED', 'BYE'].includes(match.status) && (
          <form aria-label="Enter final result" onSubmit={submit} className="space-y-3">
            <h4 className="font-bold">Enter final result</h4>
            <div className="grid grid-cols-2 gap-3">
              <label>
                {match.teamA?.name || 'Team A'} final score
                <input
                  aria-label="Team A final score"
                  required
                  type="number"
                  min={0}
                  step="any"
                  value={scoreA}
                  onChange={(e) => setScoreA(e.target.value)}
                  className={input}
                />
              </label>
              <label>
                {match.teamB?.name || 'Team B'} final score
                <input
                  aria-label="Team B final score"
                  required
                  type="number"
                  min={0}
                  step="any"
                  value={scoreB}
                  onChange={(e) => setScoreB(e.target.value)}
                  className={input}
                />
              </label>
            </div>
            <label className="block">
              Winner
              <select className={input} value={winner} onChange={(e) => setWinner(e.target.value)}>
                <option value="">Determine from scores (equal scores = draw)</option>
                {match.teamA && <option value={match.teamA.id}>{match.teamA.name}</option>}
                {match.teamB && <option value={match.teamB.id}>{match.teamB.name}</option>}
              </select>
            </label>
            <label className="block">
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
              disabled={busy || submitted || !match.teamAId || !match.teamBId}
              className="bg-[#800020] rounded px-4 py-2 disabled:opacity-50"
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
