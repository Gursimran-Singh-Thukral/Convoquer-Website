'use client';

import React, { Suspense, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { LiveTickerRibbon } from '@/components/LiveTickerRibbon';
import { Footer } from '@/components/Footer';
import { useToast } from '@/components/ui/ToastProvider';

export default function AuthErrorPage() {
  return (
    <Suspense fallback={null}>
      <AuthErrorContent />
    </Suspense>
  );
}

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const reason = searchParams.get('reason');

  useEffect(() => {
    toast(
      reason
        ? `Sign-in blocked: ${reason}`
        : 'Sign-in blocked: your Google account was not authorized.',
      'error',
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once on mount only
  }, [reason]);

  const raw = (process.env.NEXT_PUBLIC_API_URL || '/api').replace(/\/+$/, '');
  const googleUrl = `${raw.endsWith('/api') ? raw : `${raw}/api`}/auth/google`;

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#121114] text-[#E8E6EB] selection:bg-[#FF4500] selection:text-white">
      <LiveTickerRibbon />
      <Navbar />

      {/* Tri-color Accent Line */}
      <div className="h-[2px] w-full bg-gradient-to-r from-[#800020] via-[#FF4500] to-[#FFD700]"></div>

      {/* Main Error Viewport */}
      <main className="flex-1 flex items-center justify-center px-4 py-16 relative bg-[#0f0d10]">
        {/* Glow */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(128,0,32,0.22)_0%,rgba(255,69,0,0.08)_35%,rgba(12,10,13,0)_70%)] pointer-events-none"></div>

        <div className="w-full max-w-md relative z-10">
          <div className="bg-[#151316] border border-[#27232b] rounded-2xl p-6 sm:p-7 shadow-2xl text-center">
            {/* Alert Icon Badge */}
            <div className="mx-auto w-12 h-12 rounded-xl bg-[#800020]/40 border border-[#800020]/60 flex items-center justify-center text-[#FF4500] shadow-md mb-3.5">
              <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
              </svg>
            </div>

            {/* <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1c1820] border border-[#800020]/60 mb-3">
              <span className="w-2 h-2 rounded-full bg-[#FF4500]"></span>
              <span className="text-[10px] font-mono text-[#FF4500] tracking-widest uppercase font-bold">
                ERR_AUTH_DOMAIN_RESTRICTED (403)
              </span>
            </div> */}

            <h1 className="font-display text-2xl sm:text-3xl font-black tracking-wide text-white uppercase mb-2">
              ACCESS <span className="text-[#FF4500]">RESTRICTED</span>
            </h1>

            <p className="text-xs text-gray-300 tracking-wide font-normal mb-4 leading-relaxed">
              Institutional Domain Mismatch. Convoquer&apos;26 Organizer Portal access is strictly
              restricted to verified{' '}
              <strong className="text-white font-semibold">@iitjammu.ac.in</strong> accounts.
            </p>

            {reason && (
              <div className="bg-[#2a1114] border border-[#FF4500]/40 rounded-xl p-3 mb-4 text-left">
                <p className="text-[10px] uppercase tracking-widest text-[#FF4500] font-bold mb-1">
                  Reason Reported
                </p>
                <p className="text-xs text-gray-200 leading-relaxed break-words">{reason}</p>
              </div>
            )}

            <div className="bg-[#1a171d] rounded-xl p-3.5 border border-[#2b2732] text-left text-xs text-gray-400 space-y-1.5 mb-5">
              <div className="flex items-center gap-2 text-[#FFD700] font-semibold">
                <svg className="w-4 h-4 flex-shrink-0 fill-current" viewBox="0 0 20 20">
                  <path
                    clipRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    fillRule="evenodd"
                  />
                </svg>
                <span>Unauthorized Identity Detected</span>
              </div>
              <p className="text-[11px] text-gray-400 leading-relaxed font-sans">
                Personal Gmail or unapproved external Google identities cannot be authorized for
                coordination, scoring, or secretariat controls.
              </p>
            </div>

            <div className="space-y-2.5 mb-5">
              <a
                href={googleUrl}
                className="w-full inline-flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl bg-white hover:bg-gray-100 text-gray-900 font-semibold text-xs transition-all shadow hover:shadow-md active:scale-[0.99] border border-gray-200"
              >
                <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    fill="#EA4335"
                  />
                </svg>
                <span>Try Again with @iitjammu.ac.in</span>
              </a>

              <Link
                className="w-full inline-flex items-center justify-center py-2.5 px-4 rounded-xl bg-[#18151c] hover:bg-[#201d24] text-gray-300 hover:text-white font-display text-xs uppercase tracking-wider transition-colors border border-[#2b2732]"
                href="/"
              >
                Return to Homepage
              </Link>
            </div>

            {/* <div className="pt-3 border-t border-[#221e26] text-[11px] text-gray-400 leading-relaxed text-center">
              <p>
                Appointed coordinator or committee member? Contact BSA Secretariat at{' '}
                <a className="text-[#FFD700] hover:underline font-medium" href="mailto:sports.affairs@iitjammu.ac.in">
                  sports.affairs@iitjammu.ac.in
                </a>{' '}
                or Jagti Ext. 402.
              </p>
            </div> */}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
