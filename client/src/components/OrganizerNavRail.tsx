'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

interface RailLink {
  href: string;
  label: string;
  /** Any one of these permissions grants visibility. Omit to always show (e.g. Overview). */
  anyPermission?: string[];
  /** Extra visibility check beyond anyPermission — e.g. Scorer for a volunteer tasked to one match. */
  extra?: (ctx: { hasOfficialAssignments: boolean }) => boolean;
}

const LINKS: RailLink[] = [
  { href: '/organizer', label: 'Overview' },
  {
    href: '/organizer/events',
    label: 'Events',
    anyPermission: ['event.create', 'event.update', 'event.delete'],
  },
  {
    href: '/organizer/volunteers/import',
    label: 'Import volunteers',
    anyPermission: ['volunteer.manage'],
  },
  { href: '/organizer/import', label: 'Import teams', anyPermission: ['participant.create'] },
  // /organizer/content is the site news/rules/committee article tool — its
  // form drafts AND publishes in one step, so it genuinely needs media.publish;
  // it is NOT where Media Team submits photos (that's the Media dept card on
  // /organizer's Overview, gated by media.create — see canSubmitMedia there).
  { href: '/organizer/content', label: 'Content', anyPermission: ['media.publish'] },
  {
    href: '/tournaments',
    label: 'Tournaments',
    anyPermission: ['tournament.view', 'competition.manage'],
  },
  {
    href: '/matches',
    label: 'Matches',
    anyPermission: ['match.update', 'score.update', 'competition.manage'],
  },
  {
    href: '/results/approvals',
    label: 'Approvals',
    anyPermission: ['result.approve', 'result.submit'],
  },
  {
    href: '/sports/manager',
    label: 'Sports & venues',
    anyPermission: ['sport.create', 'sport.update', 'venue.create', 'venue.update'],
  },
  { href: '/rbac', label: 'RBAC', anyPermission: ['role.view', 'role.assign'] },
  {
    href: '/scorer',
    label: 'Scorer',
    anyPermission: ['score.update', 'result.submit'],
    // A Sports Volunteer holds neither permission sport-wide — they only earn
    // Scorer access once tasked with a specific match (see OperationsTasksService
    // syncMatchOfficials), which shows up as a MatchOfficial assignment.
    extra: ({ hasOfficialAssignments }) => hasOfficialAssignments,
  },
  { href: '/security', label: 'Security', anyPermission: ['security.access'] },
];

/**
 * Persistent quick-jump rail rendered on every organizer-gated page so staff
 * never have to return to /organizer just to reach a sibling tool. Only shows
 * the tools a role actually has permission to use.
 */
export function OrganizerNavRail() {
  const pathname = usePathname();
  const { hasPermission, hasRole, hasOfficialAssignments } = useAuth();

  const visibleLinks = LINKS.filter(
    (link) =>
      !link.anyPermission ||
      link.anyPermission.some((p) => hasPermission(p)) ||
      !!link.extra?.({ hasOfficialAssignments }),
  ).filter((link) => !(link.href === '/sports/manager' && hasRole('HOSPITALITY_HEAD')));

  if (visibleLinks.length <= 1) return null;

  return (
    <div
      className="sticky top-[64px] z-40 bg-[#0c0a0d]/95 backdrop-blur-md border-b border-white/10 overflow-x-auto"
      data-purpose="organizer-nav-rail"
    >
      <div className="max-w-[1780px] mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-1 py-2 text-[11px] font-display font-bold uppercase tracking-wider whitespace-nowrap">
        {visibleLinks.map(({ href, label }) => {
          const isActive =
            pathname === href || (href !== '/organizer' && pathname?.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`px-3 py-1.5 rounded-lg transition-colors shrink-0 ${
                isActive
                  ? 'text-[#D4AF37] bg-white/10'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
