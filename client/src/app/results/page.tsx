import Link from 'next/link';
import { PublicPage } from '@/components/PublicPage';
import { ResultScorecard } from '@/components/results/ResultScorecard';
import { apiGet } from '@/lib/api';
export const dynamic = 'force-dynamic';
export const metadata = { title: "Official Results | Convoquer'26" };

interface Result {
  id: string;
  matchId: string;
  finalScoreA: number;
  finalScoreB: number;
  winnerTeamId?: string | null;
  scoreDetails?: Record<string, unknown> | null;
  publishedAt?: string | null;
  match: {
    matchNumber?: string | null;
    scheduledStartTime?: string;
    stage?: { name: string } | null;
    venue?: { name: string } | null;
    teamA?: { id: string; name: string } | null;
    teamB?: { id: string; name: string } | null;
    tournament: { name: string; sport: { name: string } };
  };
}

function when(iso?: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function ResultsPage() {
  let results: Result[] = [];
  let failed = false;
  try {
    results = await apiGet<Result[]>('/results');
  } catch {
    failed = true;
  }
  const bySport = new Map<string, Result[]>();
  for (const r of results) {
    const key = r.match.tournament.sport.name;
    bySport.set(key, [...(bySport.get(key) ?? []), r]);
  }
  return (
    <PublicPage title="Official Results">
      <p className="text-zinc-400 mb-8">
        Final results, approved and published by the respective Sports Coordinators.
      </p>
      {failed ? (
        <p role="alert">Results are temporarily unavailable. Please try again shortly.</p>
      ) : !results.length ? (
        <p>No official results have been published yet.</p>
      ) : (
        <div className="space-y-12">
          {[...bySport.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([sport, rows]) => (
              <section key={sport} aria-labelledby={`sport-${sport}`}>
                <h2
                  id={`sport-${sport}`}
                  className="text-xl font-bold uppercase tracking-wider text-[#FFD700] border-b border-white/15 pb-2 mb-5"
                >
                  {sport}
                </h2>
                <div className="grid items-start gap-5 lg:grid-cols-2">
                  {rows.map((result) => {
                    const m = result.match;
                    const title =
                      m.teamA && m.teamB
                        ? `${m.teamA.name} vs ${m.teamB.name}`
                        : (m.matchNumber ?? 'Result');
                    return (
                      <article key={result.id} className="space-y-2">
                        <Link
                          href={`/matches/${result.matchId}`}
                          className="block group"
                          aria-label={`${title} — open match centre`}
                        >
                          <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                            <span className="font-semibold group-hover:text-[#FFD700]">
                              {title}
                            </span>
                            <span className="text-xs text-zinc-400">
                              {[m.venue?.name, when(m.scheduledStartTime)]
                                .filter(Boolean)
                                .join(' · ')}
                            </span>
                          </p>
                        </Link>
                        <ResultScorecard
                          details={result.scoreDetails}
                          teamA={m.teamA}
                          teamB={m.teamB}
                          scoreA={result.finalScoreA}
                          scoreB={result.finalScoreB}
                          winnerTeamId={result.winnerTeamId}
                          stageName={m.stage?.name ?? m.matchNumber}
                        />
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
        </div>
      )}
    </PublicPage>
  );
}
