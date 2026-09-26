'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { OrganizerNavRail } from '@/components/OrganizerNavRail';
import { LiveTickerRibbon } from '@/components/LiveTickerRibbon';
import { Footer } from '@/components/Footer';
import { RequireOrganizer } from '@/components/RequireOrganizer';
import { useAuth } from '@/lib/auth-context';
import { apiAuthedGet, apiPost, apiDelete, ApiError } from '@/lib/api';

// ===================================
// Response shapes (see server/src/modules/rbac and users controllers/services)
// ===================================

interface PermissionDefinition {
  id: string;
  action: string;
  description?: string | null;
}

interface RolePermissionLink {
  permission: PermissionDefinition;
}

interface RoleDefinition {
  id: string;
  name: string;
  description?: string | null;
  permissions: RolePermissionLink[];
}

interface UserRoleAssignment {
  id: string;
  userId: string;
  roleId: string;
  sportId?: string | null;
  eventId?: string | null;
  departmentId?: string | null;
  expiresAt?: string | null;
  role: RoleDefinition;
}

interface ManagedUser {
  id: string;
  name: string;
  email: string;
  profilePhotoUrl?: string | null;
  createdAt?: string;
  lastLoginAt?: string | null;
  userRoles: UserRoleAssignment[];
}

interface AssignmentOptions {
  volunteers: Array<{
    id: string;
    name: string;
    email: string;
    department: string;
    userId?: string | null;
  }>;
  sports: Array<{ id: string; name: string; eventId: string }>;
  events: Array<{ id: string; name: string; status: string }>;
  departments: string[];
}

// Organizational seniority, highest first — mirrors server/prisma/seed.ts role creation order.
const ROLE_HIERARCHY = [
  'CONVENER',
  'CO_CONVENER',
  'OVERALL_SPORTS_COORDINATOR',
  'SPORTS_COORDINATOR',
  'SPORTS_VOLUNTEER',
  'MEDIA_HEAD',
  'MEDIA_TEAM',
  'HOSPITALITY_SECURITY_HEAD',
  'HOSPITALITY_SECURITY_VOLUNTEER',
  'SPONSORSHIP_HEAD',
  'EVENT_MANAGEMENT_HEAD',
  'DESIGN_HEAD',
  'WEB_DEV_HEAD',
  'VOLUNTEER',
];

// The Role Tier dropdown only ever assigns one of these — ground-level roles
// (VOLUNTEER, HOSPITALITY_SECURITY_VOLUNTEER, SPORTS_VOLUNTEER, MEDIA_TEAM)
// are granted automatically from the department picked in "Ground Volunteer"
// mode instead (see GROUND_ROLE_BY_DEPARTMENT on the server), never chosen
// directly here.
const HEAD_ROLE_NAMES = [
  'CONVENER',
  'CO_CONVENER',
  'OVERALL_SPORTS_COORDINATOR',
  'SPORTS_COORDINATOR',
  'MEDIA_HEAD',
  'HOSPITALITY_SECURITY_HEAD',
  'SPONSORSHIP_HEAD',
  'EVENT_MANAGEMENT_HEAD',
  'DESIGN_HEAD',
  'WEB_DEV_HEAD',
];

function byHierarchy(a: { name: string }, b: { name: string }): number {
  const ai = ROLE_HIERARCHY.indexOf(a.name);
  const bi = ROLE_HIERARCHY.indexOf(b.name);
  if (ai === -1 && bi === -1) return a.name.localeCompare(b.name);
  if (ai === -1) return 1;
  if (bi === -1) return -1;
  return ai - bi;
}

function initialsFor(name: string): string {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || '?'
  );
}

function scopeLabel(ur: UserRoleAssignment): string {
  const parts: string[] = [];
  if (ur.sportId) parts.push(`Sport: ${ur.sportId.slice(0, 8)}`);
  if (ur.eventId) parts.push(`Event: ${ur.eventId.slice(0, 8)}`);
  if (ur.departmentId) parts.push(`Dept: ${ur.departmentId.slice(0, 8)}`);
  if (parts.length === 0) return 'GLOBAL (ALL ACCESS)';
  return parts.join(' • ');
}

