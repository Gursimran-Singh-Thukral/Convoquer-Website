'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { OrganizerNavRail } from '@/components/OrganizerNavRail';
import { LiveTickerRibbon } from '@/components/LiveTickerRibbon';
import { Footer } from '@/components/Footer';
import { RequireOrganizer } from '@/components/RequireOrganizer';
import { useAuth } from '@/lib/auth-context';
import {
  apiAuthedGet,
  apiPatch,
  apiPost,
  apiGet,
  ApiError,
  fetchVenues,
  fetchSiteSettings,
  type Venue,
  type MediaAsset,
} from '@/lib/api';

const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2MB

const ANNOUNCEMENT_TARGETS = [
  { id: 'PUBLIC', label: 'Public View' },
  { id: 'MEDIA_TEAM', label: 'Media Team' },
  { id: 'HOSPITALITY_TEAM', label: 'Hospitality Team' },
  { id: 'SECURITY_TEAM', label: 'Security Team' },
  { id: 'WEB_DEV_TEAM', label: 'Web Dev Team' },
  { id: 'VOLUNTEERS', label: 'Volunteers' },
];

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// ===================================
// Response shapes (see server/src/modules/dashboard, results, and their DTOs)
// ===================================

interface OverviewMetrics {
  sportsCount?: number;
  tournamentsCount?: number;
  teamsCount?: number;
  matchesCount?: number;
  liveMatchesCount?: number;
  completedMatchesCount?: number;
  pendingApprovalsCount?: number;
  participantsCount?: number;
  checkedInParticipantsCount?: number;
  checkInRate?: number;
  upcomingMatchesCount?: number;
  totalParticipants?: number;
  checkedInCount?: number;
  pendingCheckInCount?: number;
  openTasks?: number;
}

interface DashboardOverview {
  persona: string;
  metrics?: OverviewMetrics;
  message?: string;
  sport?: { id: string; name: string };
  volunteer?: { name: string; department: string; venueName?: string | null };
  tasks?: OpsTask[];
  venueOccupancy?: Array<{
    id: string;
    name: string;
    location?: string | null;
    peoplePresent: number;
  }>;
  // Hospitality's "expected audience per venue" projection (getVenueAudienceProjection) —
  // computed from scheduled/live fixtures + team rosters, not physical check-ins.
  venues?: Array<{
    venueId: string;
    venueName: string;
    location?: string | null;
    matches: Array<{
      matchId: string;
      sport: string;
      teamAName: string;
      teamBName: string;
      scheduledStartTime: string;
      status: string;
    }>;
    expectedAudience: number;
    currentPhysicalOccupancy: number;
  }>;
  [key: string]: unknown;
}

interface TeamRef {
  id?: string;
  name: string;
  institute?: { shortName?: string | null; name?: string } | null;
}

interface LiveActivityMatch {
  id: string;
  matchNumber?: string | null;
  status: string;
  currentPeriod?: string | null;
  scheduledStartTime?: string;
  teamAScore?: number | null;
  teamBScore?: number | null;
  teamA?: TeamRef;
  teamB?: TeamRef;
  venue?: { id?: string; name?: string; location?: string | null } | null;
  tournament?: { id?: string; name?: string; sport?: { id?: string; name?: string } } | null;
}

interface PendingApprovalResult {
  id: string;
  matchId: string;
  finalScoreA: number;
  finalScoreB: number;
  status: string;
  submittedAt?: string | null;
  match?: {
    id?: string;
    teamA?: TeamRef;
    teamB?: TeamRef;
    tournament?: { id?: string; name?: string; sport?: { id?: string; name?: string } } | null;
    venue?: { name?: string } | null;
  };
  submitter?: { id?: string; name?: string; email?: string } | null;
}

interface AuditLogUser {
  id?: string;
  name?: string;
  email?: string;
}

interface AuditLogEntry {
  id: string;
  action: string;
  resource: string;
  resourceId?: string | null;
  reason?: string | null;
  time: string;
  user?: AuditLogUser | null;
}

interface AuditLogsResponse {
  total: number;
  take: number;
  skip: number;
  logs: AuditLogEntry[];
}

interface ResultRecord {
  id: string;
  matchId: string;
  status: string;
  finalScoreA: number;
  finalScoreB: number;
  winnerTeamId?: string | null;
}

interface OpsTask {
  id: string;
  title: string;
  department?: string;
  matchId?: string | null;
  assignees: { volunteerId: string; volunteer: { id: string; name: string } }[];
  priority: string;
  status: string;
}

/** Client-side cosmetic categorization only — AuditLog has no severity field on the backend. */
function deriveSeverity(action: string): 'Info' | 'Notice' | 'High' | 'Audit' {
  const a = action.toLowerCase();
  if (a.includes('override') || a.includes('approve')) return 'High';
  if (a.includes('assign') || a.includes('revoke')) return 'Audit';
  if (a.includes('reject') || a.includes('alert')) return 'Notice';
  return 'Info';
}

// Plain-English phrasing for the audit ledger — conveners shouldn't need to
// read dotted permission codes like "result.override" to know what happened.
const ACTION_PHRASES: Record<string, string> = {
  'result.approve': 'Result approved',
  'result.reject': 'Result rejected',
  'result.override': 'Result overridden by convener',
  'result.submit': 'Result submitted',
  'match.start': 'Match started',
  'match.pause': 'Match paused',
  'match.resume': 'Match resumed',
  'match.end': 'Match ended',
  'match.update': 'Match details updated',
  'match.reschedule': 'Match rescheduled',
  'score.update': 'Score updated',
  'role.assign': 'Role assigned to a user',
  'role.revoke': 'Role revoked from a user',
  'user.login': 'User signed in',
  'user.update': 'User account updated',
  'participant.create': 'Participant registered',
  'participant.update': 'Participant record updated',
  'sponsor.create': 'Sponsor added',
  'sponsor.update': 'Sponsor updated',
  'sponsor.delete': 'Sponsor removed',
  'venue.create': 'Venue added',
  'venue.update': 'Venue updated',
  'sport.create': 'Sport added',
  'sport.update': 'Sport updated',
  'media.create': 'Media uploaded',
  'media.update': 'Media updated',
  'media.publish': 'Announcement published',
};

