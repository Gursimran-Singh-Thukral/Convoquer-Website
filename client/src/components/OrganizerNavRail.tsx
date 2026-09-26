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
  /** Restricts visibility to specific role names, ignoring anyPermission — see RequireOrganizer's requireRole. */
  requireRole?: string[];
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
    href: '/sports/manager',
    label: 'Sports & Venues',
    requireRole: ['WEB_DEV_HEAD', 'CONVENER', 'CO_CONVENER'],
  },
  {
    href: '/tournaments',
    label: 'Tournaments',
    // Tournament structure (create/edit/delete a Tournament, seed it,
    // generate its bracket) is kept to this one role/account only (also
    // backed server-side by SoleAdminGuard) — a Sports Coordinator CRUDs
    // matches inside an existing tournament (via /matches) but never builds
    // the tournament itself.
    requireRole: ['WEB_DEV_HEAD'],
  },
  {
    href: '/matches',
    label: 'Matches',
    anyPermission: ['match.create', 'match.update', 'score.update', 'competition.manage'],
  },
  {
    href: '/results/approvals',
    label: 'Approvals',
    anyPermission: ['result.approve', 'result.submit'],
  },
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
  {
    href: '/rbac',
    label: 'RBAC',
    // RBAC administration is deliberately kept to this one role (and, at the
    // backend, one exact email — see RbacAdminEmailGuard) rather than the
    // usual anyPermission check, so it never shows for a Convener/Co-Convener
    // who'd just hit a 403 on click.
    requireRole: ['WEB_DEV_HEAD'],
  },
];

/**
 * Persistent quick-jump rail rendered on every organizer-gated page so staff
 * never have to return to /organizer just to reach a sibling tool. Only shows
 * the tools a role actually has permission to use.
 */
export function OrganizerNavRail() {
  const pathname = usePathname();
  const { hasPermission, hasRole, hasOfficialAssignments } = useAuth();

  const visibleLinks = LINKS.filter((link) =>
    link.requireRole
      ? hasRole(...link.requireRole)
      : !link.anyPermission ||
        link.anyPermission.some((p) => hasPermission(p)) ||
        !!link.extra?.({ hasOfficialAssignments }),
  );

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
