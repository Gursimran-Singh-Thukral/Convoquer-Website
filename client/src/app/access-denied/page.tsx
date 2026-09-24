import Link from 'next/link';
import { PublicPage } from '@/components/PublicPage';
export default function AccessDeniedPage() {
  return (
    <PublicPage title="Organizer access required">
      <p className="text-zinc-300 mb-6">
        You are signed in, but your account does not have permission to open this organizer section.
        Contact the organizing team if you need a role assigned.
      </p>
      <div className="flex gap-6">
        <Link className="underline text-[#FFD700]" href="/">
          Return to homepage
        </Link>
        <Link className="underline text-[#FFD700]" href="/contact">
          Contact organizers
        </Link>
      </div>
    </PublicPage>
  );
}
