'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { LiveTickerRibbon } from '@/components/LiveTickerRibbon';
import { Footer } from '@/components/Footer';
import { apiAuthedGet } from '@/lib/api';
import type { EffectiveAuth } from '@/lib/auth-context';
import { useAuth } from '@/lib/auth-context';

export default function LoginPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [loadingRole, setLoadingRole] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const getAuthUrl = (endpoint: string) => {
    const raw = (process.env.NEXT_PUBLIC_API_URL || '/api').replace(/\/+$/, '');
    const base = raw.endsWith('/api') ? raw : `${raw}/api`;
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${base}${cleanEndpoint}`;
  };

  const handleGoogleSignIn = () => {
    // Initiate official Google OAuth flow on backend
    window.location.href = getAuthUrl('/auth/google');
  };

  const handleDevRoleSignIn = async (role: string) => {
    setLoadingRole(role);
    setStatusMessage(`Authenticating as ${role.replace('_', ' ')}...`);
    try {
      const res = await fetch(getAuthUrl('/auth/dev-login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
        credentials: 'include',
      });

      if (res.ok) {
        setStatusMessage(`Authenticated! Redirecting to command center...`);
        await refresh();
        const effective = await apiAuthedGet<EffectiveAuth>('/users/me/permissions');
        router.replace(
          effective.roles.length > 0 && Object.keys(effective.permissions).length > 0
            ? '/organizer'
            : '/access-denied',
        );
      } else {
        setStatusMessage(`Demo sign-in is not available in this environment.`);
      }
    } catch {
      setStatusMessage(`Unable to reach the authentication server. Please try again.`);
    } finally {
      setLoadingRole(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#121114] text-[#E8E6EB] selection:bg-[#FF4500] selection:text-white">
      <LiveTickerRibbon />
      <Navbar />

      {/* Tri-color Accent Line */}
      <div className="h-[2px] w-full bg-gradient-to-r from-[#800020] via-[#FF4500] to-[#FFD700]"></div>

      {/* Main Login Viewport */}
      <main className="flex-1 flex items-center justify-center px-4 py-16 relative bg-[#0f0d10]">
        {/* Subtle glow */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(128,0,32,0.22)_0%,rgba(255,69,0,0.08)_35%,rgba(12,10,13,0)_70%)] pointer-events-none"></div>

        <div className="w-full max-w-sm relative z-10">
          {/* Login Card Container */}
          <div className="bg-[#151316] border border-[#27232b] rounded-2xl p-6 sm:p-7 shadow-2xl text-center">
            {/* Header Torch Icon & Badge */}
            <div className="mx-auto w-10 h-10 rounded-xl bg-[#800020]/40 border border-[#800020]/60 flex items-center justify-center text-[#FFD700] shadow-md mb-3.5">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M12 2C10.5 4.5 8 7 8 11c0 2.21 1.79 4 4 4s4-1.79 4-4c0-4-2.5-6.5-4-9zm0 18c-4.41 0-8-3.59-8-8 0-2.88 1.52-5.4 3.79-6.79.08.38.21.75.39 1.1C6.9 8.24 6 10.02 6 12c0 3.31 2.69 6 6 6s6-2.69 6-6c0-1.98-.9-3.76-2.18-4.69.18-.35.31-.72.39-1.1C18.48 7.6 20 10.12 20 13c0 4.41-3.59 8-8 8z" />
              </svg>
            </div>

            {/* Heading & Event Context */}
            <h1 className="font-display text-2xl sm:text-3xl font-black tracking-wide text-white uppercase mb-1.5">
              ORGANIZER <span className="text-[#FFD700]">PORTAL</span>
            </h1>

            <p className="text-xs text-gray-400 tracking-wide font-normal mb-5 leading-relaxed max-w-xs mx-auto">
              Authorized personnel, sponsorship heads, sports coordinators, and secretariat access
              for Convoquer&apos;26 operations.
            </p>

            {/* Dedicated Google OAuth Login Button (Only login method) */}
            <div className="mb-4">
              <button
                onClick={handleGoogleSignIn}
                type="button"
                className="w-full inline-flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-white hover:bg-gray-100 text-gray-800 font-bold text-sm transition-all shadow-lg hover:shadow-xl active:scale-[0.99] border border-gray-200"
              >
                {/* Official Google "G" Icon */}
                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    fill="#EA4335"
                  />
                </svg>
                <span className="font-bold tracking-normal text-gray-900 text-sm">
                  Sign in with Google
                </span>
              </button>
            </div>

            {/* Institutional Email Domain Notice */}
            <div className="bg-[#1a171d] rounded-xl p-3 border border-[#2b2732] flex items-center justify-center gap-2 text-xs text-gray-400 mb-2">
              <svg
                className="w-4 h-4 text-[#FFD700] flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  clipRule="evenodd"
                  d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  fillRule="evenodd"
                />
              </svg>
              <span>
                Restricted to <strong className="text-white font-semibold">@iitjammu.ac.in</strong>{' '}
                Google Workspace accounts
              </span>
            </div>

            {/* Quick Demo Role Logins — development/staging only, never rendered in production */}
            {/* {process.env.NODE_ENV !== 'production' && (
              <div className="pt-3 border-t border-[#221e26] space-y-2">
                <span className="text-[10px] font-mono uppercase text-gray-500 block tracking-widest">
                  — DEV-ONLY DEMO ROLE ACCESS —
                </span>
                <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono font-bold uppercase">
                  {[
                    { role: 'CONVENER', label: 'Convener' },
                    { role: 'OVERALL_SPORTS_COORDINATOR', label: 'Sports Coordinator' },
                    { role: 'MEDIA_HEAD', label: 'Media Head' },
                    { role: 'VOLUNTEER', label: 'Volunteer' },
                  ].map((item) => (
                    <button
                      key={item.role}
                      disabled={loadingRole !== null}
                      onClick={() => handleDevRoleSignIn(item.role)}
                      type="button"
                      className="px-2.5 py-2 rounded-lg bg-[#1a171e] hover:bg-[#800020]/50 border border-white/10 hover:border-[#FFD700]/50 text-gray-300 hover:text-[#FFD700] transition-all text-center"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            )} */}

            {statusMessage && (
              <div className="mt-3 p-2 rounded-lg bg-emerald-950/70 border border-emerald-500/40 text-[11px] font-mono text-emerald-300">
                {statusMessage}
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
