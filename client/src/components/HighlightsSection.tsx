'use client';

import Link from 'next/link';
import React, { useEffect, useMemo, useState } from 'react';
import { fetchMatches, teamCodeFromName, type Match } from '@/lib/api';
import { eventSubtitle, eventTitle, isTeamless } from '@/lib/matchDisplay';
import { ResultScorecard } from '@/components/results/ResultScorecard';
import { isResultDetails } from '@/lib/resultFormat';

type Tab = 'results' | 'upcoming';
const MAX_CARDS = 9;

const ist = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', ...opts });

function TeamRow({
  name,
  code,
  score,
  winner,
  host,
}: {
  name: string;
  code: string;
  score?: string;
  winner?: boolean;
  host?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className={`flex h-7 min-w-9 shrink-0 items-center justify-center rounded px-1 font-display text-[11px] ${
            host
              ? 'border border-[#D4AF37]/40 bg-[#701A2B]/80 font-semibold text-[#D4AF37]'
              : 'border border-white/10 bg-[#27242C] font-medium text-gray-300'
          }`}
        >
          {code}
        </span>
        <span
          className={`truncate text-sm ${winner ? 'font-bold text-white' : 'font-medium text-gray-300'}`}
          title={name}
        >
          {name}
        </span>
      </div>
      {score !== undefined && (
        <span
          className={`shrink-0 font-mono text-base font-bold ${winner ? 'text-[#D4AF37]' : 'text-gray-400'}`}
        >
          {score}
        </span>
      )}
    </div>
  );
}

