'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, type PermissionScope } from '@/lib/auth-context';

interface RequireOrganizerProps {
  children: React.ReactNode;
  /** If provided, the viewer must also hold at least one of these permissions (checked against `scope`), unless `extraAllowed` is true. */
  anyPermission?: string[];
  scope?: PermissionScope;
  /**
   * Escape hatch for access granted outside the permission system — e.g. a
   * Sports Volunteer has no sport-wide score.update grant but can still open
   * /scorer once they're a MatchOfficial on some match (hasOfficialAssignments).
   * When true, access is allowed even if `anyPermission` fails.
   */
  extraAllowed?: boolean;
  /**
   * Restricts access to specific role names regardless of what permissions the
   * viewer otherwise holds — e.g. Sports & Venues management is intentionally
   * kept to a named few (Web Dev Head, Convener) even though other roles
   * (Overall Sports Coordinator) also hold venue.create/venue.update for
   * unrelated reasons. When provided, the viewer must hold at least one of
   * these roles; `anyPermission` is ignored.
   */
  requireRole?: string[];
}

function FullScreenMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0c0a0d] text-gray-300">
      <p className="font-mono text-sm uppercase tracking-widest">{children}</p>
    </div>
  );
}

/**
 * Client-side gate for organizer-only pages. This is a UX convenience only —
 * the backend independently enforces authentication/authorization on every
 * request, so this guard existing (or not) never grants or removes real access.
 */
export function RequireOrganizer({
  children,
  anyPermission,
  scope,
  extraAllowed,
  requireRole,
}: RequireOrganizerProps) {
  const { isLoading, authenticated, canAccessOrganizer, hasPermission, hasRole } = useAuth();
  const router = useRouter();

  const permissionOk = requireRole
    ? hasRole(...requireRole)
    : !anyPermission ||
      anyPermission.length === 0 ||
      anyPermission.some((p) => hasPermission(p, scope)) ||
      !!extraAllowed;

  useEffect(() => {
    if (isLoading) return;
    if (!authenticated) {
      router.replace('/login');
    } else if (!canAccessOrganizer || !permissionOk) {
      router.replace('/access-denied');
    }
  }, [isLoading, authenticated, canAccessOrganizer, permissionOk, router]);

  if (isLoading) {
    return <FullScreenMessage>Verifying organizer session...</FullScreenMessage>;
  }

  if (!authenticated) {
    return <FullScreenMessage>Redirecting to login...</FullScreenMessage>;
  }

  if (!canAccessOrganizer || !permissionOk) {
    return (
      <FullScreenMessage>
        Your account does not have permission to view this section.
      </FullScreenMessage>
    );
  }

  return <>{children}</>;
}
