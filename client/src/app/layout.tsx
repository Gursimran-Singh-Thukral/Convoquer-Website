import type { Metadata } from 'next';
import { Oswald, Inter, Space_Grotesk } from 'next/font/google';
import { AuthProvider } from '@/lib/auth-context';
import { ToastProvider } from '@/components/ui/ToastProvider';
import './globals.css';

const oswald = Oswald({
  variable: '--font-oswald',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
});

const spaceGrotesk = Space_Grotesk({
  variable: '--font-space-grotesk',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: "CONVOQUER'26 | Official Inter-Collegiate Sports Championship | IIT Jammu",
  description:
    'The premier inter-collegiate sports championship at IIT Jammu. Real-time scores, Olympic medal tally, tournament brackets, and live arena broadcasts.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${oswald.variable} ${inter.variable} ${spaceGrotesk.variable} scroll-smooth`}
    >
      <body className="antialiased selection:bg-[#701A2B] selection:text-[#E5C158] min-h-screen flex flex-col bg-[#121114] text-[#E8E6EB]">
        <ToastProvider>
          <AuthProvider>{children}</AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