function MatchCard({ m }: { m: Match }) {
  const live = m.status === 'LIVE';
  const done = m.status === 'COMPLETED';
  const sport = m.tournament?.sport?.name || 'Sport';
  const stage = m.stage?.name || '';
  const teamless = isTeamless(m);
  const winnerIsA = !!m.winnerTeamId && m.winnerTeamId === m.teamA?.id;
  const winnerIsB = !!m.winnerTeamId && m.winnerTeamId === m.teamB?.id;
  const codeOf = (t?: Match['teamA']) =>
    t ? teamCodeFromName(t.institute?.shortName || t.name).slice(0, 5) : '—';

  const when = `${ist(m.scheduledStartTime, { weekday: 'short', day: 'numeric', month: 'short' })} · ${ist(m.scheduledStartTime, { hour: '2-digit', minute: '2-digit', hour12: true })}`;
  return (
    <article
      data-purpose="match-card"
      className={`flex flex-col justify-between rounded-xl bg-[#1B191E] p-5 shadow-md transition-colors ${
        live
          ? 'border border-[#D95D39]/40 hover:border-[#D95D39]'
          : 'border border-[#D4AF37]/25 hover:border-[#D4AF37]/60'
      }`}
    >
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 text-[11px] font-medium uppercase leading-snug tracking-wider text-[#E5C158]">
            <span className="block truncate font-semibold">{sport}</span>
            {stage && <span className="block truncate text-gray-400">{stage}</span>}
          </p>
          <span
            className={`shrink-0 rounded px-2 py-0.5 font-mono text-[11px] font-semibold ${
              live
                ? 'bg-[#D95D39]/20 text-[#D95D39]'
                : done
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : 'bg-[#D4AF37]/10 text-[#D4AF37]'
            }`}
          >
            {live ? 'LIVE' : done ? 'FINAL' : 'UPCOMING'}
          </span>
        </div>

        {done ? (
          <ResultScorecard
            compact
            details={m.scoreDetails}
            teamA={m.teamA}
            teamB={m.teamB}
            scoreA={m.teamAScore}
            scoreB={m.teamBScore}
            winnerTeamId={m.winnerTeamId}
          />
        ) : (
          <>
            {teamless ? (
              <div className="rounded-lg border border-white/5 bg-[#151317] p-3.5">
                <p className="text-sm font-semibold leading-snug text-white">{eventTitle(m)}</p>
                <p className="mt-1 font-mono text-[11px] text-gray-400">{eventSubtitle(sport)}</p>
              </div>
            ) : (
              <div className="space-y-3 rounded-lg border border-white/5 bg-[#151317] p-3.5">
                <TeamRow
                  name={m.teamA?.name || 'To be decided'}
                  code={codeOf(m.teamA)}
                  winner={winnerIsA}
                  host={/iit jammu/i.test(m.teamA?.name ?? '')}
                />
                <TeamRow
                  name={m.teamB?.name || 'To be decided'}
                  code={codeOf(m.teamB)}
                  winner={winnerIsB}
                  host={/iit jammu/i.test(m.teamB?.name ?? '')}
                />
              </div>
            )}
          </>
        )}

        {!done && (
          <div className="space-y-0.5 text-xs text-gray-400">
            <p>{when} IST</p>
            <p className="truncate">{m.venue?.name || 'Venue to be announced'}</p>
          </div>
        )}
      </div>

      {!done && (
        <Link
          href={`/matches/${m.id}`}
          className="mt-5 block rounded border border-white/10 bg-[#201D24] py-2 text-center font-display text-xs font-medium uppercase tracking-wider text-[#E5C158] transition-colors hover:border-[#D4AF37]/30 hover:bg-[#701A2B]/60"
        >
          Fixture details
        </Link>
      )}
    </article>
  );
}

export const HighlightsSection: React.FC = () => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('results');
  const [chosen, setChosen] = useState(false);

  useEffect(() => {
    fetchMatches()
      .then((list) => setMatches(Array.isArray(list) ? list : []))
      .catch(() => setMatches([]))
      .finally(() => setIsLoading(false));
  }, []);

  const { results, upcoming } = useMemo(() => {
    const byTime = (a: Match, b: Match) =>
      new Date(a.scheduledStartTime).getTime() - new Date(b.scheduledStartTime).getTime();
    const completed = matches
      .filter(
        (m) =>
          m.status === 'COMPLETED' &&
          (isResultDetails(m.scoreDetails) || m.winnerTeamId || m.teamAScore !== null),
      )
      .sort((a, b) => byTime(b, a)); // newest first
    const open = matches
      .filter((m) => !['COMPLETED', 'CANCELLED', 'ABANDONED'].includes(m.status))
      .sort(byTime); // soonest first
    return { results: completed, upcoming: open };
  }, [matches]);

  // Before any result exists, open on Upcoming instead of an empty tab.
  const active: Tab = chosen ? tab : results.length ? 'results' : 'upcoming';
  const shown = (active === 'results' ? results : upcoming).slice(0, MAX_CARDS);

  const tabClass = (t: Tab) =>
    `rounded px-4 py-1.5 font-display text-xs font-semibold uppercase tracking-wider transition-colors ${
      active === t
        ? 'bg-[#701A2B] text-[#E5C158]'
        : 'border border-white/10 text-gray-400 hover:text-white'
    }`;

  return (
    <section
      className="border-b border-white/10 bg-[#151317] py-12"
      data-purpose="live-action-feed"
      id="highlights"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded border border-[#D95D39]/30 bg-[#D95D39]/15 px-2.5 py-0.5 font-display text-xs font-medium uppercase tracking-wider text-[#D95D39]">
              <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-[#D95D39]" />
              Tournament Feed
            </div>
            <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-white sm:text-3xl">
              ARENA ACTION FEED • <span className="text-[#D4AF37]">FIXTURES &amp; RESULTS</span>
            </h2>
          </div>
          <div className="flex gap-2" role="tablist" aria-label="Feed">
            <button
              type="button"
              role="tab"
              aria-selected={active === 'results'}
              className={tabClass('results')}
              onClick={() => {
                setChosen(true);
                setTab('results');
              }}
            >
              Results ({results.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={active === 'upcoming'}
              className={tabClass('upcoming')}
              onClick={() => {
                setChosen(true);
                setTab('upcoming');
              }}
            >
              Upcoming ({upcoming.length})
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="py-12 text-center font-mono text-sm text-gray-400">Loading…</div>
        ) : shown.length === 0 ? (
          <div className="mx-auto max-w-lg rounded-xl border border-white/10 bg-[#1B191E] p-8 text-center">
            <h3 className="font-display text-lg font-bold uppercase text-white">
              {active === 'results' ? 'No results yet' : 'Fixtures pending announcement'}
            </h3>
            <p className="mt-1 text-xs text-gray-400">
              {active === 'results'
                ? 'Official results appear here as soon as they are approved.'
                : 'Match draws and schedules will appear here automatically.'}
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((m) => (
                <MatchCard key={m.id} m={m} />
              ))}
            </div>
            <p className="mt-6 text-center text-sm">
              <Link
                href={active === 'results' ? '/results' : '/schedule'}
                className="text-[#D4AF37] underline"
              >
                {active === 'results' ? 'All official results →' : 'Full schedule →'}
              </Link>
            </p>
          </>
        )}
      </div>
    </section>
  );
};
