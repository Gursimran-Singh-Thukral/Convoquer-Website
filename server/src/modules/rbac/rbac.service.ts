import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { blindIndex } from '../../common/crypto/field-crypto.js';
import {
  CANONICAL_DEPARTMENTS,
  GROUND_ROLE_BY_DEPARTMENT,
  HEAD_ROLE_DEPARTMENT,
} from '../../common/department.js';

const GROUND_ROLE_NAMES = [
  'VOLUNTEER',
  'HOSPITALITY_SECURITY_VOLUNTEER',
  'SPORTS_VOLUNTEER',
  'MEDIA_TEAM',
];

export interface UserPermissionEntry {
  action: string;
  isGlobal: boolean;
  sportIds: string[];
  eventIds: string[];
  departmentIds: string[];
  grants?: { sportId?: string; eventId?: string; departmentId?: string }[];
}

export interface UserEffectiveAuth {
  userId: string;
  roles: string[];
  permissions: Record<string, UserPermissionEntry>;
  /**
   * Whether this user is a MatchOfficial (e.g. a scorekeeper) on at least one
   * match. Lets a role with no sport-wide score.update grant (e.g. a Sports
   * Volunteer only tasked to score one specific match) still see the Scorer
   * nav link — see OrganizerNavRail.tsx.
   */
  hasOfficialAssignments: boolean;
}

