import { PublicPage } from '@/components/PublicPage';
import { PublicContent } from '@/components/PublicContent';
export const dynamic = 'force-dynamic';
export const metadata = { title: "Organizing Committee | Convoquer'26" };
export default function CommitteePage() {
  return (
    <PublicPage title="Organizing Committee">
      <PublicContent kind="COMMITTEE" />
    </PublicPage>
  );
}
