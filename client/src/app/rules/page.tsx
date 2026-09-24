import { PublicPage } from '@/components/PublicPage';
import { PublicContent } from '@/components/PublicContent';
export const dynamic = 'force-dynamic';
export const metadata = { title: "Rules & Regulations | Convoquer'26" };
export default function RulesPage() {
  return (
    <PublicPage title="Rules & Regulations">
      <PublicContent kind="RULES" />
    </PublicPage>
  );
}
