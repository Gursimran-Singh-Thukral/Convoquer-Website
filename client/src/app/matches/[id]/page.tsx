import { PublicPage } from '@/components/PublicPage';
import { MatchCenter } from '@/components/MatchCenter';
export const metadata = { title: "Match Center | Convoquer'26" };
export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PublicPage title="Match Center">
      <MatchCenter id={id} />
    </PublicPage>
  );
}