@Injectable()
export class RbacService {
  private readonly logger = new Logger(RbacService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolves all active, non-expired roles and deduplicated permissions with scope constraints.
   */
  async getUserEffectiveAuth(userId: string): Promise<UserEffectiveAuth> {
    const now = new Date();

    const userRoles = await this.prisma.userRole.findMany({
      where: {
        userId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    const activeRoles: string[] = [];
    const permissionsMap: Record<string, UserPermissionEntry> = {};

    for (const ur of userRoles) {
      if (!activeRoles.includes(ur.role.name)) {
        activeRoles.push(ur.role.name);
      }

      const isGlobal = !ur.sportId && !ur.eventId && !ur.departmentId;

      for (const rp of ur.role.permissions) {
        const action = rp.permission.action;

        if (!permissionsMap[action]) {
          permissionsMap[action] = {
            action,
            isGlobal: false,
            sportIds: [],
            eventIds: [],
            departmentIds: [],
            grants: [],
          };
        }

        if (isGlobal) {
          permissionsMap[action].isGlobal = true;
        } else {
          permissionsMap[action].grants!.push({
            sportId: ur.sportId || undefined,
            eventId: ur.eventId || undefined,
            departmentId: ur.departmentId || undefined,
          });
          if (
            ur.sportId &&
            !permissionsMap[action].sportIds.includes(ur.sportId)
          ) {
            permissionsMap[action].sportIds.push(ur.sportId);
          }
          if (
            ur.eventId &&
            !permissionsMap[action].eventIds.includes(ur.eventId)
          ) {
            permissionsMap[action].eventIds.push(ur.eventId);
          }
          if (
            ur.departmentId &&
            !permissionsMap[action].departmentIds.includes(ur.departmentId)
          ) {
            permissionsMap[action].departmentIds.push(ur.departmentId);
          }
        }
      }
    }

    const officialCount = await this.prisma.matchOfficial.count({
      where: { userId },
    });

    return {
      userId,
      roles: activeRoles,
      permissions: permissionsMap,
      hasOfficialAssignments: officialCount > 0,
    };
  }

  /**
   * Evaluates if a user has a specific permission, considering global or specific scope constraints.
   */
  async hasPermission(
    userId: string,
    action: string,
    scope?: { sportId?: string; eventId?: string; departmentId?: string },
  ): Promise<boolean> {
    const effective = await this.getUserEffectiveAuth(userId);
    const entry = effective.permissions[action];

    if (!entry) {
      return false;
    }

    // If granted globally via any active role, allow
    if (entry.isGlobal) {
      return true;
    }

    // All restrictions on one assignment must match together. Flattening them
    // into independent OR lists grants an event-scoped coordinator every sport.
    if (entry.grants) {
      return entry.grants.some((grant) =>
        Object.entries(grant).every(
          ([key, value]) =>
            !value || scope?.[key as keyof typeof scope] === value,
        ),
      );
    }
    // Compatibility for callers with legacy permission snapshots.
    if (scope?.sportId && entry.sportIds.includes(scope.sportId)) {
      return true;
    }
    if (scope?.eventId && entry.eventIds.includes(scope.eventId)) {
      return true;
    }
    if (
      scope?.departmentId &&
      entry.departmentIds.includes(scope.departmentId)
    ) {
      return true;
    }

    // If no specific scope was requested and user has no global grant,
    // they don't have unrestricted access to this action
    return false;
  }

  /**
   * Evaluates if a user has any of the specified roles.
   */
  async hasAnyRole(userId: string, requiredRoles: string[]): Promise<boolean> {
    const effective = await this.getUserEffectiveAuth(userId);
    return requiredRoles.some((r) => effective.roles.includes(r));
  }

  /** Derive scope from persisted targets; never authorize an ID using a query-string claim. */
  async resolveRequestScope(request: any, action: string) {
    const path = String(request.route?.path || request.path || '');
    if (
      /^(role|user|audit|session|media|sponsor|volunteer|announcement|task)\./.test(
        action,
      )
    )
      return {};
    const id = request.params?.id || request.params?.teamId;
    const resource = path
      .split('/')
      .find((part: string) =>
        [
          'sports',
          'teams',
          'venues',
          'events',
          'institutes',
          'participants',
        ].includes(part),
      );
    if (id && resource) {
      let record: any;
      if (resource === 'sports')
        record = await this.prisma.sport.findUnique({ where: { id } });
      if (resource === 'teams')
        record = await this.prisma.team.findUnique({ where: { id } });
      if (resource === 'venues')
        record = await this.prisma.venue.findUnique({ where: { id } });
      if (resource === 'events')
        record = await this.prisma.event.findUnique({ where: { id } });
      if (resource === 'institutes')
        record = await this.prisma.institute.findUnique({ where: { id } });
      if (resource === 'participants')
        record = await this.prisma.participant.findUnique({ where: { id } });
      if (!record) throw new NotFoundException('Resource not found');
      return {
        eventId: resource === 'events' ? record.id : record.eventId,
        sportId: resource === 'sports' ? record.id : record.sportId,
      };
    }
    if (path.includes('security/check-in')) {
      const body = request.body || {};
      if (!body.participantId && !body.gatePassNumber)
        throw new BadRequestException('Participant or pass is required');
      const record = await this.prisma.participant.findFirst({
        where: body.participantId
          ? { id: body.participantId }
          : { gatePassNumber: body.gatePassNumber },
      });
      if (!record) throw new NotFoundException('Participant not found');
      return { eventId: record.eventId };
    }
    const values = request.method === 'GET' ? request.query : request.body;
    const sportId = values?.sportId;
    const eventId = values?.eventId;
    // These are the same filters/foreign keys used by the downstream operation.
    if (
      sportId &&
      (resource === 'teams' || path.includes('pending-approvals'))
    ) {
      const sport = await this.prisma.sport.findUnique({
        where: { id: sportId },
      });
      if (!sport || (eventId && sport.eventId !== eventId))
        throw new BadRequestException('Invalid event/sport combination');
      return { sportId: sport.id, eventId: sport.eventId };
    }
    return {
      eventId:
        typeof eventId === 'string' &&
        (resource ||
          path.includes('security') ||
          path.includes('pending-approvals'))
          ? eventId
          : undefined,
    };
  }

  /**
   * Production bootstrap: without this, a fresh deployment has no CONVENER
   * and therefore no account can ever be granted `role.assign` — every RBAC
   * endpoint requires a permission nobody holds yet. If CONVENER_BOOTSTRAP_EMAIL
   * is set and matches the signing-in user, and no CONVENER exists anywhere
   * in the system yet, grant it automatically. Safe to call on every login:
   * it no-ops the moment a CONVENER exists, so it can't be used to re-grant
   * or escalate after initial setup, and it deliberately does not depend on
   * the caller already having any permission (there's nobody to have one).
   */
  async bootstrapFirstConvenerIfNeeded(
    userId: string,
    email: string,
  ): Promise<void> {
    const bootstrapEmail =
      process.env.CONVENER_BOOTSTRAP_EMAIL?.trim().toLowerCase();
    if (!bootstrapEmail || email.trim().toLowerCase() !== bootstrapEmail)
      return;

    const anyConvener = await this.prisma.userRole.findFirst({
      where: { role: { name: 'CONVENER' } },
    });
    if (anyConvener) {
      this.logger.warn(
        'CONVENER bootstrap skipped: a CONVENER already exists. Grant further access from the RBAC page, or run `npm run seed:roles -- --convener=<email>`.',
      );
      return;
    }

    const convenerRole = await this.prisma.role.findUnique({
      where: { name: 'CONVENER' },
    });
    if (!convenerRole) {
      // Roles/permissions are only created by the seed script, so a fresh
      // production database silently had nothing to grant.
      this.logger.error(
        'CONVENER bootstrap skipped: the CONVENER role does not exist. Run `npm run seed:roles` against this database, then sign in again.',
      );
      return;
    }

    await this.assignRole(null, userId, convenerRole.id);
    this.logger.log('CONVENER bootstrap granted to the configured email.');
  }

  /**
   * SOLE_ADMIN_EMAIL is the email SoleAdminGuard locks RBAC-admin and
   * tournament-structure endpoints to, but WEB_DEV_HEAD (the role those
   * endpoints actually check via PermissionsGuard) still has to be granted
   * to someone — and nobody can grant it through the RBAC page until at
   * least one account already holds it. Bootstrapping CONVENER doesn't help,
   * since CONVENER deliberately excludes RBAC-admin and tournament-structure
   * permissions. Safe to call on every login: it only ever touches the one
   * locked-down email and no-ops the moment that account already holds the
   * role, so it can't be used to re-grant or escalate anyone else.
   */
  async ensureSoleAdminHasWebDevHead(
    userId: string,
    email: string,
  ): Promise<void> {
    const adminEmail = process.env.SOLE_ADMIN_EMAIL?.trim().toLowerCase();
    if (!adminEmail || email.trim().toLowerCase() !== adminEmail) return;

    const already = await this.prisma.userRole.findFirst({
      where: { userId, role: { name: 'WEB_DEV_HEAD' } },
    });
    if (already) return;

    const role = await this.prisma.role.findUnique({
      where: { name: 'WEB_DEV_HEAD' },
    });
    if (!role) {
      this.logger.error(
        'Sole-admin bootstrap skipped: the WEB_DEV_HEAD role does not exist. Run `npm run seed:roles` against this database, then sign in again.',
      );
      return;
    }

    await this.assignRole(null, userId, role.id);
    this.logger.log(
      'WEB_DEV_HEAD auto-granted to the configured sole admin email.',
    );
  }

  /**
   * The organizing-team import writes each volunteer's real-world position as
   * Volunteer.pendingRoleName/pendingSportIds instead of a live UserRole,
   * because role assignment needs a User row that doesn't exist until they
   * sign in for the first time (see assignRoleWithVolunteerScopes). Called on
   * every login (like bootstrapFirstConvenerIfNeeded): no-ops unless this
   * email matches an unlinked volunteer with a role still owed, so it's safe
   * to call unconditionally and can't re-fire once granted (pending fields
   * are cleared on success, and the Volunteer is linked to userId).
   */
  async linkPendingVolunteerRole(userId: string, email: string): Promise<void> {
    const candidates = await this.prisma.volunteer.findMany({
      where: { userId: null, pendingRoleName: { not: null } },
    });
    const volunteer = candidates.find(
      (v) => blindIndex(v.email) === blindIndex(email),
    );
    if (!volunteer || !volunteer.pendingRoleName) return;

    try {
      const sportIds = volunteer.pendingSportIds;
      if (sportIds.length > 0) {
        for (const sportId of sportIds) {
          await this.assignRoleWithVolunteerScopes(
            null,
            userId,
            volunteer.pendingRoleName,
            {
              volunteerId: volunteer.id,
              sportId,
              department: volunteer.department,
            },
          );
        }
      } else {
        await this.assignRoleWithVolunteerScopes(
          null,
          userId,
          volunteer.pendingRoleName,
          { volunteerId: volunteer.id, department: volunteer.department },
        );
      }
      await this.prisma.volunteer.update({
        where: { id: volunteer.id },
        data: { pendingRoleName: null, pendingSportIds: [] },
      });
      this.logger.log(
        `Pending role "${volunteer.pendingRoleName}" auto-granted to ${volunteer.name} on first login.`,
      );
    } catch (err) {
      this.logger.warn(
        `Failed to auto-grant pending role for volunteer ${volunteer.id}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  /**
   * Assigns a role to a user and writes to the audit log.
   *
   * Two distinct modes, both going through this one entry point:
   *  - Head role (e.g. HOSPITALITY_SECURITY_HEAD, SPORTS_COORDINATOR):
   *    `roleIdOrName` names the actual role to grant. Its department is
   *    enforced from HEAD_ROLE_DEPARTMENT, not chosen by the caller — a
   *    volunteer has exactly one department, so assigning a Head role
   *    overwrites it to match.
   *  - Ground volunteer: `roleIdOrName` is the literal 'VOLUNTEER' placeholder;
   *    the actual role granted (HOSPITALITY_SECURITY_VOLUNTEER/MEDIA_TEAM/
   *    SPORTS_VOLUNTEER/plain VOLUNTEER) is inferred purely from `scope.department` via
   *    GROUND_ROLE_BY_DEPARTMENT. The caller never names a ground role directly.
   */
  /**
   * The /rbac page's single entry point for assigning a role to a volunteer —
   * whether or not they've ever logged in. Linked volunteers (userId already
   * set) go straight through the live assignRoleWithVolunteerScopes path
   * below. Not-yet-linked volunteers get the role written to
   * pendingRoleName/pendingSportIds instead of a live UserRole — there is no
   * User row to attach one to yet — and linkPendingVolunteerRole grants it
   * automatically the moment they first sign in with a matching email.
   */
  async assignRoleToVolunteer(
    assignerUserId: string | null,
    volunteerId: string,
    roleIdOrName: string,
    scope: {
      sportId?: string;
      eventId?: string;
      department?: string;
      expiresAt?: Date;
    },
    ipAddress?: string,
  ): Promise<{ pending: boolean; userRole?: unknown }> {
    const volunteer = await this.prisma.volunteer.findUnique({
      where: { id: volunteerId },
    });
    if (!volunteer) throw new NotFoundException('Volunteer not found.');

    if (volunteer.userId) {
      const [userRole] = await this.assignRoleWithVolunteerScopes(
        assignerUserId,
        volunteer.userId,
        roleIdOrName,
        { ...scope, volunteerId },
        ipAddress,
      );
      return { pending: false, userRole };
    }

    const role = await this.prisma.role.findFirst({
      where: { OR: [{ id: roleIdOrName }, { name: roleIdOrName }] },
    });
    if (!role) throw new NotFoundException(`Role "${roleIdOrName}" not found`);
    if (role.name === 'SPORTS_COORDINATOR' && !scope.sportId)
      throw new BadRequestException(
        'A sports coordinator must be assigned to a specific sport.',
      );

    let department = scope.department?.trim() || undefined;
    if (department && !CANONICAL_DEPARTMENTS.includes(department))
      throw new BadRequestException(
        `"${department}" is not a recognized department.`,
      );
    department =
      HEAD_ROLE_DEPARTMENT[role.name] || department || volunteer.department;

    await this.prisma.volunteer.update({
      where: { id: volunteer.id },
      data: {
        department,
        pendingRoleName: role.name,
        pendingSportIds: scope.sportId ? [scope.sportId] : [],
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: assignerUserId,
        action: 'role.assign.pending',
        resource: 'Volunteer',
        resourceId: volunteer.id,
        newState: {
          volunteerName: volunteer.name,
          volunteerEmail: volunteer.email,
          roleName: role.name,
          scope,
        },
        ipAddress,
      },
    });

    return { pending: true };
  }

  async assignRoleWithVolunteerScopes(
    assignerUserId: string | null,
    targetUserId: string,
    roleIdOrName: string,
    scope: {
      volunteerId?: string;
      sportId?: string;
      eventId?: string;
      department?: string;
      expiresAt?: Date;
    },
    ipAddress?: string,
  ) {
    const role = await this.prisma.role.findFirst({
      where: { OR: [{ id: roleIdOrName }, { name: roleIdOrName }] },
    });
    if (!role) throw new NotFoundException(`Role "${roleIdOrName}" not found`);
    if (role.name === 'SPORTS_COORDINATOR' && !scope.sportId)
      throw new BadRequestException(
        'A sports coordinator must be assigned to a specific sport.',
      );
    if (GROUND_ROLE_NAMES.includes(role.name) && !scope.volunteerId)
      throw new BadRequestException(
        'Select a volunteer record when assigning a volunteer role.',
      );

    let department = scope.department?.trim() || undefined;
    if (department && !CANONICAL_DEPARTMENTS.includes(department))
      throw new BadRequestException(
        `"${department}" is not a recognized department.`,
      );

    let resolvedRole = role;
    if (scope.volunteerId) {
      const [volunteer, user] = await Promise.all([
        this.prisma.volunteer.findUnique({ where: { id: scope.volunteerId } }),
        this.prisma.user.findUnique({
          where: { id: targetUserId },
          select: { emailHash: true },
        }),
      ]);
      if (!volunteer || !user)
        throw new NotFoundException('Volunteer or user account not found.');
      if (blindIndex(volunteer.email) !== user.emailHash)
        throw new BadRequestException(
          'The selected volunteer email does not match the selected login account.',
        );

      department =
        HEAD_ROLE_DEPARTMENT[role.name] || department || volunteer.department;

      if (role.name === 'VOLUNTEER') {
        const groundRoleName =
          GROUND_ROLE_BY_DEPARTMENT[department.toLowerCase()];
        if (groundRoleName)
          resolvedRole = await this.prisma.role.findUniqueOrThrow({
            where: { name: groundRoleName },
          });
      }

      await this.prisma.volunteer.update({
        where: { id: volunteer.id },
        data: { userId: targetUserId, department },
      });
    }

    // Department membership belongs to the linked Volunteer profile. Applying a
    // department restriction to UserRole would also restrict unrelated sport,
    // participant and media permissions whose resources have no department key.
    // Task services enforce these profile departments on every read/write.
    return [
      await this.assignRole(
        assignerUserId,
        targetUserId,
        resolvedRole.id,
        {
          sportId: scope.sportId,
          eventId: scope.eventId,
          expiresAt: scope.expiresAt,
        },
        ipAddress,
      ),
    ];
  }

  async assignRole(
    assignerUserId: string | null,
    targetUserId: string,
    roleIdOrName: string,
    scope?: {
      sportId?: string;
      eventId?: string;
      departmentId?: string;
      expiresAt?: Date;
    },
    ipAddress?: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });
    if (!user) {
      throw new NotFoundException(
        `Target user with id "${targetUserId}" not found`,
      );
    }

    const role = await this.prisma.role.findFirst({
      where: {
        OR: [{ id: roleIdOrName }, { name: roleIdOrName }],
      },
    });
    if (!role) {
      throw new NotFoundException(`Role "${roleIdOrName}" not found`);
    }

    // Prisma's composite-unique `where` shorthand rejects explicit `null` for
    // nullable key fields (it requires a defined value), so a plain `upsert()`
    // against `userId_roleId_eventId_departmentId_sportId` throws whenever the
    // assignment is unscoped (the common case: global roles like CONVENER).
    // Look the existing assignment up manually instead, matching nulls with
    // `equals: null`, which Prisma's regular `where` filters do support.
    const existing = await this.prisma.userRole.findFirst({
      where: {
        userId: targetUserId,
        roleId: role.id,
        eventId: scope?.eventId ?? { equals: null },
        departmentId: scope?.departmentId ?? { equals: null },
        sportId: scope?.sportId ?? { equals: null },
      },
    });

    const userRole = existing
      ? await this.prisma.userRole.update({
          where: { id: existing.id },
          data: {
            assignedBy: assignerUserId,
            expiresAt: scope?.expiresAt ?? null,
          },
        })
      : await this.prisma.userRole.create({
          data: {
            userId: targetUserId,
            roleId: role.id,
            eventId: scope?.eventId ?? null,
            departmentId: scope?.departmentId ?? null,
            sportId: scope?.sportId ?? null,
            assignedBy: assignerUserId,
            expiresAt: scope?.expiresAt ?? null,
          },
        });

    // Write to AuditLog for traceability
    await this.prisma.auditLog.create({
      data: {
        userId: assignerUserId,
        action: 'role.assign',
        resource: 'UserRole',
        resourceId: userRole.id,
        newState: {
          targetUserId,
          targetUserEmail: user.email,
          roleName: role.name,
          scope,
        },
        ipAddress,
      },
    });

    return userRole;
  }

  /**
   * Revokes a user role assignment and writes to the audit log.
   */
  async revokeRole(
    revokerUserId: string | null,
    userRoleId: string,
    ipAddress?: string,
  ) {
    const existing = await this.prisma.userRole.findUnique({
      where: { id: userRoleId },
      include: { role: true, user: true },
    });

    if (!existing) {
      throw new NotFoundException(
        `UserRole assignment "${userRoleId}" not found`,
      );
    }

    await this.prisma.userRole.delete({
      where: { id: userRoleId },
    });

    // Record in AuditLog
    await this.prisma.auditLog.create({
      data: {
        userId: revokerUserId,
        action: 'role.revoke',
        resource: 'UserRole',
        resourceId: userRoleId,
        previousState: {
          targetUserId: existing.userId,
          targetUserEmail: existing.user.email,
          roleName: existing.role.name,
          sportId: existing.sportId,
          eventId: existing.eventId,
        },
        ipAddress,
      },
    });

    return { success: true, message: 'Role revoked successfully' };
  }

  /**
   * Lists all defined roles with permission counts and names.
   */
  async getRoles() {
    return this.prisma.role.findMany({
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Lists all available permission actions.
   */
  async getPermissions() {
    return this.prisma.permission.findMany({
      orderBy: { action: 'asc' },
    });
  }

  async getAssignmentOptions() {
    const [volunteers, sports, events] = await Promise.all([
      this.prisma.volunteer.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.sport.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, name: true, eventId: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.event.findMany({
        select: { id: true, name: true, status: true },
        orderBy: { startDate: 'desc' },
      }),
    ]);
    return {
      volunteers,
      sports,
      events,
      departments: CANONICAL_DEPARTMENTS,
    };
  }
}
