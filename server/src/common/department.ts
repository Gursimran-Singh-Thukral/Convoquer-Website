/**
 * Department names are freeform strings (Volunteer.department(s), OperationsTask.department,
 * UserRole.departmentId) — there is no relational Department model. Matching must be exact
 * (case/whitespace-insensitive), not substring, or e.g. "Media" would also match "Social Media"
 * and leak cross-department visibility.
 */
export function departmentsMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function departmentAllowed(
  candidate: string | null | undefined,
  allowed: string[],
): boolean {
  if (!candidate) return false;
  return allowed.some((department) => departmentsMatch(candidate, department));
}

const HEAD_ROLE_NAMES = new Set([
  'MEDIA_HEAD',
  'HOSPITALITY_HEAD',
  'SECURITY_HEAD',
  'WEB_DEV_HEAD',
  'OVERALL_SPORTS_COORDINATOR',
  'SPORTS_COORDINATOR',
]);

/** Roles that manage a department's volunteers/tasks, as opposed to plain rank-and-file volunteers. */
export function isDepartmentHead(roleName: string): boolean {
  return HEAD_ROLE_NAMES.has(roleName);
}

/**
 * Fixed department list offered when assigning a volunteer — a volunteer has
 * exactly one department (Volunteer.department), which doubles as their
 * ground-level role scope. See GROUND_ROLE_BY_DEPARTMENT and
 * HEAD_ROLE_DEPARTMENT below.
 */
export const CANONICAL_DEPARTMENTS = [
  'Security',
  'Media',
  'Sports',
  'Hospitality',
  'Web',
  'General Operations',
];

/**
 * The ground-level volunteer role granted purely from the department a
 * volunteer is assigned to (see RbacService.assignRoleWithVolunteerScopes) —
 * departments with no dedicated ground role (Hospitality, Web, General
 * Operations) fall back to the generic VOLUNTEER role.
 */
export const GROUND_ROLE_BY_DEPARTMENT: Record<string, string> = {
  security: 'SECURITY_VOLUNTEER',
  media: 'MEDIA_TEAM',
  sports: 'SPORTS_VOLUNTEER',
};

/**
 * The single department each Head role is tied to — enforced (not just
 * defaulted) when that role is assigned, since a volunteer now has exactly
 * one department. SPORTS_COORDINATOR/OVERALL_SPORTS_COORDINATOR's actual
 * access instead comes from UserRole.sportId / the 'SPORTS_COORDINATOR' role
 * name directly (see OperationsTasksService.accessFor), so they're
 * deliberately left out here.
 */
export const HEAD_ROLE_DEPARTMENT: Record<string, string> = {
  MEDIA_HEAD: 'Media',
  HOSPITALITY_HEAD: 'Hospitality',
  SECURITY_HEAD: 'Security',
  WEB_DEV_HEAD: 'Web',
};
