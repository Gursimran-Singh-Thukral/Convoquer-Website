import Link from 'next/link';
import { PublicPage } from '@/components/PublicPage';
import { apiGet, type Team } from '@/lib/api';
export const dynamic = 'force-dynamic';
export const metadata = { title: "Teams | Convoquer'26" };
export default async function TeamsPage() {
  let teams: Team[] = [];
  let failed = false;
  try {
    teams = await apiGet<Team[]>('/teams?status=ACTIVE');
  } catch {
    failed = true;
  }
  return (
    <PublicPage title="Participating Teams">
      {failed ? (
        <p role="alert">Teams are temporarily unavailable.</p>
      ) : !teams.length ? (
        <p>Teams will appear once the official roster is published.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => (
            <Link
              href={`/teams/${team.id}`}
              key={team.id}
              className="border border-white/20 rounded-xl p-6 hover:border-[#FFD700]"
            >
              <h2 className="text-xl">{team.name}</h2>
              <p className="text-zinc-400">{team.institute?.name}</p>
              <p className="text-[#FFD700]">{team.sport?.name}</p>
            </Link>
          ))}
        </div>
      )}
    </PublicPage>
  );
}
