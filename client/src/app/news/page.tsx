import { PublicPage } from '@/components/PublicPage';
import { PublicContent } from '@/components/PublicContent';
export const dynamic = 'force-dynamic';
export const metadata = { title: "News | Convoquer'26" };
export default function NewsPage() {
  return (
    <PublicPage title="Festival News">
      <PublicContent kind="NEWS" />
    </PublicPage>
  );
}
