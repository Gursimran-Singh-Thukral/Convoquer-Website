import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { LiveTickerRibbon } from './LiveTickerRibbon';
import { OrganizerNavRail } from './OrganizerNavRail';

export function PublicPage({
  title,
  children,
  organizer = false,
}: {
  title: string;
  children: React.ReactNode;
  organizer?: boolean;
}) {
  return (
    <>
      <LiveTickerRibbon />
      <Navbar />
      {organizer && <OrganizerNavRail />}
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-12">
        <h1 className="font-display text-4xl font-bold uppercase text-[#FFD700] mb-8">{title}</h1>
        {children}
      </main>
      <Footer />
    </>
  );
}