function humanizeAction(action: string): string {
  const known = ACTION_PHRASES[action.toLowerCase()];
  if (known) return known;
  const words = action.replace(/[._]/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function OrganizerDashboardContent() {
  const { authenticated, hasPermission, hasRole } = useAuth();
  const isWebDevHead = hasRole('WEB_DEV_HEAD');
  const canApprove = hasPermission('result.approve');
  const canOverride = hasPermission('result.override');
  const canCreateTask = hasPermission('task.create');
  const canUpdateTask = hasPermission('task.update');
  // Any ground-level role (has tasks, can't assign them) gets the self-check-in
  // widget — permission-derived so it automatically covers Sports/Media/Security
  // volunteers alike instead of a hardcoded role-name list.
  const isFieldVolunteer = hasPermission('task.view') && !canCreateTask;
  const isSecurityVolunteer = hasRole('HOSPITALITY_SECURITY_VOLUNTEER');

  // Section visibility — each organizer only sees the slices of the dashboard their role
  // actually needs ("neither more nor less info"), gated by real backend permissions
  // rather than a hardcoded role name.
  const canSeeMatchesDept =
    hasPermission('match.update') || hasPermission('score.update') || canApprove;
  // task.create is granted only to department Heads/Coordinators/Convener (see seed.ts) —
  // it's the reliable "is this a Head, not a rank-and-file volunteer" signal. A plain
  // volunteer of ANY department keeps task.view/task.update (so they can work their own
  // assigned tasks) but never gets the full Workforce dispatch tab (roster + department-wide
  // task list + create/assign) — they get a "My Tasks" view scoped to just their own tasks
  // instead (inside the Security tab for Security Volunteers, or its own tab otherwise).
  const canSeeWorkforceDept = hasPermission('task.view') && canCreateTask;
  const isDepartmentVolunteer = hasPermission('task.view') && !canCreateTask;
  const canSeeMediaDept =
    hasPermission('media.create') ||
    hasPermission('media.publish') ||
    hasPermission('media.update');
  const canSubmitMedia = hasPermission('media.create');
  const canApproveMedia = hasPermission('media.publish');
  const canSeeSecurityDept = hasPermission('security.access');
  const canSeeAudit = hasPermission('audit.view');
  const canSeeAllDepts = canSeeMatchesDept && canSeeWorkforceDept && canSeeMediaDept;
  // A plain volunteer outside Security has no department-specific tab of their own —
  // give them a lightweight "My Tasks" tab instead of the full Workforce dashboard.
  // Security Volunteers already get their own-tasks view folded into the Security tab.
  const canSeeMyTasksTab = isDepartmentVolunteer && !canSeeSecurityDept;

  const visibleDeptTabs = (
    [
      canSeeAllDepts ? { id: 'all' as const, label: 'All Departments' } : null,
      canSeeMatchesDept ? { id: 'matches' as const, label: 'Live Matches & Scores' } : null,
      canSeeWorkforceDept ? { id: 'workforce' as const, label: 'Volunteer Workforce' } : null,
      canSeeMediaDept ? { id: 'media' as const, label: 'Media & Telemetry' } : null,
      canSeeSecurityDept ? { id: 'security' as const, label: 'Security Desk' } : null,
      canSeeMyTasksTab ? { id: 'mytasks' as const, label: 'My Tasks' } : null,
    ] as ({
      id: 'all' | 'matches' | 'workforce' | 'media' | 'security' | 'mytasks';
      label: string;
    } | null)[]
  ).filter(
    (
      t,
    ): t is {
      id: 'all' | 'matches' | 'workforce' | 'media' | 'security' | 'mytasks';
      label: string;
    } => t !== null,
  );

  const [activeDept, setActiveDept] = useState<
    'all' | 'matches' | 'workforce' | 'media' | 'security' | 'mytasks'
  >('all');
  // Derived rather than synced via effect: falls back to the first department this
  // role can actually see if the stored selection isn't (or is no longer) permitted.
  const effectiveActiveDept = visibleDeptTabs.some((t) => t.id === activeDept)
    ? activeDept
    : visibleDeptTabs[0]?.id;

  // Inline banner notification (mirrors the pattern used on /rbac)
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const showBanner = useCallback((type: 'success' | 'error', message: string) => {
    setBanner({ type, message });
    setTimeout(() => setBanner(null), 5000);
  }, []);

  // Adaptive dashboard overview
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  // Public venue directory (used for the "Operational Venues" KPI card)
  const [venues, setVenues] = useState<Venue[]>([]);

  // Live match activity
  const [liveMatches, setLiveMatches] = useState<LiveActivityMatch[]>([]);
  const [liveLoading, setLiveLoading] = useState(true);
  const [liveError, setLiveError] = useState<string | null>(null);

  // Pending result approvals (only fetched when the viewer holds result.approve)
  const [pendingApprovals, setPendingApprovals] = useState<PendingApprovalResult[]>([]);
  const [approvalsLoading, setApprovalsLoading] = useState(false);
  const [approvalsError, setApprovalsError] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  // Audit log ledger (defensive: hide panel entirely on 403)
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(true);
  const [auditUnavailable, setAuditUnavailable] = useState(false);

  // Web Dev Head system health triage panel
  const [systemHealth, setSystemHealth] = useState<{
    server: { uptimeSeconds: number; nodeVersion: string; environment: string };
    database: { connected: boolean; latencyMs: number };
    auditActivity: { totalEvents: number; last24h: number };
    recentIssues: AuditLogEntry[];
  } | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);

  // Dispatch Announcement modal — structured, targeted announcement backed by /api/announcements
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState<boolean>(false);
  const [announcementHeading, setAnnouncementHeading] = useState<string>('');
  const [announcementDescription, setAnnouncementDescription] = useState<string>('');
  const [announcementTargets, setAnnouncementTargets] = useState<string[]>([]);
  const [dispatchSubmitting, setDispatchSubmitting] = useState<boolean>(false);
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const [recentAnnouncements, setRecentAnnouncements] = useState<
    { id: string; heading: string; description: string; targets: string[]; createdAt: string }[]
  >([]);

  // Site branding — logo shown in the navbar and browser tab, media-team managed
  const [siteLogoUrl, setSiteLogoUrl] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  const handleLogoUpload = async (file: File | null) => {
    setLogoError(null);
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setLogoError('Please upload an image file (PNG, JPG, SVG, etc).');
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setLogoError('That image is too large — please use a logo under 2MB.');
      return;
    }
    setLogoUploading(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const updated = await apiPatch<{ logoUrl: string | null }>('/site-settings', {
        logoUrl: dataUrl,
      });
      setSiteLogoUrl(updated.logoUrl);
      showBanner(
        'success',
        'Site logo updated — it now shows in the navbar and browser tab for every visitor.',
      );
    } catch (err) {
      setLogoError(err instanceof ApiError ? err.message : 'Failed to update site logo.');
    } finally {
      setLogoUploading(false);
    }
  };

  const handleLogoRemove = async () => {
    setLogoError(null);
    setLogoUploading(true);
    try {
      const updated = await apiPatch<{ logoUrl: string | null }>('/site-settings', {
        logoUrl: null,
      });
      setSiteLogoUrl(updated.logoUrl);
      showBanner('success', 'Site logo removed — the navbar now shows the default mark.');
    } catch (err) {
      setLogoError(err instanceof ApiError ? err.message : 'Failed to remove site logo.');
    } finally {
      setLogoUploading(false);
    }
  };

  // Media Review Queue — media team submits photos (media.create), media head approves (media.publish)
  const [mediaQueue, setMediaQueue] = useState<MediaAsset[]>([]);
  const [mediaQueueLoading, setMediaQueueLoading] = useState(true);
  const [mediaReviewingId, setMediaReviewingId] = useState<string | null>(null);
  const [isSubmitPhotoModalOpen, setIsSubmitPhotoModalOpen] = useState(false);
  const [photoSlot, setPhotoSlot] = useState<'GALLERY' | 'ABOUT'>('GALLERY');
  const [photoTitle, setPhotoTitle] = useState('');
  const [photoCategory, setPhotoCategory] = useState('');
  const [photoCaption, setPhotoCaption] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [photoSubmitting, setPhotoSubmitting] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const loadMediaQueue = useCallback(async () => {
    if (!canSubmitMedia && !canApproveMedia) {
      setMediaQueueLoading(false);
      return;
    }
    setMediaQueueLoading(true);
    try {
      const data = await apiAuthedGet<MediaAsset[]>('/media-assets');
      setMediaQueue(Array.isArray(data) ? data : []);
    } catch {
      setMediaQueue([]);
    } finally {
      setMediaQueueLoading(false);
    }
  }, [canSubmitMedia, canApproveMedia]);

  const handleSubmitPhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoTitle.trim() || !photoDataUrl) return;
    setPhotoSubmitting(true);
    setPhotoError(null);
    try {
      await apiPost('/media-assets', {
        slot: photoSlot,
        title: photoTitle.trim(),
        category: photoCategory.trim() || undefined,
        caption: photoCaption.trim() || undefined,
        imageUrl: photoDataUrl,
      });
      setIsSubmitPhotoModalOpen(false);
      setPhotoTitle('');
      setPhotoCategory('');
      setPhotoCaption('');
      setPhotoDataUrl(null);
      showBanner(
        'success',
        'Photo submitted — it will appear on the site once the Media Head approves it.',
      );
      loadMediaQueue();
    } catch (err) {
      setPhotoError(err instanceof ApiError ? err.message : 'Failed to submit photo.');
    } finally {
      setPhotoSubmitting(false);
    }
  };

  const handleReviewMedia = async (id: string, decision: 'approve' | 'reject') => {
    setMediaReviewingId(id);
    try {
      await apiPatch(`/media-assets/${id}/${decision}`, {});
      showBanner(
        'success',
        decision === 'approve' ? 'Photo approved and published.' : 'Photo rejected.',
      );
      loadMediaQueue();
    } catch (err) {
      showBanner('error', err instanceof ApiError ? err.message : `Failed to ${decision} photo.`);
    } finally {
      setMediaReviewingId(null);
    }
  };

  const loadAnnouncements = useCallback(async () => {
    try {
      const list = await apiAuthedGet<
        {
          id: string;
          heading: string;
          description: string;
          targets: string[];
          createdAt: string;
        }[]
      >('/announcements');
      setRecentAnnouncements(Array.isArray(list) ? list : []);
    } catch {
      setRecentAnnouncements([]);
    }
  }, []);

  // Workforce & Volunteer Dispatch — backed by /api/operations-tasks and /api/volunteers
  const [opsSummary, setOpsSummary] = useState<{
    totalRoster: number;
    activeOnGround: number;
    standbyReserve: number;
  } | null>(null);
  const [opsTasks, setOpsTasks] = useState<OpsTask[]>([]);
  const [opsLoading, setOpsLoading] = useState<boolean>(true);
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState<boolean>(false);
  const [newTaskTitle, setNewTaskTitle] = useState<string>('');
  const [newTaskDepartment, setNewTaskDepartment] = useState<string>('');
  const [newTaskAssigneeIds, setNewTaskAssigneeIds] = useState<string[]>([]);
  const [assigneeSearch, setAssigneeSearch] = useState<string>('');
  const [newTaskMatchId, setNewTaskMatchId] = useState<string>('');
  const [taskMatchOptions, setTaskMatchOptions] = useState<
    {
      id: string;
      matchNumber?: string | null;
      teamA?: { name: string } | null;
      teamB?: { name: string } | null;
      tournament?: { sport?: { name: string } | null } | null;
    }[]
  >([]);
  const [newTaskSubmitting, setNewTaskSubmitting] = useState<boolean>(false);
  const [newTaskError, setNewTaskError] = useState<string | null>(null);
  const [checkInVenueId, setCheckInVenueId] = useState<string>('');
  const [checkingIn, setCheckingIn] = useState<boolean>(false);
  const [checkInError, setCheckInError] = useState<string | null>(null);
  const [volunteerRoster, setVolunteerRoster] = useState<
    {
      id: string;
      name: string;
      department: string;
      venueName?: string | null;
      currentVenue?: { id: string; name: string } | null;
      checkedInAt?: string | null;
    }[]
  >([]);

  const loadOpsData = useCallback(async () => {
    setOpsLoading(true);
    try {
      const [summary, tasks, volunteers] = await Promise.all([
        apiAuthedGet<{ totalRoster: number; activeOnGround: number; standbyReserve: number }>(
          '/operations-tasks/summary',
        ),
        apiAuthedGet<OpsTask[]>('/operations-tasks'),
        canSeeWorkforceDept
          ? apiAuthedGet<typeof volunteerRoster>('/operations-tasks/assignees')
          : Promise.resolve([]),
      ]);
      setOpsSummary(summary);
      setOpsTasks(Array.isArray(tasks) ? tasks : []);
      setVolunteerRoster(Array.isArray(volunteers) ? volunteers : []);
    } catch {
      setOpsSummary(null);
      setOpsTasks([]);
    } finally {
      setOpsLoading(false);
    }
  }, [canSeeWorkforceDept]);

  // Lazily loaded only once the task modal is opened — most departments never
  // need to link a task to a match, so this stays out of the default page load.
  useEffect(() => {
    if (!isNewTaskModalOpen || !hasPermission('match.view') || taskMatchOptions.length > 0) return;
    apiAuthedGet<typeof taskMatchOptions>('/matches')
      .then((data) => setTaskMatchOptions(Array.isArray(data) ? data : []))
      .catch(() => setTaskMatchOptions([]));
  }, [isNewTaskModalOpen, hasPermission, taskMatchOptions.length]);

  const handleTaskStatus = async (task: OpsTask, status: 'IN_PROGRESS' | 'DONE') => {
    try {
      await apiPatch(`/operations-tasks/${task.id}`, { status });
      showBanner('success', `Task marked ${status.replace('_', ' ').toLowerCase()}.`);
      await loadOpsData();
    } catch (err) {
      showBanner('error', err instanceof ApiError ? err.message : 'Could not update the task.');
    }
  };

  const handleCheckIn = async () => {
    if (!checkInVenueId) return;
    setCheckingIn(true);
    setCheckInError(null);
    try {
      await apiPost('/volunteers/me/check-in', { venueId: checkInVenueId });
      showBanner('success', 'Checked in — your location is now visible to your department head.');
      await loadOpsData();
    } catch (err) {
      setCheckInError(err instanceof ApiError ? err.message : 'Failed to check in.');
    } finally {
      setCheckingIn(false);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || (!newTaskDepartment && newTaskAssigneeIds.length === 0)) return;
    setNewTaskSubmitting(true);
    setNewTaskError(null);
    try {
      await apiPost('/operations-tasks', {
        title: newTaskTitle.trim(),
        department: newTaskDepartment || undefined,
        assigneeIds: newTaskAssigneeIds.length ? newTaskAssigneeIds : undefined,
        matchId: newTaskMatchId || undefined,
      });
      setIsNewTaskModalOpen(false);
      setNewTaskTitle('');
      setNewTaskDepartment('');
      setNewTaskAssigneeIds([]);
      setNewTaskMatchId('');
      setAssigneeSearch('');
      showBanner('success', 'Operations task assigned.');
      loadOpsData();
    } catch (err) {
      setNewTaskError(err instanceof ApiError ? err.message : 'Failed to assign task.');
    } finally {
      setNewTaskSubmitting(false);
    }
  };

  const [isScoreOverrideModalOpen, setIsScoreOverrideModalOpen] = useState<boolean>(false);
  const [selectedMatch, setSelectedMatch] = useState<LiveActivityMatch | null>(null);
  const [overrideResult, setOverrideResult] = useState<ResultRecord | null>(null);
  const [overrideLookupState, setOverrideLookupState] = useState<
    'idle' | 'loading' | 'found' | 'not-found'
  >('idle');
  const [overrideScoreA, setOverrideScoreA] = useState<number>(0);
  const [overrideScoreB, setOverrideScoreB] = useState<number>(0);
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [overrideSubmitting, setOverrideSubmitting] = useState<boolean>(false);
  const [overrideError, setOverrideError] = useState<string | null>(null);

  // ===================================
  // Data loading
  // ===================================

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true);
    setOverviewError(null);
    try {
      const data = await apiAuthedGet<DashboardOverview>('/dashboard/overview');
      setOverview(data);
    } catch (err) {
      setOverviewError(
        err instanceof ApiError ? err.message : 'Failed to load dashboard overview.',
      );
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  const loadLiveActivity = useCallback(async () => {
    setLiveLoading(true);
    setLiveError(null);
    try {
      const data = await apiAuthedGet<LiveActivityMatch[]>('/dashboard/live-activity');
      setLiveMatches(Array.isArray(data) ? data : []);
    } catch (err) {
      setLiveError(err instanceof ApiError ? err.message : 'Failed to load live match activity.');
    } finally {
      setLiveLoading(false);
    }
  }, []);

  const loadPendingApprovals = useCallback(async () => {
    if (!canApprove) return;
    setApprovalsLoading(true);
    setApprovalsError(null);
    try {
      const data = await apiAuthedGet<PendingApprovalResult[]>('/dashboard/pending-approvals');
      setPendingApprovals(Array.isArray(data) ? data : []);
    } catch (err) {
      setApprovalsError(
        err instanceof ApiError ? err.message : 'Failed to load pending approvals.',
      );
    } finally {
      setApprovalsLoading(false);
    }
  }, [canApprove]);

  const loadAuditLogs = useCallback(async () => {
    if (!canSeeAudit) {
      setAuditLoading(false);
      return;
    }
    setAuditLoading(true);
    try {
      const data = await apiAuthedGet<AuditLogsResponse>('/dashboard/audit-logs?limit=25');
      setAuditLogs(Array.isArray(data?.logs) ? data.logs : []);
      setAuditUnavailable(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setAuditUnavailable(true);
      }
      setAuditLogs([]);
    } finally {
      setAuditLoading(false);
    }
  }, [canSeeAudit]);

  const loadSystemHealth = useCallback(async () => {
    if (!isWebDevHead) {
      setHealthLoading(false);
      return;
    }
    setHealthLoading(true);
    try {
      const data = await apiAuthedGet<typeof systemHealth>('/dashboard/system-health');
      setSystemHealth(data);
    } catch {
      setSystemHealth(null);
    } finally {
      setHealthLoading(false);
    }
  }, [isWebDevHead]);

  useEffect(() => {
    if (!authenticated) return;
    // Deferred via a microtask so the initial setState calls inside these loaders
    // don't run synchronously within the effect body (matches the pattern in auth-context.tsx).
    Promise.resolve().then(() => {
      loadOverview();
      loadLiveActivity();
      loadAuditLogs();
      loadSystemHealth();
      fetchVenues().then(setVenues);
    });
  }, [authenticated, loadOverview, loadLiveActivity, loadAuditLogs, loadSystemHealth]);

  useEffect(() => {
    if (!authenticated) return;
    Promise.resolve().then(() => {
      loadPendingApprovals();
    });
  }, [authenticated, loadPendingApprovals]);

  useEffect(() => {
    if (!authenticated || !(canSeeWorkforceDept || isDepartmentVolunteer)) return;
    Promise.resolve().then(() => {
      loadOpsData();
    });
  }, [authenticated, canSeeWorkforceDept, isDepartmentVolunteer, loadOpsData]);

  useEffect(() => {
    if (!authenticated || !canSeeMediaDept) return;
    Promise.resolve().then(() => {
      loadAnnouncements();
      loadMediaQueue();
      fetchSiteSettings().then((s) => setSiteLogoUrl(s.logoUrl));
    });
  }, [authenticated, canSeeMediaDept, loadAnnouncements, loadMediaQueue]);

  // ===================================
  // Derived KPI values (real backend data only — never fabricated)
  // ===================================

  const metrics = overview?.metrics;
  const totalVenues = venues.length;
  const activeVenues = venues.filter((v) => (v.status || '').toUpperCase() === 'ACTIVE').length;
  const matchesTotal = metrics?.matchesCount;
  const matchesCompleted = metrics?.completedMatchesCount;
  const liveCount = metrics?.liveMatchesCount ?? liveMatches.length;
  const participantsTotal = metrics?.participantsCount ?? metrics?.totalParticipants;
  const participantsCheckedIn = metrics?.checkedInParticipantsCount ?? metrics?.checkedInCount;
  const checkInRate = metrics?.checkInRate;

  // ===================================
  // Handlers
  // ===================================

  const handleApproveMatch = async (resultId: string) => {
    setApprovingId(resultId);
    try {
      await apiPatch(`/results/${resultId}/approve`, {});
      showBanner('success', 'Result approved and certified.');
      await Promise.all([loadPendingApprovals(), loadAuditLogs(), loadOverview()]);
    } catch (err) {
      showBanner('error', err instanceof ApiError ? err.message : 'Failed to approve result.');
    } finally {
      setApprovingId(null);
    }
  };

  const toggleAnnouncementTarget = (target: string) => {
    setAnnouncementTargets((prev) =>
      prev.includes(target) ? prev.filter((t) => t !== target) : [...prev, target],
    );
  };

  const handleDispatchAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !announcementHeading.trim() ||
      !announcementDescription.trim() ||
      announcementTargets.length === 0
    )
      return;

    setDispatchSubmitting(true);
    setDispatchError(null);
    try {
      await apiPost('/announcements', {
        heading: announcementHeading.trim(),
        description: announcementDescription.trim(),
        targets: announcementTargets,
      });
      setIsDispatchModalOpen(false);
      setAnnouncementHeading('');
      setAnnouncementDescription('');
      setAnnouncementTargets([]);
      showBanner('success', 'Announcement dispatched to the selected audience(s).');
      loadAnnouncements();
    } catch (err) {
      setDispatchError(err instanceof ApiError ? err.message : 'Failed to dispatch announcement.');
    } finally {
      setDispatchSubmitting(false);
    }
  };

  const openScoreOverride = async (match: LiveActivityMatch) => {
    setSelectedMatch(match);
    setOverrideError(null);
    setOverrideResult(null);
    setOverrideReason('');
    setOverrideScoreA(match.teamAScore ?? 0);
    setOverrideScoreB(match.teamBScore ?? 0);
    setIsScoreOverrideModalOpen(true);
    setOverrideLookupState('loading');
    try {
      const result = await apiGet<ResultRecord>(`/matches/${match.id}/result`);
      setOverrideResult(result);
      setOverrideScoreA(result.finalScoreA);
      setOverrideScoreB(result.finalScoreB);
      setOverrideLookupState('found');
    } catch {
      setOverrideLookupState('not-found');
    }
  };

  const handleSaveScoreOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideResult) {
      setOverrideError(
        'No submitted result exists yet for this match — a result must be submitted before it can be overridden.',
      );
      return;
    }
    if (!overrideReason.trim()) {
      setOverrideError('A reason is required to override this result.');
      return;
    }

    setOverrideSubmitting(true);
    setOverrideError(null);
    try {
      await apiPatch(`/results/${overrideResult.id}/override`, {
        finalScoreA: overrideScoreA,
        finalScoreB: overrideScoreB,
        reason: overrideReason.trim(),
      });
      setIsScoreOverrideModalOpen(false);
      showBanner('success', 'Score override ratified and published.');
      await Promise.all([
        loadLiveActivity(),
        loadAuditLogs(),
        loadOverview(),
        canApprove ? loadPendingApprovals() : Promise.resolve(),
      ]);
    } catch (err) {
      setOverrideError(err instanceof ApiError ? err.message : 'Failed to override score.');
    } finally {
      setOverrideSubmitting(false);
    }
  };

  return (
    <RequireOrganizer>
      <div className="min-h-screen flex flex-col bg-[#121114] text-[#E8E6EB] selection:bg-[#FF4500] selection:text-white font-sans">
        <LiveTickerRibbon />
        <Navbar />
        <OrganizerNavRail />

        {/* Tri-color Accent Line */}
        <div className="w-full h-1 bg-gradient-to-r from-[#800020] via-[#FF4500] to-[#FFD700]"></div>

        {/* Operations Header Bar */}
        <section className="w-full bg-[#18151a] border-b border-white/10 px-4 sm:px-8 lg:px-10 py-6">
          <div className="max-w-[1520px] mx-auto flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6">
            <div className="flex flex-col gap-2">
              <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-black uppercase tracking-wide text-white leading-tight">
                ORGANIZER COMMAND OVERVIEW
              </h1>
              <p className="text-xs sm:text-sm text-zinc-400 font-sans">
                Indian Institute of Technology Jammu • Centralized Championship Secretariat &amp;
                Field Operations Console
                {overview?.persona && (
                  <span className="ml-2 text-[#FFD700]">
                    • Dashboard view: {overview.persona.replace(/_/g, ' ')}
                  </span>
                )}
              </p>
            </div>

            {/* Quick Actions — page navigation lives in the sticky organizer nav rail above;
                this row is for actions, not links, so it can't be mistaken for a nav item. */}
            <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
              {(canSeeMediaDept || canOverride) && (
                <button
                  onClick={() => setIsDispatchModalOpen(true)}
                  type="button"
                  className="h-11 px-5 rounded-xl bg-[#FF4500] hover:bg-[#ff5625] text-white font-display text-xs tracking-wider uppercase font-bold transition-all shadow-lg shadow-[#FF4500]/30 inline-flex items-center justify-center gap-2 border-2 border-white/20 whitespace-nowrap active:scale-95 ring-2 ring-[#FF4500]/40 ring-offset-2 ring-offset-[#0c0a0d]"
                >
                  <svg
                    className="w-4 h-4 text-white"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.684A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.316z"
                    />
                  </svg>
                  <span>Dispatch Announcement</span>
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Main Content Area */}
        <main className="max-w-[1520px] mx-auto w-full px-4 sm:px-8 lg:px-10 py-8 flex flex-col gap-8 flex-1">
          {banner && (
            <div
              className={`p-4 rounded-xl border text-sm flex items-center gap-3 ${
                banner.type === 'success'
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
              }`}
            >
              <span className="font-semibold">{banner.message}</span>
            </div>
          )}

          {overviewError && (
            <div className="p-4 rounded-xl border border-rose-500/40 bg-rose-950/60 text-rose-300 text-sm">
              {overviewError}
            </div>
          )}

          {/* Top KPI Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Card 1: Venues */}
            <div className="bg-[#1b191d] border border-white/10 hover:border-white/20 p-5 rounded-xl transition-all shadow-sm flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-mono text-[11px] font-medium tracking-wider uppercase text-[#a78a8a] block mb-1">
                    OPERATIONAL VENUES
                  </span>
                  <span className="font-display text-3xl font-bold text-white uppercase tracking-wide">
                    {totalVenues > 0 ? `${activeVenues} / ${totalVenues} LINKED` : 'NO VENUES YET'}
                  </span>
                </div>
                <div className="w-11 h-11 rounded-lg bg-[#800020]/40 border border-[#800020] flex items-center justify-center text-[#FFD700] shrink-0">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                    />
                  </svg>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                <span className="text-xs text-[#a78a8a] font-mono">Network Telemetry</span>
                <span className="text-xs font-bold text-[#FFD700] flex items-center gap-1.5 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FFD700] animate-pulse"></span>
                  {totalVenues > 0 ? Math.round((activeVenues / totalVenues) * 100) : 0}% PING
                  ACTIVE
                </span>
              </div>
            </div>

            {/* Card 2: Fixtures Progress */}
            <div className="bg-[#1b191d] border border-white/10 hover:border-white/20 p-5 rounded-xl transition-all shadow-sm flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-mono text-[11px] font-medium tracking-wider uppercase text-[#a78a8a] block mb-1">
                    FIXTURES PROGRESS
                  </span>
                  <span className="font-display text-3xl font-bold text-white uppercase tracking-wide">
                    {overviewLoading
                      ? 'LOADING…'
                      : matchesTotal !== undefined
                        ? `${matchesCompleted ?? 0} / ${matchesTotal} COMPLETED`
                        : `0 / 0 FOR ${(overview?.sport?.name || overview?.persona || 'YOUR ROLE').replace(/_/g, ' ')}`}
                  </span>
                </div>
                <div className="w-11 h-11 rounded-lg bg-[#800020] border border-[#800020] flex items-center justify-center text-[#FFD700] shrink-0">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-white/5 space-y-2">
                <div className="w-full bg-[#2a262e] h-2 rounded-md overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-[#800020] via-[#FF4500] to-[#FFD700] h-full rounded-md"
                    style={{
                      width: `${matchesTotal ? Math.round(((matchesCompleted ?? 0) / matchesTotal) * 100) : 0}%`,
                    }}
                  ></div>
                </div>
                <div className="flex justify-between text-xs text-[#a78a8a] font-mono">
                  <span className="text-[#FFD700] font-semibold">{liveCount} Live In-Play</span>
                  <span>{overview?.persona ? overview.persona.replace(/_/g, ' ') : ''}</span>
                </div>
              </div>
            </div>

            {/* Card 3: Delegations */}
            <div className="bg-[#1b191d] border border-white/10 hover:border-white/20 p-5 rounded-xl transition-all shadow-sm flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-mono text-[11px] font-medium tracking-wider uppercase text-[#a78a8a] block mb-1">
                    DELEGATIONS AT CONVOQUER
                  </span>
                  <span className="font-display text-3xl font-bold text-white uppercase tracking-wide">
                    {overviewLoading
                      ? 'LOADING…'
                      : participantsTotal !== undefined
                        ? `${participantsCheckedIn ?? 0} / ${participantsTotal} CLEARED`
                        : `${metrics?.openTasks ?? overview?.tasks?.filter((task) => task.status !== 'DONE').length ?? 0} OPEN TASKS`}
                  </span>
                </div>
                <div className="w-11 h-11 rounded-lg bg-[#2c2833] border border-white/10 flex items-center justify-center text-[#FFD700] shrink-0">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                <div>
                  <span className="font-display text-xl font-bold text-white leading-none">
                    {participantsCheckedIn ?? '—'}
                  </span>
                  <span className="text-[10px] uppercase text-[#a78a8a] block font-mono">
                    Athletes Cleared
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-display text-xl font-bold text-[#FFD700] leading-none">
                    {checkInRate !== undefined ? `${checkInRate}%` : '—'}
                  </span>
                  <span className="text-[10px] uppercase text-[#a78a8a] block font-mono">
                    Check-in Rate
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Shown to the Hospitality Head (full) and, read-only, to any Hospitality volunteer
              (the backend only populates `venues` for those two cases — see getVolunteerDashboard). */}
          {overview?.venues && (
            <section className="bg-[#1b191d] border border-white/10 rounded-2xl p-6">
              <h2 className="font-display text-2xl font-bold uppercase text-white">
                Expected audience per venue
              </h2>
              <p className="text-sm text-zinc-400 mt-1 mb-5">
                Projected from scheduled/live matches and the rosters of the teams playing — assumes
                every participant of a match&apos;s teams shows up as audience for it. Physical
                occupancy (from gate check-ins) shown alongside.
              </p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {overview.venues.map((venue) => (
                  <article
                    key={venue.venueId}
                    className="bg-[#201d23] border border-white/10 rounded-xl p-4 flex flex-col gap-2"
                  >
                    <p className="text-zinc-400 text-xs uppercase">{venue.venueName}</p>
                    <div className="flex items-baseline gap-3">
                      <div>
                        <strong className="text-3xl text-[#FFD700]">
                          {venue.expectedAudience}
                        </strong>
                        <p className="text-[10px] text-zinc-500 uppercase">expected audience</p>
                      </div>
                      <div>
                        <strong className="text-lg text-white">
                          {venue.currentPhysicalOccupancy}
                        </strong>
                        <p className="text-[10px] text-zinc-500 uppercase">present now</p>
                      </div>
                    </div>
                    {venue.matches.length > 0 ? (
                      <ul className="space-y-1 mt-1">
                        {venue.matches.map((m) => (
                          <li key={m.matchId} className="text-[11px] text-zinc-400 font-mono">
                            {m.sport}: {m.teamAName} vs {m.teamBName}
                            <span
                              className={`ml-1.5 ${m.status === 'LIVE' ? 'text-[#FF4500]' : 'text-zinc-500'}`}
                            >
                              ({m.status})
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[11px] text-zinc-600">
                        No scheduled or live matches here right now.
                      </p>
                    )}
                  </article>
                ))}
              </div>
            </section>
          )}

          {/* Department Controls & Concurrent Operations Matrix */}
          {visibleDeptTabs.length > 0 && (
            <div className="bg-[#1b191d] border border-white/10 rounded-2xl p-6 sm:p-8 flex flex-col gap-6 shadow-sm">
              {/* Department Navigation Switcher */}
              <div className="flex flex-col md:flex-row md:items-center justify-between pb-5 border-b border-white/10 gap-4">
                <div>
                  <span className="text-xs uppercase tracking-widest text-[#FFD700] font-bold block mb-1 font-mono">
                    DEPARTMENT CONTROLS
                  </span>
                  <h2 className="font-display text-2xl font-bold uppercase tracking-wider text-white">
                    CONCURRENT OPERATIONS MATRIX
                  </h2>
                </div>

                {/* Filter / Tab Pills — only the departments this role has permission to act on */}
                <div className="flex flex-wrap items-center gap-2 bg-[#151316] p-1.5 rounded-xl border border-white/10">
                  {visibleDeptTabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveDept(tab.id)}
                      type="button"
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-display uppercase tracking-wider font-semibold transition-all ${
                        effectiveActiveDept === tab.id
                          ? 'bg-[#800020] text-white shadow-sm font-bold'
                          : 'hover:text-white hover:bg-white/5 text-[#a78a8a]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Self check-in — every ground-level volunteer gets this regardless of which
                tab/card their role otherwise sees (it used to be nested inside the Head-only
                Workforce card, where a plain volunteer could never reach it). */}
              {isFieldVolunteer && (
                <div className="bg-[#181519] border border-[#FFD700]/20 p-3.5 rounded-lg flex flex-col sm:flex-row items-stretch sm:items-end gap-2.5">
                  <div className="flex-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#a78a8a] block mb-1">
                      Check In — Where are you right now?
                    </label>
                    <select
                      value={checkInVenueId}
                      onChange={(e) => setCheckInVenueId(e.target.value)}
                      className="w-full bg-[#0a0a0c] border border-white/15 p-2 rounded-lg text-white text-xs"
                    >
                      <option value="">Select a venue…</option>
                      {venues.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                        </option>
                      ))}
                    </select>
                    {checkInError && (
                      <p className="text-[10px] text-rose-300 mt-1">{checkInError}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={!checkInVenueId || checkingIn}
                    onClick={handleCheckIn}
                    className="px-4 py-2 rounded-lg bg-[#FFD700] text-black font-display text-xs font-bold uppercase tracking-wider shadow-md disabled:opacity-50 shrink-0"
                  >
                    {checkingIn ? 'Checking in…' : "I'm Here"}
                  </button>
                </div>
              )}

              {/* Department Cards Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* DEPT 1: Live Matches & Competition */}
                {canSeeMatchesDept &&
                  (effectiveActiveDept === 'all' || effectiveActiveDept === 'matches') && (
                    <div className="bg-[#201d23] border border-white/10 rounded-xl p-6 flex flex-col justify-between gap-5">
                      <div>
                        <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/5">
                          <div className="flex items-center gap-2.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#FF4500]"></span>
                            <h3 className="font-display text-lg font-bold uppercase tracking-wider text-white">
                              LIVE COMPETITION &amp; MATCH CONTROLS
                            </h3>
                          </div>
                        </div>

                        {liveLoading ? (
                          <div className="text-xs text-[#a78a8a] font-mono py-4">
                            Loading live matches…
                          </div>
                        ) : liveError ? (
                          <div className="text-xs text-[#FF4500] font-mono py-4">{liveError}</div>
                        ) : liveMatches.length === 0 ? (
                          <div className="text-xs text-[#a78a8a] font-mono py-4">
                            No matches are currently live.
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {liveMatches.map((m) => (
                              <div
                                key={m.id}
                                className="bg-[#181519] border border-white/5 hover:border-white/15 p-3.5 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
                              >
                                <div className="flex items-center gap-3">
                                  <span className="px-2 py-1 rounded bg-[#800020] text-white font-display text-xs font-bold uppercase shrink-0">
                                    {m.currentPeriod || m.status}
                                  </span>
                                  <div>
                                    <div className="font-display text-base uppercase font-bold text-white tracking-wide">
                                      {(
                                        m.tournament?.sport?.name ||
                                        m.tournament?.name ||
                                        'MATCH'
                                      ).toUpperCase()}
                                      {m.matchNumber ? ` ${m.matchNumber}` : ''}:{' '}
                                      <span className="text-[#FFD700]">
                                        {m.teamA?.name ?? 'Team A'} ({m.teamAScore ?? '—'})
                                      </span>{' '}
                                      <span className="text-white/40">vs</span>{' '}
                                      <span>
                                        {m.teamB?.name ?? 'Team B'} ({m.teamBScore ?? '—'})
                                      </span>
                                    </div>
                                    <span className="text-xs text-[#a78a8a] font-mono">
                                      {m.venue?.name || 'Venue TBD'}
                                    </span>
                                  </div>
                                </div>
                                {canOverride && (
                                  <button
                                    onClick={() => openScoreOverride(m)}
                                    type="button"
                                    className="shrink-0 px-3 py-1.5 rounded bg-[#2e2935] hover:bg-[#800020] text-white hover:text-[#FFD700] font-display text-xs font-bold uppercase border border-white/10 transition-all self-start sm:self-auto"
                                  >
                                    Score Override
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Convener Sign-Off Ledger */}
                      {canApprove && (
                        <div className="bg-[#171419] border border-white/10 p-4 rounded-xl">
                          <div className="flex items-center justify-between mb-3">
                            <span className="font-display text-xs uppercase tracking-wider text-[#FFD700] flex items-center gap-1.5 font-bold">
                              <svg
                                className="w-4 h-4 text-[#FFD700]"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                              </svg>
                              Convener Official Sign-Off Ledger
                            </span>
                            <span className="font-mono text-[11px] text-[#a78a8a] bg-[#221f24] px-2 py-0.5 rounded">
                              {approvalsLoading ? 'Loading…' : `${pendingApprovals.length} Pending`}
                            </span>
                          </div>

                          {approvalsError && (
                            <div className="text-xs text-[#FF4500] font-mono mb-2">
                              {approvalsError}
                            </div>
                          )}

                          {!approvalsLoading &&
                            !approvalsError &&
                            pendingApprovals.length === 0 && (
                              <div className="text-xs text-[#a78a8a] font-mono py-2">
                                No results awaiting certification.
                              </div>
                            )}

                          <div className="space-y-2">
                            {pendingApprovals.map((r) => (
                              <div
                                key={r.id}
                                className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 bg-[#201d24] rounded border border-white/5 gap-2"
                              >
                                <div>
                                  <span className="font-display text-sm uppercase text-white font-bold block">
                                    {r.match?.tournament?.sport?.name ||
                                      r.match?.tournament?.name ||
                                      'MATCH'}
                                    : {r.match?.teamA?.name ?? 'Team A'} ({r.finalScoreA}) -{' '}
                                    {r.match?.teamB?.name ?? 'Team B'} ({r.finalScoreB})
                                  </span>
                                  <span className="font-mono text-xs text-[#a78a8a]">
                                    Submitted by{' '}
                                    {r.submitter?.name || r.submitter?.email || 'Unknown'}
                                    {r.submittedAt
                                      ? ` • ${new Date(r.submittedAt).toLocaleString('en-IN')}`
                                      : ''}
                                  </span>
                                </div>
                                <button
                                  onClick={() => handleApproveMatch(r.id)}
                                  disabled={approvingId === r.id}
                                  type="button"
                                  className="px-3 py-1.5 rounded font-display text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap self-start sm:self-auto bg-[#FF4500] hover:bg-[#ff5625] text-white disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {approvingId === r.id ? 'Approving…' : 'Approve & Certify'}
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                {/* DEPT 2: Volunteer Workforce — backed by /api/operations-tasks and /api/volunteers */}
                {canSeeWorkforceDept &&
                  (effectiveActiveDept === 'all' || effectiveActiveDept === 'workforce') && (
                    <div className="bg-[#201d23] border border-white/10 rounded-xl p-6 flex flex-col justify-between gap-5">
                      <div>
                        <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/5">
                          <div className="flex items-center gap-2.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#FF4500]"></span>
                            <h3 className="font-display text-lg font-bold uppercase tracking-wider text-white">
                              WORKFORCE &amp; VOLUNTEER DISPATCH
                            </h3>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3 mb-4">
                          <div className="bg-[#181519] border border-white/5 p-3 rounded-lg text-center">
                            <span className="font-mono text-[10px] uppercase text-[#a78a8a] block">
                              Total Roster
                            </span>
                            <span className="font-display text-2xl font-bold text-white">
                              {opsLoading ? '—' : (opsSummary?.totalRoster ?? 0)}
                            </span>
                          </div>
                          <div className="bg-[#181519] border border-white/5 p-3 rounded-lg text-center">
                            <span className="font-mono text-[10px] uppercase text-[#FFD700] block">
                              Active On-Ground
                            </span>
                            <span className="font-display text-2xl font-bold text-[#FFD700]">
                              {opsLoading ? '—' : (opsSummary?.activeOnGround ?? 0)}
                            </span>
                          </div>
                          <div className="bg-[#181519] border border-white/5 p-3 rounded-lg text-center">
                            <span className="font-mono text-[10px] uppercase text-[#FF4500] block">
                              Standby Reserve
                            </span>
                            <span className="font-display text-2xl font-bold text-[#FF4500]">
                              {opsLoading ? '—' : (opsSummary?.standbyReserve ?? 0)}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-2.5">
                          {opsLoading ? (
                            <p className="text-xs text-[#a78a8a] font-mono py-4 text-center">
                              Loading tasks…
                            </p>
                          ) : opsTasks.length === 0 ? (
                            <p className="text-xs text-[#a78a8a] font-mono py-4 text-center">
                              No operations tasks assigned yet.
                            </p>
                          ) : (
                            opsTasks.map((task) => {
                              const assignedLabel = task.assignees.length
                                ? task.assignees.map((a) => a.volunteer.name).join(', ')
                                : task.department || 'Unassigned';
                              return (
                                <div
                                  key={task.id}
                                  className="flex items-center justify-between p-3 bg-[#181519] border border-white/5 rounded-lg"
                                >
                                  <div className="flex items-center gap-3">
                                    <span
                                      className={`w-8 h-8 rounded flex items-center justify-center shrink-0 font-bold border ${
                                        task.priority === 'URGENT'
                                          ? 'bg-[#800020]/50 border-[#800020] text-[#FF4500]'
                                          : 'bg-[#2c2833] border-white/10 text-[#FFD700]'
                                      }`}
                                    >
                                      {assignedLabel.slice(0, 2).toUpperCase()}
                                    </span>
                                    <div>
                                      <span className="text-xs font-semibold text-white block">
                                        {task.title}
                                      </span>
                                      <span className="font-mono text-[11px] text-[#a78a8a]">
                                        Assigned: {assignedLabel}
                                      </span>
                                    </div>
                                  </div>
                                  <span
                                    className={`px-2.5 py-1 rounded font-display text-[11px] font-bold uppercase tracking-wider ${
                                      task.priority === 'URGENT'
                                        ? 'bg-[#800020] text-white'
                                        : task.status === 'IN_PROGRESS'
                                          ? 'bg-[#2a2630] text-[#FFD700] border border-[#FFD700]/30'
                                          : 'bg-[#2a2630] text-[#a78a8a]'
                                    }`}
                                  >
                                    {task.status.replace('_', ' ')}
                                  </span>
                                  {canUpdateTask && task.status !== 'DONE' && (
                                    <div className="flex gap-1 ml-2">
                                      {task.status !== 'IN_PROGRESS' && (
                                        <button
                                          type="button"
                                          onClick={() => handleTaskStatus(task, 'IN_PROGRESS')}
                                          className="text-[10px] underline text-[#FFD700]"
                                        >
                                          Start
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => handleTaskStatus(task, 'DONE')}
                                        className="text-[10px] underline text-emerald-300"
                                      >
                                        Done
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>

                      {volunteerRoster.length > 0 && (
                        <div className="pt-1">
                          <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#a78a8a] mb-2">
                            Volunteer Locations
                          </h4>
                          <div className="space-y-1.5 max-h-56 overflow-y-auto">
                            {volunteerRoster.map((v) => (
                              <div
                                key={v.id}
                                className="flex items-center justify-between gap-2 bg-[#181519] border border-white/5 rounded-lg px-3 py-2"
                              >
                                <div className="min-w-0">
                                  <span className="text-xs font-semibold text-white block truncate">
                                    {v.name}
                                  </span>
                                  <span className="font-mono text-[10px] text-[#a78a8a]">
                                    Assigned: {v.venueName || '—'}
                                  </span>
                                </div>
                                <div className="text-right shrink-0">
                                  {v.currentVenue ? (
                                    <>
                                      <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 text-[10px] font-bold uppercase block">
                                        {v.currentVenue.name}
                                      </span>
                                      {v.checkedInAt && (
                                        <span className="font-mono text-[9px] text-[#a78a8a]">
                                          {new Date(v.checkedInAt).toLocaleTimeString('en-IN', {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                          })}
                                        </span>
                                      )}
                                    </>
                                  ) : (
                                    <span className="text-[10px] text-[#a78a8a] font-mono">
                                      Not checked in
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {canCreateTask && (
                        <div className="pt-2">
                          <button
                            onClick={() => setIsNewTaskModalOpen(true)}
                            type="button"
                            className="w-full py-2.5 bg-[#2a2630] hover:bg-[#34303b] border border-white/10 text-white font-display text-xs font-bold uppercase tracking-wider rounded transition-colors flex items-center justify-center gap-2"
                          >
                            <span>+</span> Assign New Operations Task
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                {/* DEPT 3: Media & Broadcast — the public ticker is now fully automatic (derived from live, telecast matches), so there is nothing to manually edit here anymore. This shows what was actually dispatched to the DB via /api/announcements. */}
                {canSeeMediaDept &&
                  (effectiveActiveDept === 'all' || effectiveActiveDept === 'media') && (
                    <div className="bg-[#201d23] border border-white/10 rounded-xl p-6 flex flex-col justify-between gap-5 col-span-1 lg:col-span-2">
                      <div>
                        <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/5">
                          <div className="flex items-center gap-2.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#800020]"></span>
                            <h3 className="font-display text-lg font-bold uppercase tracking-wider text-white">
                              RECENT DISPATCHES
                            </h3>
                          </div>
                          <span className="font-mono text-[10px] text-[#a78a8a]">
                            Live Ticker: auto-populated from telecast-flagged live matches — no
                            manual edit needed
                          </span>
                        </div>

                        <div className="space-y-2.5 max-h-64 overflow-y-auto">
                          {recentAnnouncements.length === 0 ? (
                            <p className="text-xs text-[#a78a8a] font-mono py-4 text-center">
                              No announcements dispatched yet.
                            </p>
                          ) : (
                            recentAnnouncements.map((a) => (
                              <div
                                key={a.id}
                                className="bg-[#181519] border border-white/10 p-3.5 rounded-lg"
                              >
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <span className="font-display text-xs font-bold text-white">
                                    {a.heading}
                                  </span>
                                  <span className="font-mono text-[10px] text-[#a78a8a] shrink-0">
                                    {new Date(a.createdAt).toLocaleString('en-IN', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      day: '2-digit',
                                      month: 'short',
                                    })}
                                  </span>
                                </div>
                                <p className="text-xs text-[#d6cfd7] mb-2">{a.description}</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {a.targets.map((t) => (
                                    <span
                                      key={t}
                                      className="px-2 py-0.5 rounded bg-[#2a2630] text-[10px] font-mono text-[#FFD700] border border-[#FFD700]/20"
                                    >
                                      {t.replace('_', ' ')}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                {/* Site Branding — logo shown in the navbar and browser tab */}
                {canSeeMediaDept &&
                  (effectiveActiveDept === 'all' || effectiveActiveDept === 'media') && (
                    <div className="bg-[#201d23] border border-white/10 rounded-xl p-6 flex flex-col gap-4">
                      <div className="flex items-center gap-2.5 pb-3 mb-1 border-b border-white/5">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#800020]"></span>
                        <h3 className="font-display text-lg font-bold uppercase tracking-wider text-white">
                          SITE LOGO
                        </h3>
                      </div>
                      {logoError && (
                        <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs">
                          {logoError}
                        </div>
                      )}
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-xl bg-[#181519] border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                          {siteLogoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element -- uploaded data URL preview
                            <img
                              src={siteLogoUrl}
                              alt="Current site logo"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-[10px] text-[#a78a8a] font-mono text-center px-1">
                              DEFAULT
                            </span>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex flex-wrap gap-2">
                            <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#2a2630] hover:bg-[#34303b] border border-white/10 text-white text-xs font-display font-bold uppercase tracking-wider cursor-pointer transition-colors">
                              {logoUploading ? 'Uploading…' : 'Upload New Logo'}
                              <input
                                type="file"
                                accept="image/*"
                                disabled={logoUploading}
                                className="hidden"
                                onChange={(e) => handleLogoUpload(e.target.files?.[0] || null)}
                              />
                            </label>
                            {siteLogoUrl && (
                              <button
                                type="button"
                                disabled={logoUploading}
                                onClick={handleLogoRemove}
                                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-rose-950/40 hover:bg-rose-900/50 border border-rose-500/30 text-rose-300 text-xs font-display font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
                              >
                                Remove Logo
                              </button>
                            )}
                          </div>
                          <p className="text-[10px] text-[#a78a8a] mt-1.5">
                            Applies live for every visitor — navbar &amp; browser tab. Under 2MB.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                {/* Media Review Queue — media.create submits, media.publish approves/rejects */}
                {canSeeMediaDept &&
                  (effectiveActiveDept === 'all' || effectiveActiveDept === 'media') && (
                    <div className="bg-[#201d23] border border-white/10 rounded-xl p-6 flex flex-col gap-4 col-span-1 lg:col-span-2">
                      <div className="flex items-center justify-between pb-3 mb-1 border-b border-white/5">
                        <div className="flex items-center gap-2.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#800020]"></span>
                          <h3 className="font-display text-lg font-bold uppercase tracking-wider text-white">
                            {canApproveMedia ? 'MEDIA REVIEW QUEUE' : 'MY PHOTO SUBMISSIONS'}
                          </h3>
                        </div>
                        {canSubmitMedia && (
                          <button
                            onClick={() => setIsSubmitPhotoModalOpen(true)}
                            type="button"
                            className="px-3.5 py-1.5 rounded-lg bg-[#2a2630] hover:bg-[#34303b] border border-white/10 text-white text-xs font-display font-bold uppercase tracking-wider transition-colors"
                          >
                            + Submit Photo
                          </button>
                        )}
                      </div>

                      {mediaQueueLoading ? (
                        <p className="text-xs text-[#a78a8a] font-mono py-4 text-center">
                          Loading…
                        </p>
                      ) : mediaQueue.length === 0 ? (
                        <p className="text-xs text-[#a78a8a] font-mono py-4 text-center">
                          {canSubmitMedia ? 'No photos submitted yet.' : 'Nothing pending review.'}
                        </p>
                      ) : (
                        <div className="space-y-2.5 max-h-72 overflow-y-auto">
                          {mediaQueue.map((asset) => (
                            <div
                              key={asset.id}
                              className="flex items-center gap-3 bg-[#181519] border border-white/10 p-3 rounded-lg"
                            >
                              <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-[#0c0a0d]">
                                {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary submitted data URL */}
                                <img
                                  src={asset.imageUrl}
                                  alt={asset.title}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-white text-xs font-bold truncate">
                                    {asset.title}
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded bg-[#2a2630] text-[10px] font-mono text-[#FFD700]">
                                    {asset.slot}
                                  </span>
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                                      asset.status === 'APPROVED'
                                        ? 'bg-emerald-950 text-emerald-300'
                                        : asset.status === 'REJECTED'
                                          ? 'bg-rose-950 text-rose-300'
                                          : 'bg-[#2a2630] text-[#a78a8a]'
                                    }`}
                                  >
                                    {asset.status}
                                  </span>
                                </div>
                                {asset.rejectionReason && (
                                  <p className="text-[10px] text-rose-300 mt-0.5">
                                    Reason: {asset.rejectionReason}
                                  </p>
                                )}
                              </div>
                              {canApproveMedia && asset.status === 'PENDING' && (
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    disabled={mediaReviewingId === asset.id}
                                    onClick={() => handleReviewMedia(asset.id, 'approve')}
                                    className="px-2.5 py-1.5 rounded-lg bg-emerald-800 hover:bg-emerald-700 text-white text-[10px] font-bold uppercase disabled:opacity-50"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    type="button"
                                    disabled={mediaReviewingId === asset.id}
                                    onClick={() => handleReviewMedia(asset.id, 'reject')}
                                    className="px-2.5 py-1.5 rounded-lg bg-rose-900 hover:bg-rose-800 text-white text-[10px] font-bold uppercase disabled:opacity-50"
                                  >
                                    Reject
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                {/* Security Desk — links out to the full /security kiosk (search, check-in, gate movement, flagging) */}
                {canSeeSecurityDept &&
                  (effectiveActiveDept === 'all' || effectiveActiveDept === 'security') && (
                    <div className="bg-[#201d23] border border-white/10 rounded-xl p-6 flex flex-col gap-4">
                      <div className="flex items-center justify-between pb-3 mb-1 border-b border-white/5">
                        <div className="flex items-center gap-2.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                          <h3 className="font-display text-lg font-bold uppercase tracking-wider text-white">
                            SECURITY DESK
                          </h3>
                        </div>
                      </div>
                      <p className="text-xs text-[#a78a8a] font-mono">
                        Search participants, check gate passes in/out, review flagged entries, and
                        inspect submitted photo/ID documents from the live security desk.
                      </p>
                      <div className="flex flex-wrap gap-2.5">
                        <Link
                          href="/security"
                          className="px-4 py-2 rounded-lg bg-[#FF4500] hover:bg-[#ff5625] text-white text-xs font-display font-bold uppercase tracking-wider transition-colors"
                        >
                          Open Security Dashboard
                        </Link>
                        <Link
                          href="/pass"
                          className="px-4 py-2 rounded-lg bg-[#2a2630] hover:bg-[#34303b] border border-white/10 text-white text-xs font-display font-bold uppercase tracking-wider transition-colors"
                        >
                          Open Pass Form
                        </Link>
                      </div>

                      {isSecurityVolunteer && !canSeeWorkforceDept && (
                        <div className="pt-2 border-t border-white/5">
                          <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#a78a8a] mb-2 mt-3">
                            My Tasks
                          </h4>
                          {opsLoading ? (
                            <p className="text-xs text-[#a78a8a] font-mono py-3 text-center">
                              Loading tasks…
                            </p>
                          ) : opsTasks.length === 0 ? (
                            <p className="text-xs text-[#a78a8a] font-mono py-3 text-center">
                              No tasks assigned to you yet.
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {opsTasks.map((task) => (
                                <div
                                  key={task.id}
                                  className="flex items-center justify-between p-3 bg-[#181519] border border-white/5 rounded-lg"
                                >
                                  <div>
                                    <span className="text-xs font-semibold text-white block">
                                      {task.title}
                                    </span>
                                    <span className="font-mono text-[11px] text-[#a78a8a]">
                                      {task.department || 'General duty'}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span
                                      className={`px-2.5 py-1 rounded font-display text-[11px] font-bold uppercase tracking-wider ${
                                        task.status === 'IN_PROGRESS'
                                          ? 'bg-[#2a2630] text-[#FFD700] border border-[#FFD700]/30'
                                          : 'bg-[#2a2630] text-[#a78a8a]'
                                      }`}
                                    >
                                      {task.status.replace('_', ' ')}
                                    </span>
                                    {canUpdateTask && task.status !== 'DONE' && (
                                      <div className="flex gap-1.5">
                                        {task.status !== 'IN_PROGRESS' && (
                                          <button
                                            type="button"
                                            onClick={() => handleTaskStatus(task, 'IN_PROGRESS')}
                                            className="text-[10px] underline text-[#FFD700]"
                                          >
                                            Start
                                          </button>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() => handleTaskStatus(task, 'DONE')}
                                          className="text-[10px] underline text-emerald-300"
                                        >
                                          Done
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                {/* My Department — plain department volunteers (not Heads) get a read-only slice of what
                  their Head sees (e.g. the venue audience projection above, when it applies to them)
                  plus only the tasks assigned to them — never the roster, never create/assign controls,
                  never the full Workforce dispatch. That split is the "can't misuse the power" boundary. */}
                {canSeeMyTasksTab &&
                  (effectiveActiveDept === 'all' || effectiveActiveDept === 'mytasks') && (
                    <div className="bg-[#201d23] border border-white/10 rounded-xl p-6 flex flex-col gap-4">
                      <div className="flex items-center justify-between pb-3 border-b border-white/5">
                        <div className="flex items-center gap-2.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#FFD700]"></span>
                          <h3 className="font-display text-lg font-bold uppercase tracking-wider text-white">
                            MY TASKS
                          </h3>
                        </div>
                      </div>
                      <p className="text-[11px] text-[#a78a8a] font-mono -mt-2">
                        View-only — task assignment and the full department roster stay with your
                        department Head.
                      </p>
                      {opsLoading ? (
                        <p className="text-xs text-[#a78a8a] font-mono py-3 text-center">
                          Loading tasks…
                        </p>
                      ) : opsTasks.length === 0 ? (
                        <p className="text-xs text-[#a78a8a] font-mono py-3 text-center">
                          No tasks assigned to you yet.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {opsTasks.map((task) => (
                            <div
                              key={task.id}
                              className="flex items-center justify-between p-3 bg-[#181519] border border-white/5 rounded-lg"
                            >
                              <div>
                                <span className="text-xs font-semibold text-white block">
                                  {task.title}
                                </span>
                                <span className="font-mono text-[11px] text-[#a78a8a]">
                                  {task.department || 'General duty'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span
                                  className={`px-2.5 py-1 rounded font-display text-[11px] font-bold uppercase tracking-wider ${
                                    task.status === 'IN_PROGRESS'
                                      ? 'bg-[#2a2630] text-[#FFD700] border border-[#FFD700]/30'
                                      : 'bg-[#2a2630] text-[#a78a8a]'
                                  }`}
                                >
                                  {task.status.replace('_', ' ')}
                                </span>
                                {canUpdateTask && task.status !== 'DONE' && (
                                  <div className="flex gap-1.5">
                                    {task.status !== 'IN_PROGRESS' && (
                                      <button
                                        type="button"
                                        onClick={() => handleTaskStatus(task, 'IN_PROGRESS')}
                                        className="text-[10px] underline text-[#FFD700]"
                                      >
                                        Start
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => handleTaskStatus(task, 'DONE')}
                                      className="text-[10px] underline text-emerald-300"
                                    >
                                      Done
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
              </div>
            </div>
          )}

          {/* Submit Photo Modal */}
          {isSubmitPhotoModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
              <div className="bg-[#1d1a20] border border-white/15 max-w-lg w-full p-6 rounded-2xl shadow-2xl flex flex-col gap-4">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <h3 className="font-display text-lg font-bold uppercase text-white">
                    Submit Photo
                  </h3>
                  <button
                    onClick={() => setIsSubmitPhotoModalOpen(false)}
                    className="text-zinc-400 hover:text-white"
                    type="button"
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
                <form onSubmit={handleSubmitPhoto} className="space-y-3 text-xs">
                  {photoError && (
                    <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-300">
                      {photoError}
                    </div>
                  )}
                  <div>
                    <label className="font-bold uppercase text-zinc-400 block mb-1">
                      Where does this go?
                    </label>
                    <select
                      value={photoSlot}
                      onChange={(e) => setPhotoSlot(e.target.value as 'GALLERY' | 'ABOUT')}
                      className="w-full bg-[#0a0a0c] border border-white/15 p-2.5 rounded-lg text-white"
                    >
                      <option value="GALLERY">Championship Gallery</option>
                      <option value="ABOUT">About Page</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-bold uppercase text-zinc-400 block mb-1">Title *</label>
                    <input
                      type="text"
                      required
                      value={photoTitle}
                      onChange={(e) => setPhotoTitle(e.target.value)}
                      className="w-full bg-[#0a0a0c] border border-white/15 p-2.5 rounded-lg text-white"
                    />
                  </div>
                  {photoSlot === 'GALLERY' && (
                    <div>
                      <label className="font-bold uppercase text-zinc-400 block mb-1">
                        Category (e.g. CRICKET, CEREMONY)
                      </label>
                      <input
                        type="text"
                        value={photoCategory}
                        onChange={(e) => setPhotoCategory(e.target.value)}
                        className="w-full bg-[#0a0a0c] border border-white/15 p-2.5 rounded-lg text-white"
                      />
                    </div>
                  )}
                  <div>
                    <label className="font-bold uppercase text-zinc-400 block mb-1">Caption</label>
                    <textarea
                      rows={2}
                      value={photoCaption}
                      onChange={(e) => setPhotoCaption(e.target.value)}
                      className="w-full bg-[#0a0a0c] border border-white/15 p-2.5 rounded-lg text-white resize-none"
                    />
                  </div>
                  <div>
                    <label className="font-bold uppercase text-zinc-400 block mb-1">Photo *</label>
                    <input
                      type="file"
                      accept="image/*"
                      required={!photoDataUrl}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setPhotoDataUrl(await readFileAsDataUrl(file));
                      }}
                      className="w-full text-white text-xs"
                    />
                  </div>
                  <p className="text-zinc-500 text-[11px]">
                    Submitted photos go to a pending review queue — the Media Head must approve
                    before they appear on the live site.
                  </p>
                  <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => setIsSubmitPhotoModalOpen(false)}
                      className="px-4 py-2 rounded-lg bg-white/10 text-white font-bold uppercase"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={photoSubmitting || !photoDataUrl}
                      className="px-5 py-2 rounded-lg bg-[#FFD700] text-black font-bold uppercase tracking-wider shadow-md disabled:opacity-50"
                    >
                      {photoSubmitting ? 'Submitting…' : 'Submit for Approval'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Web Dev Head: System Health & Recent Issues — real DB/server diagnostics, no synthetic data */}
          {isWebDevHead && (
            <div className="bg-[#1b191d] border border-white/10 rounded-2xl p-6 sm:p-8 shadow-sm mb-6">
              <div className="flex items-center justify-between pb-4 mb-5 border-b border-white/10">
                <div>
                  <h2 className="font-display text-xl font-bold uppercase tracking-wider text-white">
                    SYSTEM HEALTH
                  </h2>
                  <span className="font-mono text-xs text-[#a78a8a]">
                    Live diagnostics for hotfix triage
                  </span>
                </div>
              </div>

              {healthLoading ? (
                <div className="text-xs text-[#a78a8a] font-mono py-6 text-center">
                  Checking system health…
                </div>
              ) : !systemHealth ? (
                <div className="text-xs text-[#a78a8a] font-mono py-6 text-center">
                  System health data unavailable.
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
                    <div className="bg-[#181519] border border-white/10 rounded-lg p-3.5">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`w-2 h-2 rounded-full ${systemHealth.database.connected ? 'bg-emerald-400' : 'bg-[#800020]'}`}
                        />
                        <span className="text-[10px] uppercase tracking-wider text-[#a78a8a] font-bold">
                          Database
                        </span>
                      </div>
                      <p className="text-sm font-mono text-white">
                        {systemHealth.database.connected
                          ? `Connected (${systemHealth.database.latencyMs}ms)`
                          : 'Unreachable'}
                      </p>
                    </div>
                    <div className="bg-[#181519] border border-white/10 rounded-lg p-3.5">
                      <span className="text-[10px] uppercase tracking-wider text-[#a78a8a] font-bold block mb-1">
                        Server Uptime
                      </span>
                      <p className="text-sm font-mono text-white">
                        {Math.floor(systemHealth.server.uptimeSeconds / 3600)}h{' '}
                        {Math.floor((systemHealth.server.uptimeSeconds % 3600) / 60)}m
                      </p>
                    </div>
                    <div className="bg-[#181519] border border-white/10 rounded-lg p-3.5">
                      <span className="text-[10px] uppercase tracking-wider text-[#a78a8a] font-bold block mb-1">
                        Node / Env
                      </span>
                      <p className="text-sm font-mono text-white">
                        {systemHealth.server.nodeVersion} • {systemHealth.server.environment}
                      </p>
                    </div>
                    <div className="bg-[#181519] border border-white/10 rounded-lg p-3.5">
                      <span className="text-[10px] uppercase tracking-wider text-[#a78a8a] font-bold block mb-1">
                        Audit Events (24h)
                      </span>
                      <p className="text-sm font-mono text-white">
                        {systemHealth.auditActivity.last24h} /{' '}
                        {systemHealth.auditActivity.totalEvents} total
                      </p>
                    </div>
                  </div>

                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#FF4500] mb-2">
                    Recent Failures / Denials / Overrides
                  </h3>
                  {systemHealth.recentIssues.length === 0 ? (
                    <p className="text-xs text-[#a78a8a] font-mono py-3 text-center">
                      No failure or denial events recorded recently — nominal.
                    </p>
                  ) : (
                    <div className="space-y-1.5 max-h-56 overflow-y-auto">
                      {systemHealth.recentIssues.map((log) => (
                        <div
                          key={log.id}
                          className="flex items-center justify-between gap-3 bg-[#181519] border border-white/5 rounded-lg px-3 py-2 text-xs"
                        >
                          <span className="font-mono text-[#FFD700] font-bold">{log.action}</span>
                          <span className="text-[#d6cfd7] flex-1 truncate px-2">
                            {log.reason || log.resource}
                          </span>
                          <span className="text-[#a78a8a] font-mono shrink-0">
                            {new Date(log.time).toLocaleTimeString('en-IN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Authenticated Audit Event Ledger */}
          {canSeeAudit && (
            <div className="bg-[#1b191d] border border-white/10 rounded-2xl p-6 sm:p-8 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-5 border-b border-white/10 gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#2a2630] border border-white/10 flex items-center justify-center text-[#FFD700]">
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h2 className="font-display text-xl font-bold uppercase tracking-wider text-white">
                      AUTHENTICATED AUDIT EVENT LEDGER
                    </h2>
                    <span className="font-mono text-xs text-[#a78a8a]">
                      Live operations feed from the backend audit log
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-[#201d24] border border-white/5 px-3 py-1.5 rounded-lg self-start sm:self-auto">
                  <span className="w-2 h-2 rounded-full bg-[#FFD700] animate-pulse"></span>
                  <span className="font-mono text-xs text-white uppercase font-medium">
                    Live Streaming (UTC+05:30)
                  </span>
                </div>
              </div>

              {auditUnavailable ? (
                <div className="text-xs text-[#a78a8a] font-mono py-6 text-center">
                  Audit log access requires the &quot;audit.view&quot; permission on your account.
                </div>
              ) : auditLoading ? (
                <div className="text-xs text-[#a78a8a] font-mono py-6 text-center">
                  Loading audit events…
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="text-xs text-[#a78a8a] font-mono py-6 text-center">
                  No audit events recorded yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-[#151316] text-[#a78a8a] border-b border-white/10 font-mono">
                        <th className="py-3 px-4 font-display font-bold text-xs uppercase tracking-wider">
                          Timestamp
                        </th>
                        <th className="py-3 px-4 font-display font-bold text-xs uppercase tracking-wider">
                          What Happened
                        </th>
                        <th className="py-3 px-4 font-display font-bold text-xs uppercase tracking-wider">
                          Who
                        </th>
                        <th className="py-3 px-4 font-display font-bold text-xs uppercase tracking-wider">
                          Severity
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {auditLogs.map((log) => {
                        const severity = deriveSeverity(log.action);
                        return (
                          <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                            <td className="py-3.5 px-4 text-white font-medium whitespace-nowrap font-mono">
                              {new Date(log.time).toLocaleString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}{' '}
                              IST
                            </td>
                            <td className="py-3.5 px-4">
                              <p className="text-white font-semibold">
                                {humanizeAction(log.action)}
                              </p>
                              {log.reason && <p className="text-[#d6cfd7] mt-0.5">{log.reason}</p>}
                              <p className="text-[10px] text-[#6b6570] font-mono mt-0.5">
                                {log.resource}
                                {log.resourceId ? ` · ${log.resourceId.slice(0, 8)}` : ''}
                              </p>
                            </td>
                            <td className="py-3.5 px-4 text-[#a78a8a] font-mono">
                              {log.user?.email || log.user?.name || 'System'}
                            </td>
                            <td className="py-3.5 px-4">
                              <span
                                className={`font-semibold uppercase ${
                                  severity === 'Notice'
                                    ? 'text-[#FF4500]'
                                    : severity === 'High'
                                      ? 'text-[#FFD700]'
                                      : 'text-zinc-300'
                                }`}
                              >
                                {severity}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </main>

        {/* Dispatch Announcement Modal — heading + targeted audience(s) + description, backed by /api/announcements */}
        {isDispatchModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-[#1d1a20] border border-white/15 max-w-lg w-full p-6 rounded-2xl shadow-2xl flex flex-col gap-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FF4500]"></span>
                  <span className="font-display text-xl uppercase font-bold text-white">
                    Dispatch Announcement
                  </span>
                </div>
                <button
                  onClick={() => setIsDispatchModalOpen(false)}
                  className="text-[#a78a8a] hover:text-white transition-colors"
                  type="button"
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

              <form onSubmit={handleDispatchAnnouncement} className="space-y-4">
                <div>
                  <label className="font-display text-xs uppercase text-[#a78a8a] block mb-2 font-bold tracking-wider">
                    Heading
                  </label>
                  <input
                    type="text"
                    value={announcementHeading}
                    onChange={(e) => setAnnouncementHeading(e.target.value)}
                    required
                    placeholder="e.g. Venue change for Football Semifinal"
                    className="w-full bg-[#151316] border border-white/15 p-3 rounded-lg text-sm text-white focus:border-[#FF4500] focus:outline-none placeholder-white/30 font-sans"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="font-display text-xs uppercase text-[#a78a8a] font-bold tracking-wider">
                      Target Audience (select at least one)
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setAnnouncementTargets((prev) =>
                          prev.length === ANNOUNCEMENT_TARGETS.length
                            ? []
                            : ANNOUNCEMENT_TARGETS.map((t) => t.id),
                        )
                      }
                      className="text-[10px] font-bold uppercase tracking-wider text-[#FFD700] hover:text-white"
                    >
                      {announcementTargets.length === ANNOUNCEMENT_TARGETS.length
                        ? 'Clear all'
                        : 'Select all'}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {ANNOUNCEMENT_TARGETS.map((t) => (
                      <label
                        key={t.id}
                        className="flex items-center gap-2 bg-[#26222b] border border-white/10 px-3 py-1.5 rounded text-white text-xs cursor-pointer select-none"
                      >
                        <input
                          type="checkbox"
                          checked={announcementTargets.includes(t.id)}
                          onChange={() => toggleAnnouncementTarget(t.id)}
                          className="accent-[#FF4500]"
                        />
                        <span>{t.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="font-display text-xs uppercase text-[#a78a8a] block mb-2 font-bold tracking-wider">
                    Description
                  </label>
                  <textarea
                    value={announcementDescription}
                    onChange={(e) => setAnnouncementDescription(e.target.value)}
                    required
                    placeholder="Full announcement text..."
                    rows={3}
                    className="w-full bg-[#151316] border border-white/15 p-3 rounded-lg text-sm text-white focus:border-[#FF4500] focus:outline-none placeholder-white/30 font-sans"
                  />
                </div>

                {dispatchError && (
                  <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/50 text-rose-200 text-xs font-mono">
                    {dispatchError}
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsDispatchModalOpen(false)}
                    className="px-4 py-2 rounded bg-[#2a2630] hover:bg-[#34303b] text-white font-display text-xs font-bold uppercase tracking-wider transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={dispatchSubmitting || announcementTargets.length === 0}
                    className="px-4 py-2 rounded bg-[#FF4500] hover:bg-[#ff5625] disabled:opacity-50 text-white font-display text-xs font-bold uppercase tracking-wider transition-colors shadow-md"
                  >
                    {dispatchSubmitting ? 'Dispatching…' : 'Dispatch Announcement'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Assign New Operations Task Modal — department or a specific volunteer, backed by /api/operations-tasks */}
        {isNewTaskModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-[#1d1a20] border border-white/15 max-w-md w-full p-6 rounded-2xl shadow-2xl flex flex-col gap-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <span className="font-display text-xl uppercase font-bold text-white">
                  Assign Operations Task
                </span>
                <button
                  onClick={() => setIsNewTaskModalOpen(false)}
                  className="text-[#a78a8a] hover:text-white transition-colors"
                  type="button"
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

              <form onSubmit={handleCreateTask} className="space-y-4">
                <div>
                  <label className="font-display text-xs uppercase text-[#a78a8a] block mb-2 font-bold tracking-wider">
                    Task
                  </label>
                  <input
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    required
                    placeholder="e.g. Replenish shuttles at SAC Court 1"
                    className="w-full bg-[#151316] border border-white/15 p-3 rounded-lg text-sm text-white focus:border-[#FF4500] focus:outline-none placeholder-white/30 font-sans"
                  />
                </div>

                <div>
                  <label className="font-display text-xs uppercase text-[#a78a8a] block mb-2 font-bold tracking-wider">
                    Assign To Department
                  </label>
                  <select
                    value={newTaskDepartment}
                    onChange={(e) => setNewTaskDepartment(e.target.value)}
                    className="w-full bg-[#151316] border border-white/15 p-3 rounded-lg text-sm text-white focus:border-[#FF4500] focus:outline-none"
                  >
                    <option value="">— Select a department —</option>
                    {Array.from(new Set(volunteerRoster.map((v) => v.department))).map((dep) => (
                      <option key={dep} value={dep}>
                        {dep}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-white/10" />
                  <span className="text-[10px] font-mono text-[#a78a8a] uppercase">
                    and/or specific volunteers
                  </span>
                  <div className="flex-1 h-px bg-white/10" />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="font-display text-xs uppercase text-[#a78a8a] font-bold tracking-wider">
                      Assignees
                    </label>
                    {(() => {
                      const filteredRoster = volunteerRoster.filter((v) => {
                        const q = assigneeSearch.trim().toLowerCase();
                        if (!q) return true;
                        return (
                          v.name.toLowerCase().includes(q) || v.department.toLowerCase().includes(q)
                        );
                      });
                      const allFilteredSelected =
                        filteredRoster.length > 0 &&
                        filteredRoster.every((v) => newTaskAssigneeIds.includes(v.id));
                      return (
                        <button
                          type="button"
                          onClick={() =>
                            setNewTaskAssigneeIds((prev) =>
                              allFilteredSelected
                                ? prev.filter((id) => !filteredRoster.some((v) => v.id === id))
                                : Array.from(
                                    new Set([...prev, ...filteredRoster.map((v) => v.id)]),
                                  ),
                            )
                          }
                          className="text-[10px] font-bold uppercase tracking-wider text-[#FFD700] hover:text-white"
                        >
                          {allFilteredSelected ? 'Clear' : 'Select all'}
                          {assigneeSearch.trim() ? ' shown' : ''}
                        </button>
                      );
                    })()}
                  </div>
                  <input
                    type="text"
                    value={assigneeSearch}
                    onChange={(e) => setAssigneeSearch(e.target.value)}
                    placeholder="Search by name or department..."
                    className="w-full bg-[#151316] border border-white/15 p-2 rounded-lg text-xs text-white mb-2 focus:border-[#FF4500] focus:outline-none placeholder-white/30 font-sans"
                  />
                  <div className="max-h-40 overflow-y-auto grid grid-cols-1 gap-1.5 bg-[#151316] border border-white/15 rounded-lg p-2.5">
                    {volunteerRoster.length === 0 ? (
                      <p className="text-[11px] text-[#a78a8a] font-mono py-1">
                        No volunteers in scope.
                      </p>
                    ) : (
                      (() => {
                        const q = assigneeSearch.trim().toLowerCase();
                        const filtered = q
                          ? volunteerRoster.filter(
                              (v) =>
                                v.name.toLowerCase().includes(q) ||
                                v.department.toLowerCase().includes(q),
                            )
                          : volunteerRoster;
                        if (filtered.length === 0) {
                          return (
                            <p className="text-[11px] text-[#a78a8a] font-mono py-1">
                              No volunteers match &quot;{assigneeSearch}&quot;.
                            </p>
                          );
                        }
                        return filtered.map((v) => (
                          <label
                            key={v.id}
                            className="flex items-center gap-2 text-xs text-white py-0.5 cursor-pointer select-none"
                          >
                            <input
                              type="checkbox"
                              checked={newTaskAssigneeIds.includes(v.id)}
                              onChange={() =>
                                setNewTaskAssigneeIds((prev) =>
                                  prev.includes(v.id)
                                    ? prev.filter((id) => id !== v.id)
                                    : [...prev, v.id],
                                )
                              }
                              className="accent-[#FF4500]"
                            />
                            {v.name} ({v.department})
                          </label>
                        ));
                      })()
                    )}
                  </div>
                </div>

                {taskMatchOptions.length > 0 && (
                  <div>
                    <label className="font-display text-xs uppercase text-[#a78a8a] block mb-2 font-bold tracking-wider">
                      Link To A Match (optional — for scoring duty)
                    </label>
                    <select
                      value={newTaskMatchId}
                      onChange={(e) => setNewTaskMatchId(e.target.value)}
                      className="w-full bg-[#151316] border border-white/15 p-3 rounded-lg text-sm text-white focus:border-[#FF4500] focus:outline-none"
                    >
                      <option value="">— No match link —</option>
                      {taskMatchOptions.map((m) => (
                        <option key={m.id} value={m.id}>
                          {[
                            m.tournament?.sport?.name,
                            m.matchNumber,
                            m.teamA?.name && m.teamB?.name
                              ? `${m.teamA.name} vs ${m.teamB.name}`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(' — ')}
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-[#a78a8a] mt-1">
                      Grants each selected volunteer scoring access to this match only, once they
                      have a linked account.
                    </p>
                  </div>
                )}

                {newTaskError && (
                  <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/50 text-rose-200 text-xs font-mono">
                    {newTaskError}
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsNewTaskModalOpen(false)}
                    className="px-4 py-2 rounded bg-[#2a2630] hover:bg-[#34303b] text-white font-display text-xs font-bold uppercase tracking-wider transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={
                      newTaskSubmitting || (!newTaskDepartment && newTaskAssigneeIds.length === 0)
                    }
                    className="px-4 py-2 rounded bg-[#FF4500] hover:bg-[#ff5625] disabled:opacity-50 text-white font-display text-xs font-bold uppercase tracking-wider transition-colors shadow-md"
                  >
                    {newTaskSubmitting ? 'Assigning…' : 'Assign Task'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Score Override Modal */}
        {isScoreOverrideModalOpen && selectedMatch && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-[#1d1a20] border border-white/15 max-w-md w-full p-6 rounded-2xl shadow-2xl flex flex-col gap-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FFD700]"></span>
                  <span className="font-display text-lg uppercase font-bold text-white">
                    Score Override: {selectedMatch.teamA?.name ?? 'Team A'} vs{' '}
                    {selectedMatch.teamB?.name ?? 'Team B'}
                  </span>
                </div>
                <button
                  onClick={() => setIsScoreOverrideModalOpen(false)}
                  className="text-[#a78a8a] hover:text-white transition-colors"
                  type="button"
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

              {overrideLookupState === 'loading' && (
                <p className="text-xs text-[#a78a8a] font-mono">Looking up submitted result…</p>
              )}
              {overrideLookupState === 'not-found' && (
                <p className="text-xs text-[#FF4500] font-mono">
                  No submitted result exists yet for this match. A result must be submitted before
                  it can be overridden.
                </p>
              )}

              <form onSubmit={handleSaveScoreOverride} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-mono text-zinc-400 block mb-1">
                      TEAM A SCORE
                    </label>
                    <input
                      type="number"
                      value={overrideScoreA}
                      onChange={(e) => setOverrideScoreA(parseInt(e.target.value) || 0)}
                      disabled={overrideLookupState !== 'found'}
                      className="w-full bg-[#151316] border border-white/15 p-2.5 rounded-lg text-lg font-bold text-white font-mono focus:border-[#FFD700] focus:outline-none disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-mono text-zinc-400 block mb-1">
                      TEAM B SCORE
                    </label>
                    <input
                      type="number"
                      value={overrideScoreB}
                      onChange={(e) => setOverrideScoreB(parseInt(e.target.value) || 0)}
                      disabled={overrideLookupState !== 'found'}
                      className="w-full bg-[#151316] border border-white/15 p-2.5 rounded-lg text-lg font-bold text-white font-mono focus:border-[#FFD700] focus:outline-none disabled:opacity-50"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-mono text-zinc-400 block mb-1">
                    REASON FOR OVERRIDE (REQUIRED)
                  </label>
                  <textarea
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    required
                    rows={2}
                    disabled={overrideLookupState !== 'found'}
                    placeholder="e.g. Umpire scoring error corrected after video review"
                    className="w-full bg-[#151316] border border-white/15 p-3 rounded-lg text-sm text-white focus:border-[#FFD700] focus:outline-none placeholder-white/30 font-sans disabled:opacity-50"
                  />
                </div>

                {overrideError && (
                  <p className="text-xs text-[#FF4500] font-mono">{overrideError}</p>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsScoreOverrideModalOpen(false)}
                    className="px-4 py-2 rounded bg-[#2a2630] hover:bg-[#34303b] text-white font-display text-xs font-bold uppercase tracking-wider transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={overrideLookupState !== 'found' || overrideSubmitting}
                    className="px-4 py-2 rounded bg-[#800020] hover:bg-[#9a0026] text-[#FFD700] font-display text-xs font-bold uppercase tracking-wider transition-colors shadow-md border border-[#FFD700]/30 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {overrideSubmitting ? 'Ratifying…' : 'Ratify Override'}
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

export default function OrganizerDashboardPage() {
  return (
    <RequireOrganizer>
      <OrganizerDashboardContent />
    </RequireOrganizer>
  );
}
