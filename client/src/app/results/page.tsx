import Link from 'next/link';
import { PublicPage } from '@/components/PublicPage';
import { apiGet } from '@/lib/api';
export const dynamic = 'force-dynamic';
export const metadata = { title: "Official Results | Convoquer'26" };
interface Result {
  id: string;
  matchId: string;
  finalScoreA: number;
  finalScoreB: number;
  match: {
    teamA?: { name: string };
    teamB?: { name: string };
    tournament: { name: string; sport: { name: string } };
  };
}
export default async function ResultsPage() {
  let results: Result[] = [];
  let failed = false;
  try {
    results = await apiGet<Result[]>('/results');
  } catch {
    failed = true;
  }
  return (
    <PublicPage title="Official Results">
      <p className="text-zinc-400 mb-6">Only approved, published results appear here.</p>
      {failed ? (
        <p role="alert">Results are temporarily unavailable. Please try again shortly.</p>
      ) : !results.length ? (
        <p>No official results have been published yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {results.map((result) => (
            <Link
              href={`/matches/${result.matchId}`}
              className="block border border-white/20 rounded-xl p-6 hover:border-[#FFD700]"
              key={result.id}
            >
              <p className="text-sm text-[#FFD700] mb-3">
                {result.match.tournament.sport.name} · {result.match.tournament.name}
              </p>
              <p>
                {result.match.teamA?.name || 'TBD'}{' '}
                <strong className="float-right">{result.finalScoreA}</strong>
              </p>
              <p>
                {result.match.teamB?.name || 'TBD'}{' '}
                <strong className="float-right">{result.finalScoreB}</strong>
              </p>
            </Link>
          ))}
        </div>
      )}
    </PublicPage>
  );
}