export default function RbacManagerPage() {
  const { hasPermission } = useAuth();
  const canAssign = hasPermission('role.assign');
  const canRevoke = hasPermission('role.revoke');

  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [rolesError, setRolesError] = useState<string | null>(null);

  const [permissions, setPermissions] = useState<PermissionDefinition[]>([]);

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);

  const [filterRole, setFilterRole] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isProvisionModalOpen, setIsProvisionModalOpen] = useState(false);
  const [showAdvancedScope, setShowAdvancedScope] = useState(false);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [assignSubmitting, setAssignSubmitting] = useState(false);

  // Provision / assign-role form state
  const [assignMode, setAssignMode] = useState<'HEAD' | 'VOLUNTEER'>('HEAD');
  const [newRole, setNewRole] = useState('');
  const [newScopeSportId, setNewScopeSportId] = useState('');
  const [newScopeEventId, setNewScopeEventId] = useState('');
  const [selectedVolunteerId, setSelectedVolunteerId] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [assignmentOptions, setAssignmentOptions] = useState<AssignmentOptions>({
    volunteers: [],
    sports: [],
    events: [],
    departments: [],
  });

  const showNotification = useCallback((type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  }, []);

  const loadRoles = useCallback(async () => {
    setRolesLoading(true);
    setRolesError(null);
    try {
      const [rolesData, permissionsData, options] = await Promise.all([
        apiAuthedGet<RoleDefinition[]>('/rbac/roles'),
        apiAuthedGet<PermissionDefinition[]>('/rbac/permissions'),
        canAssign
          ? apiAuthedGet<AssignmentOptions>('/rbac/assignment-options')
          : Promise.resolve({ volunteers: [], sports: [], events: [], departments: [] }),
      ]);
      setRoles(Array.isArray(rolesData) ? rolesData : []);
      setPermissions(Array.isArray(permissionsData) ? permissionsData : []);
      setAssignmentOptions(options);
      if (!newRole && Array.isArray(rolesData)) {
        const firstHead = [...rolesData]
          .sort(byHierarchy)
          .find((r) => HEAD_ROLE_NAMES.includes(r.name));
        if (firstHead) setNewRole(firstHead.name);
      }
    } catch (err) {
      setRolesError(
        err instanceof ApiError ? err.message : 'Failed to load roles and permissions.',
      );
    } finally {
      setRolesLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAssign]);

  const loadUsers = useCallback(async (query?: string) => {
    setUsersLoading(true);
    setUsersError(null);
    try {
      const endpoint =
        query && query.trim() ? `/users?q=${encodeURIComponent(query.trim())}` : '/users';
      const data = await apiAuthedGet<ManagedUser[]>(endpoint);
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      setUsersError(err instanceof ApiError ? err.message : 'Failed to load users.');
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    // Deferred via a microtask so the initial setState calls inside these loaders
    // don't run synchronously within the effect body (matches the pattern in auth-context.tsx).
    Promise.resolve().then(() => {
      loadRoles();
      loadUsers();
    });
  }, [loadRoles, loadUsers]);

  // Debounced re-fetch on search query change (server-side filtering via ?q=)
  useEffect(() => {
    const handle = setTimeout(() => {
      loadUsers(searchQuery);
    }, 350);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const rolesByHierarchy = [...roles].sort(byHierarchy);
  const allRoleNames = rolesByHierarchy.map((r) => r.name);
  // The assign-role modal's Role Tier dropdown only ever offers Head roles —
  // ground-level roles are granted from the department picked in Volunteer mode.
  const headRolesByHierarchy = rolesByHierarchy.filter((r) => HEAD_ROLE_NAMES.includes(r.name));

  const filteredUsers = users.filter((u) => {
    if (filterRole !== 'ALL' && !u.userRoles.some((ur) => ur.role.name === filterRole))
      return false;
    return true;
  });

  const totalActiveAssignments = users.reduce((sum, u) => sum + u.userRoles.length, 0);

  const handleRevokeRole = async (
    userId: string,
    userRoleId: string,
    userName: string,
    roleName: string,
  ) => {
    setRevokingId(userRoleId);
    try {
      await apiDelete(`/users/${userId}/roles/${userRoleId}`);
      showNotification('success', `Revoked "${roleName}" from ${userName}.`);
      await loadUsers(searchQuery);
    } catch (err) {
      showNotification('error', err instanceof ApiError ? err.message : 'Failed to revoke role.');
    } finally {
      setRevokingId(null);
    }
  };

  const handleAssignRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVolunteerId) return;
    if (assignMode === 'HEAD' && !newRole) return;
    if (assignMode === 'VOLUNTEER' && !selectedDepartment) return;

    const volunteer = assignmentOptions.volunteers.find((v) => v.id === selectedVolunteerId);
    if (!volunteer) return;

    setAssignSubmitting(true);
    try {
      // Ground-volunteer mode always posts the generic 'VOLUNTEER' role — the
      // server infers the actual role (HOSPITALITY_SECURITY_VOLUNTEER/MEDIA_TEAM/
      // SPORTS_VOLUNTEER/plain VOLUNTEER) purely from the department picked below.
      const roleToAssign = assignMode === 'VOLUNTEER' ? 'VOLUNTEER' : newRole;
      const scope = {
        sportId: newScopeSportId.trim() || undefined,
        eventId: newScopeEventId.trim() || undefined,
        department: assignMode === 'VOLUNTEER' ? selectedDepartment : undefined,
      };

      // A volunteer already linked to a login account gets the role live and
      // immediately; one who hasn't signed in yet gets it queued on their
      // Volunteer record and it activates automatically the moment they do
      // (see RbacService.linkPendingVolunteerRole) — no need to wait for them
      // to log in before you can set this up.
      let pending = false;
      if (volunteer.userId) {
        await apiPost(`/users/${volunteer.userId}/roles`, {
          role: roleToAssign,
          volunteerId: selectedVolunteerId,
          ...scope,
        });
      } else {
        const result = await apiPost<{ pending: boolean }>(
          `/volunteers/${selectedVolunteerId}/role`,
          { role: roleToAssign, ...scope },
        );
        pending = result.pending;
      }

      setIsProvisionModalOpen(false);
      setNewScopeSportId('');
      setNewScopeEventId('');
      setSelectedVolunteerId('');
      setSelectedDepartment('');
      setShowAdvancedScope(false);
      showNotification(
        'success',
        pending
          ? `Queued "${roleToAssign}" for ${volunteer.name} — it activates automatically the moment they first log in.`
          : `Assigned "${roleToAssign}" to ${volunteer.name}.`,
      );
      await Promise.all([loadUsers(searchQuery), loadRoles()]);
    } catch (err) {
      showNotification('error', err instanceof ApiError ? err.message : 'Failed to assign role.');
    } finally {
      setAssignSubmitting(false);
    }
  };

  return (
    <RequireOrganizer anyPermission={['role.view']}>
      <div className="min-h-screen flex flex-col bg-[#121114] text-[#E8E6EB] selection:bg-[#FFD700] selection:text-black font-sans">
        <LiveTickerRibbon />
        <Navbar />
        <OrganizerNavRail />

        {/* Tri-color Accent Line */}
        <div className="h-[2px] w-full bg-gradient-to-r from-[#800020] via-[#FF4500] to-[#FFD700]"></div>

        <main className="flex-grow max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Page Title & Primary Actions */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono text-[#FFD700] uppercase tracking-widest mb-1">
                <span>CONVOQUER&apos;26 GOVERNANCE</span>
                <span>•</span>
                <span>SECURITY PROTOCOL</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-black uppercase tracking-wider text-white flex items-center gap-3">
                USER MANAGER <span className="text-[#FFD700]">&amp; ACCESS CONTROL</span>
              </h1>
              <p className="text-sm text-zinc-400 mt-1 max-w-2xl">
                Centralized Google OAuth provisioner, role-based scope authorizations (RBAC), and
                session security control for Convoquer&apos;26 organizers.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/organizer"
                className="bg-[#1d1b1e] hover:bg-[#252327] text-zinc-300 hover:text-white text-xs font-bold tracking-wider px-4 py-3 rounded-lg border border-[#2a272c] transition-colors"
              >
                Organizer Overview
              </Link>
              {canAssign && (
                <button
                  onClick={() => setIsProvisionModalOpen(true)}
                  className="bg-[#FFD700] hover:bg-[#ffdf33] text-black text-xs font-bold tracking-widest px-5 py-3 rounded-lg border border-[#FFD700] transition-all flex items-center gap-2 shadow-sm active:scale-95"
                  type="button"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2.5"
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  <span>ASSIGN ROLE</span>
                </button>
              )}
            </div>
          </div>

          {/* Live Notification */}
          {notification && (
            <div
              className={`mb-6 p-4 rounded-xl border text-sm flex items-center gap-3 animate-in fade-in ${
                notification.type === 'success'
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
              }`}
            >
              <svg
                className="w-5 h-5 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {notification.type === 'success' ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M5 13l4 4L19 7"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                )}
              </svg>
              <span className="font-semibold">{notification.message}</span>
            </div>
          )}

          {rolesError && (
            <div className="mb-6 p-4 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-sm">
              {rolesError}
            </div>
          )}

          {/* Metrics Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-[#151316] border border-[#2a272c] p-5 rounded-xl">
              <div className="text-[11px] font-mono tracking-widest uppercase text-zinc-400 font-bold">
                TOTAL PROVISIONED ACCOUNTS
              </div>
              <div className="text-3xl font-black text-white mt-1 font-mono">
                {usersLoading ? '—' : users.length}
              </div>
              <div className="text-xs text-zinc-400 mt-1">Google OAuth authenticated accounts</div>
            </div>

            <div className="bg-[#151316] border border-[#2a272c] p-5 rounded-xl">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#FFD700] animate-pulse"></span>
                <span className="text-[11px] font-mono tracking-widest uppercase text-zinc-400 font-bold">
                  ACTIVE ROLE ASSIGNMENTS
                </span>
              </div>
              <div className="text-3xl font-black text-[#FFD700] mt-1 font-mono">
                {usersLoading ? '—' : totalActiveAssignments}
              </div>
              <div className="text-xs text-zinc-400 mt-1">Across all provisioned accounts</div>
            </div>

            <div className="bg-[#151316] border border-[#2a272c] p-5 rounded-xl">
              <div className="text-[11px] font-mono tracking-widest uppercase text-zinc-400 font-bold">
                ROLE SCOPES ALLOCATED
              </div>
              <div className="text-3xl font-black text-white mt-1 font-mono">
                {rolesLoading ? '—' : roles.length}
              </div>
              <div className="text-xs text-zinc-400 mt-1">Defined roles in the RBAC registry</div>
            </div>

            <div className="bg-[#151316] border border-[#2a272c] p-5 rounded-xl">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span className="text-[11px] font-mono tracking-widest uppercase text-zinc-400 font-bold">
                  PERMISSION DEFINITIONS
                </span>
              </div>
              <div className="text-3xl font-black text-emerald-400 mt-1 font-mono">
                {rolesLoading ? '—' : permissions.length}
              </div>
              <div className="text-xs text-zinc-400 mt-1">Registered permission actions</div>
            </div>
          </div>

          {/* Filtering & Query Controls */}
          <div className="bg-[#151316] border border-[#2a272c] p-3 rounded-xl mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-1 overflow-x-auto py-1">
              <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider mr-2 ml-1 font-bold">
                ROLE:
              </span>
              {[
                { key: 'ALL', label: `ALL (${users.length})` },
                ...allRoleNames.map((r) => ({ key: r, label: r })),
              ].map((tab) => {
                const isActive = filterRole === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setFilterRole(tab.key)}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg tracking-wider transition-colors whitespace-nowrap ${
                      isActive
                        ? 'bg-[#FFD700] text-black shadow-sm'
                        : 'bg-[#1d1b1e] text-zinc-400 hover:text-white hover:bg-[#252327]'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, email..."
                className="bg-[#0f0d10] border border-[#2a272c] rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#FFD700] w-64"
              />
            </div>
          </div>

          {/* User Management Table */}
          <div className="bg-[#151316] border border-[#2a272c] rounded-xl overflow-hidden mb-8 shadow-xl">
            <div className="px-5 py-4 border-b border-[#2a272c] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base font-bold uppercase tracking-wider text-white">
                  ORGANIZER ROSTER DIRECTORY
                </span>
                <span className="bg-[#800020] text-[#FFD700] text-[10px] font-bold px-2 py-0.5 rounded font-mono">
                  AUTHENTICATED ONLY
                </span>
              </div>
              <div className="text-xs text-zinc-400 font-mono">
                Showing {filteredUsers.length} of {users.length} Registered Officers
              </div>
            </div>

            {usersLoading ? (
              <div className="p-8 text-center text-xs text-zinc-400 font-mono">Loading roster…</div>
            ) : usersError ? (
              <div className="p-8 text-center text-xs text-[#FF4500] font-mono">{usersError}</div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-400 font-mono">
                No users match the current filters.
              </div>
            ) : (
              <div className="divide-y divide-[#2a272c]">
                {filteredUsers.map((user) => (
                  <div key={user.id} className="p-5 hover:bg-[#1d1b1e]/50 transition-colors">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-[#800020] border border-[#FFD700] flex items-center justify-center font-bold text-white text-base shrink-0">
                          {initialsFor(user.name || user.email)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-base font-bold text-white tracking-wide">
                              {user.name || user.email}
                            </span>
                            {user.userRoles.length === 0 && (
                              <span className="text-xs font-medium font-mono text-zinc-500">
                                NO ROLES ASSIGNED
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-zinc-400 mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono">
                            <span>{user.email}</span>
                            {user.lastLoginAt && (
                              <span>
                                Last login: {new Date(user.lastLoginAt).toLocaleString('en-IN')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Per-role assignment rows */}
                    <div className="mt-3 pt-3 border-t border-[#2a272c]/60 space-y-2">
                      {user.userRoles.map((ur) => (
                        <div
                          key={ur.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-[#0f0d10] rounded-lg border border-[#2a272c]"
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="bg-[#800020] text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider border border-[#FFD700]/30 font-mono">
                              {ur.role.name}
                            </span>
                            <span className="text-xs font-medium font-mono text-[#FFD700]">
                              {scopeLabel(ur)}
                            </span>
                            {ur.expiresAt && (
                              <span className="text-xs font-mono text-zinc-500">
                                Expires {new Date(ur.expiresAt).toLocaleDateString('en-IN')}
                              </span>
                            )}
                          </div>
                          {canRevoke && (
                            <button
                              onClick={() =>
                                handleRevokeRole(
                                  user.id,
                                  ur.id,
                                  user.name || user.email,
                                  ur.role.name,
                                )
                              }
                              disabled={revokingId === ur.id}
                              className="bg-[#1d1b1e] hover:bg-rose-950/40 text-zinc-300 hover:text-rose-400 text-xs font-bold px-3 py-1.5 rounded-lg border border-[#2a272c] transition-colors disabled:opacity-50 disabled:cursor-not-allowed self-start sm:self-auto"
                            >
                              {revokingId === ur.id ? 'REVOKING…' : 'REVOKE ROLE'}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RBAC Hierarchy Reference — now sourced from GET /api/rbac/roles */}
          <div className="w-full bg-[#151316] border border-[#2a272c] p-5 rounded-xl">
            <div className="flex items-center justify-between mb-4 border-b border-[#2a272c] pb-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-white font-mono">
                RBAC HIERARCHY REFERENCE
              </h3>
              <span className="text-xs text-zinc-400 font-mono">
                Role-based permissions &amp; privilege tiers
              </span>
            </div>
            {rolesLoading ? (
              <div className="text-xs text-zinc-400 font-mono py-4">Loading role registry…</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                {rolesByHierarchy.map((role) => (
                  <div
                    key={role.id}
                    className="flex flex-col justify-between p-3 rounded-lg bg-[#0f0d10] border border-[#2a272c]"
                  >
                    <span className="font-bold text-white">{role.name}</span>
                    <span className="text-[#FFD700] font-mono mt-2 text-[11px]">
                      {role.permissions.length} permission{role.permissions.length === 1 ? '' : 's'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>

        {/* ASSIGN ROLE MODAL */}
        {isProvisionModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
            <div className="w-full max-w-lg bg-[#151316] border border-white/20 rounded-2xl p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <h3 className="text-lg font-black text-white uppercase">
                  Assign Organizer Role Scope
                </h3>
                <button
                  onClick={() => setIsProvisionModalOpen(false)}
                  className="text-zinc-400 hover:text-white"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
              <p className="text-xs text-zinc-500">
                Select a volunteer and grant either a Head role or a ground-level department. They
                don&apos;t need to have signed in yet — an assignment for someone who hasn&apos;t
                logged in queues automatically and activates the moment they do.
              </p>

              {/* Mode toggle — the Role Tier dropdown only ever assigns a Head role; a
                  ground-level role (Volunteer/Security Volunteer/Sports Volunteer/Media
                  Team) is always inferred from the department picked in Volunteer mode. */}
              <div className="flex rounded-lg border border-white/15 overflow-hidden text-xs font-bold uppercase tracking-wider">
                <button
                  type="button"
                  onClick={() => setAssignMode('HEAD')}
                  className={`flex-1 py-2 transition-colors ${assignMode === 'HEAD' ? 'bg-[#FFD700] text-black' : 'bg-transparent text-zinc-400 hover:text-white'}`}
                >
                  Head Role
                </button>
                <button
                  type="button"
                  onClick={() => setAssignMode('VOLUNTEER')}
                  className={`flex-1 py-2 transition-colors ${assignMode === 'VOLUNTEER' ? 'bg-[#FFD700] text-black' : 'bg-transparent text-zinc-400 hover:text-white'}`}
                >
                  Ground Volunteer
                </button>
              </div>

              <form onSubmit={handleAssignRole} className="space-y-3 text-xs">
                <div>
                  <label className="font-bold uppercase text-zinc-400 block mb-1">Volunteer</label>
                  <select
                    required
                    value={selectedVolunteerId}
                    onChange={(e) => {
                      const volunteer = assignmentOptions.volunteers.find(
                        (item) => item.id === e.target.value,
                      );
                      setSelectedVolunteerId(e.target.value);
                      setSelectedDepartment(volunteer?.department || '');
                    }}
                    className="w-full bg-[#0f0d10] border border-white/15 p-2.5 rounded-lg text-white font-mono"
                  >
                    <option value="">Select a volunteer</option>
                    {assignmentOptions.volunteers.map((volunteer) => (
                      <option key={volunteer.id} value={volunteer.id}>
                        {volunteer.name} ({volunteer.email}) —{' '}
                        {volunteer.userId ? 'logged in' : 'not logged in yet'}
                      </option>
                    ))}
                  </select>
                </div>

                {assignMode === 'HEAD' ? (
                  <>
                    <div>
                      <label className="font-bold uppercase text-zinc-400 block mb-1">
                        Role Tier
                      </label>
                      <select
                        value={newRole}
                        onChange={(e) => setNewRole(e.target.value)}
                        className="w-full bg-[#0f0d10] border border-white/15 p-2.5 rounded-lg text-white font-mono"
                      >
                        {headRolesByHierarchy.map((r) => (
                          <option key={r.id} value={r.name}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                      <p className="text-[10px] text-zinc-500 mt-1">
                        Listed by seniority — Convener at the top. Its department (if any) is set
                        automatically.
                      </p>
                    </div>

                    {newRole === 'SPORTS_COORDINATOR' && (
                      <div>
                        <label className="font-bold uppercase text-zinc-400 block mb-1">
                          Assigned Sport
                        </label>
                        <select
                          required
                          value={newScopeSportId}
                          onChange={(e) => setNewScopeSportId(e.target.value)}
                          className="w-full bg-[#0f0d10] border border-white/15 p-2.5 rounded-lg text-white"
                        >
                          <option value="">Select a sport</option>
                          {assignmentOptions.sports.map((sport) => (
                            <option key={sport.id} value={sport.id}>
                              {sport.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </>
                ) : (
                  <fieldset className="border border-white/10 rounded-lg p-3">
                    <legend className="font-bold uppercase text-zinc-400 px-1">Department</legend>
                    <p className="text-[10px] text-zinc-500 mb-2">
                      A volunteer belongs to exactly one department — picking it grants the matching
                      role (Security → Security Volunteer, Media → Media Team, Sports → Sports
                      Volunteer, otherwise the general Volunteer role).
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {assignmentOptions.departments.map((department) => (
                        <label key={department} className="flex items-center gap-2 text-zinc-300">
                          <input
                            type="radio"
                            name="volunteer-department"
                            checked={selectedDepartment === department}
                            onChange={() => setSelectedDepartment(department)}
                          />
                          {department}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                )}

                {!showAdvancedScope ? (
                  <button
                    type="button"
                    onClick={() => setShowAdvancedScope(true)}
                    className="text-[#FFD700] hover:text-white text-xs font-bold uppercase tracking-wider"
                  >
                    + Restrict to a specific sport/event (optional)
                  </button>
                ) : (
                  <div className="space-y-2 border-t border-white/10 pt-3">
                    <p className="text-[10px] text-zinc-500">
                      Leave these blank for global access.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="font-bold uppercase text-zinc-400 block mb-1">
                          Sport
                        </label>
                        <select
                          value={newScopeSportId}
                          onChange={(e) => setNewScopeSportId(e.target.value)}
                          className="w-full bg-[#0f0d10] border border-white/15 p-2.5 rounded-lg text-white"
                        >
                          <option value="">Global</option>
                          {assignmentOptions.sports.map((sport) => (
                            <option key={sport.id} value={sport.id}>
                              {sport.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="font-bold uppercase text-zinc-400 block mb-1">
                          Event
                        </label>
                        <select
                          value={newScopeEventId}
                          onChange={(e) => setNewScopeEventId(e.target.value)}
                          className="w-full bg-[#0f0d10] border border-white/15 p-2.5 rounded-lg text-white"
                        >
                          <option value="">Global</option>
                          {assignmentOptions.events.map((event) => (
                            <option key={event.id} value={event.id}>
                              {event.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-4 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setIsProvisionModalOpen(false)}
                    className="px-4 py-2 rounded-lg bg-white/10 text-white font-bold uppercase"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={
                      assignSubmitting ||
                      roles.length === 0 ||
                      (assignMode === 'VOLUNTEER' && !selectedDepartment)
                    }
                    className="px-5 py-2 rounded-lg bg-[#FFD700] text-black font-bold uppercase tracking-wider shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {assignSubmitting ? 'Assigning…' : 'Assign Role'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <Footer />
      </div>
    </RequireOrganizer>
  );
}
