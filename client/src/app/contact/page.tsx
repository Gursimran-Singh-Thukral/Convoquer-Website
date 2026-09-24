import { PublicPage } from '@/components/PublicPage';
import { PublicContent } from '@/components/PublicContent';
export const dynamic = 'force-dynamic';
export const metadata = { title: "Contact | Convoquer'26" };
export default function ContactPage() {
  return (
    <PublicPage title="Contact & Event Help">
      <PublicContent kind="CONTACT" />
    </PublicPage>
  );
}
