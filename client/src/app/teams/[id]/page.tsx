import Link from 'next/link';
import { PublicPage } from '@/components/PublicPage';
import { apiGet, type Team, type Match } from '@/lib/api';
export const dynamic = 'force-dynamic';
export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let team: Team;
  let matches: Match[];
  try {
    [team, matches] = await Promise.all([
      apiGet<Team>(`/teams/${encodeURIComponent(id)}`),
      apiGet<Match[]>(`/matches?teamId=${encodeURIComponent(id)}`),
    ]);
  } catch {
    return (
      <PublicPage title="Team unavailable">
        <p role="alert">
          This team could not be loaded. Please check the team directory or try again.
        </p>
        <Link href="/teams">Team directory</Link>
      </PublicPage>
    );
  }
  return (
    <PublicPage title={team.name}>
      <p className="text-zinc-400 mb-8">
        {team.institute?.name} · {team.sport?.name}
      </p>
      <h2 className="text-2xl mb-4">Matches</h2>
      <ul className="space-y-4">
        {matches.map((match) => (
          <li key={match.id}>
            <Link className="underline text-[#FFD700]" href={`/matches/${match.id}`}>
              {match.teamA?.name || 'TBD'} vs {match.teamB?.name || 'TBD'}
            </Link>
            <p>
              {new Date(match.scheduledStartTime).toLocaleString('en-IN', {
                timeZone: 'Asia/Kolkata',
              })}{' '}
              IST · {match.status}
            </p>
          </li>
        ))}
      </ul>
      {!matches.length && <p>No fixtures published yet.</p>}
    </PublicPage>
  );
}
