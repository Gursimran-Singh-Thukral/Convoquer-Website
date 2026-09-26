import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { createHmac } from 'crypto';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Mirrors server/src/common/crypto/field-crypto.ts's blindIndex(). Duplicated
// (rather than imported) so this script stays standalone (run via `tsx`)
// and doesn't pull the Nest app's module graph into a seed run.
function seedEncryptionKey(): Buffer {
  const raw = process.env.FIELD_ENCRYPTION_KEY;
  return raw
    ? Buffer.from(raw, raw.length === 64 ? 'hex' : 'base64')
    : createHmac('sha256', 'convoquer-dev-only-insecure-key')
        .update('convoquer-field-encryption')
        .digest();
}

function seedBlindIndex(value: string): string {
  return createHmac('sha256', seedEncryptionKey())
    .update(value.trim().toLowerCase())
    .digest('hex');
}

async function main() {
  console.log('Seeding database permissions and roles...');

  const permissions = [
    // Roles & RBAC
    { action: 'role.view', description: 'View assigned and available roles' },
    { action: 'role.assign', description: 'Assign roles to users' },
    { action: 'role.revoke', description: 'Revoke roles from users' },

    // Users
    { action: 'user.view', description: 'View organizer and system user list' },
    { action: 'user.update', description: 'Update user profiles or metadata' },
    {
      action: 'user.suspend',
      description: 'Suspend or deactivate a user account',
    },

    // Sports & Tournaments
    { action: 'sport.view', description: 'View sports list and configuration' },
    { action: 'event.create', description: 'Create championship events' },
    {
      action: 'event.update',
      description: 'Edit and archive championship events',
    },
    { action: 'event.delete', description: 'Delete empty championship events' },
    { action: 'sport.create', description: 'Create a new sport' },
    { action: 'sport.update', description: 'Update sport rules and details' },
    { action: 'tournament.view', description: 'View tournament structures' },
    { action: 'tournament.create', description: 'Create tournaments' },
    { action: 'tournament.update', description: 'Update tournaments' },
    {
      action: 'competition.manage',
      description:
        'Manage tournaments, seeding, stages, bracket/round-robin generation, matches and officials',
    },

    // Teams & Participants
    { action: 'team.view', description: 'View teams' },
    { action: 'team.create', description: 'Create and register teams' },
    { action: 'team.update', description: 'Update team details' },
    { action: 'participant.view', description: 'View participant records' },
    {
      action: 'participant.create',
      description: 'Create and import participants',
    },
    { action: 'participant.update', description: 'Update participant records' },

    // Fixtures & Matches
    { action: 'fixture.view', description: 'View match fixtures' },
    { action: 'fixture.create', description: 'Generate and schedule fixtures' },
    { action: 'fixture.update', description: 'Update scheduled fixtures' },
    { action: 'match.view', description: 'View matches' },
    { action: 'match.create', description: 'Create match instances' },
    { action: 'match.update', description: 'Update match details' },

    // Scoring & Results
    { action: 'score.view', description: 'View live score feeds' },
    { action: 'score.update', description: 'Update scores and score events' },
    { action: 'result.view', description: 'View results' },
    { action: 'result.submit', description: 'Submit official match result' },
    { action: 'result.approve', description: 'Approve submitted match result' },
    { action: 'result.override', description: 'Convener override on result' },
    {
      action: 'standings.view',
      description: 'View point tables and standings',
    },

    // Venues
    { action: 'venue.view', description: 'View venues' },
    { action: 'venue.create', description: 'Create new venues' },
    { action: 'venue.update', description: 'Update venue details' },

    // Media & Announcements
    { action: 'media.create', description: 'Upload and create media' },
    { action: 'media.update', description: 'Update media assets' },
    {
      action: 'media.publish',
      description: 'Publish media items to public feed',
    },

    // Auditing
    { action: 'audit.view', description: 'View audit logs' },

    // Sponsors
    { action: 'sponsor.create', description: 'Add a new sponsor' },
    { action: 'sponsor.update', description: 'Update sponsor details' },
    { action: 'sponsor.delete', description: 'Remove a sponsor' },

    // Volunteers
    {
      action: 'volunteer.manage',
      description: 'Register, update, or remove volunteer records',
    },
    {
      action: 'volunteer.view.department',
      description:
        "View the volunteer roster within one's own managed department(s)",
    },
    {
      action: 'task.view',
      description: 'View operations tasks within assigned departments',
    },
    {
      action: 'task.create',
      description: 'Assign operations tasks within assigned departments',
    },
    { action: 'task.update', description: 'Update assigned operations tasks' },
    {
      action: 'security.access',
      description: 'Use security entry and exit controls',
    },
  ];

  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { action: perm.action },
      update: { description: perm.description },
      create: perm,
    });
  }

  // Seed Roles
  const roles = [
    {
      name: 'CONVENER',
      description: 'Overall event leadership with system-wide authority',
    },
    {
      name: 'CO_CONVENER',
      description: 'Broad operational authority across event and competition',
    },
    {
      name: 'OVERALL_SPORTS_COORDINATOR',
      description: 'Cross-sport competition management lead',
    },
    {
      name: 'SPORTS_COORDINATOR',
      description: 'Coordinator for a specific sport scope',
    },
    {
      name: 'SPORTS_VOLUNTEER',
      description:
        'Sports-side ground volunteer — no sport-wide scoring rights; can only score a specific match once assigned to it as a scoring duty by a Sports Coordinator',
    },
    {
      name: 'MEDIA_HEAD',
      description: 'Media, gallery and announcement operations lead',
    },
    {
      name: 'MEDIA_TEAM',
      description:
        'Media team member — can submit photos/content for the Media Head to approve, cannot publish directly',
    },
    {
      name: 'HOSPITALITY_SECURITY_HEAD',
      description:
        'Hospitality, logistics, security, gate pass and participant clearance operations lead — the two functions run as one combined team',
    },
    {
      name: 'HOSPITALITY_SECURITY_VOLUNTEER',
      description:
        'Hospitality and security ground volunteer — gate entry/exit access plus general on-ground guest operations',
    },
    {
      name: 'WEB_DEV_HEAD',
      description: 'Website, RBAC and technical operations lead',
    },
    {
      name: 'SPONSORSHIP_HEAD',
      description: 'Sponsor roster and partnership operations lead',
    },
    {
      name: 'EVENT_MANAGEMENT_HEAD',
      description: 'General event operations and logistics lead',
    },
    {
      name: 'DESIGN_HEAD',
      description: 'Design and creative operations lead',
    },
    {
      name: 'VOLUNTEER',
      description: 'Ground volunteer with read and operational assistance',
    },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description },
      create: role,
    });
  }

  // Map Permissions to Roles
  const allPermissions = await prisma.permission.findMany();
  const permMap = new Map(allPermissions.map((p) => [p.action, p.id]));

  const convenerRole = await prisma.role.findUniqueOrThrow({
    where: { name: 'CONVENER' },
  });
  const sportsCoordRole = await prisma.role.findUniqueOrThrow({
    where: { name: 'SPORTS_COORDINATOR' },
  });
  const sportsVolunteerRole = await prisma.role.findUniqueOrThrow({
    where: { name: 'SPORTS_VOLUNTEER' },
  });
  const overallCoordRole = await prisma.role.findUniqueOrThrow({
    where: { name: 'OVERALL_SPORTS_COORDINATOR' },
  });
  const mediaHeadRole = await prisma.role.findUniqueOrThrow({
    where: { name: 'MEDIA_HEAD' },
  });
  const mediaTeamRole = await prisma.role.findUniqueOrThrow({
    where: { name: 'MEDIA_TEAM' },
  });
  const hospitalitySecurityHeadRole = await prisma.role.findUniqueOrThrow({
    where: { name: 'HOSPITALITY_SECURITY_HEAD' },
  });
  const hospitalitySecurityVolunteerRole = await prisma.role.findUniqueOrThrow({
    where: { name: 'HOSPITALITY_SECURITY_VOLUNTEER' },
  });
  const webDevHeadRole = await prisma.role.findUniqueOrThrow({
    where: { name: 'WEB_DEV_HEAD' },
  });
  const sponsorshipHeadRole = await prisma.role.findUniqueOrThrow({
    where: { name: 'SPONSORSHIP_HEAD' },
  });
  const eventManagementHeadRole = await prisma.role.findUniqueOrThrow({
    where: { name: 'EVENT_MANAGEMENT_HEAD' },
  });
  const designHeadRole = await prisma.role.findUniqueOrThrow({
    where: { name: 'DESIGN_HEAD' },
  });
  const coConvenerRole = await prisma.role.findUniqueOrThrow({
    where: { name: 'CO_CONVENER' },
  });
  const volunteerRole = await prisma.role.findUniqueOrThrow({
    where: { name: 'VOLUNTEER' },
  });

  // Convener and Co-Convener get everything EXCEPT RBAC administration —
  // role.view/assign/revoke are deliberately held by Web Dev Head alone (see
  // webDevPermActions below), so a Co-Convener signing in can't touch role
  // assignments even though they get every other permission that exists.
  const RBAC_ADMIN_ACTIONS = new Set([
    'role.view',
    'role.assign',
    'role.revoke',
  ]);
  for (const perm of allPermissions) {
    if (RBAC_ADMIN_ACTIONS.has(perm.action)) continue;
    for (const roleId of [convenerRole.id, coConvenerRole.id]) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId,
            permissionId: perm.id,
          },
        },
        update: {},
        create: {
          roleId,
          permissionId: perm.id,
        },
      });
    }
  }
  // Clean up RBAC admin grants from earlier seed runs, before this exclusion existed.
  await prisma.rolePermission.deleteMany({
    where: {
      roleId: { in: [convenerRole.id, coConvenerRole.id] },
      permission: { action: { in: Array.from(RBAC_ADMIN_ACTIONS) } },
    },
  });

  // Overall Sports Coordinator permissions. Deliberately NO tournament.create/
  // update or competition.manage — creating, editing or deleting a Tournament
  // itself (structure, seeding, bracket generation) is kept to Convener/
  // Co-Convener/Web Dev Head only (see MatchesService.verifyCompetitionAuthority
  // vs TournamentsService's own, stricter check of the same name). match.update
  // is what actually authorizes creating/editing matches inside an existing
  // tournament — unscoped here, so it covers every sport.
  const overallSportPermActions = [
    'sport.view',
    'sport.update',
    'tournament.view',
    'team.view',
    'team.update',
    'participant.view',
    'fixture.view',
    'fixture.create',
    'fixture.update',
    'match.view',
    'match.create',
    'match.update',
    'score.view',
    'score.update',
    'result.view',
    'result.submit',
    'result.approve',
    'standings.view',
    'venue.view',
    'venue.create',
    'venue.update',
    'task.view',
    'task.create',
    'task.update',
    'volunteer.view.department',
  ];
  for (const action of overallSportPermActions) {
    const permId = permMap.get(action);
    if (permId) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: overallCoordRole.id,
            permissionId: permId,
          },
        },
        update: {},
        create: { roleId: overallCoordRole.id, permissionId: permId },
      });
    }
  }

  // Sports Coordinator permissions (scoped per sport). Deliberately NO
  // tournament.create/update or competition.manage — same reasoning as
  // Overall Sports Coordinator above. match.create/match.update, scoped to
  // this coordinator's own sportId via UserRole, is what lets them CRUD
  // matches inside their sport's tournament without touching its structure.
  const sportsCoordPermActions = [
    'sport.view',
    'tournament.view',
    'team.view',
    'participant.view',
    'fixture.view',
    'fixture.create',
    'fixture.update',
    'match.view',
    'match.create',
    'match.update',
    'score.view',
    'score.update',
    'result.view',
    'result.submit',
    'result.approve',
    'standings.view',
    'task.view',
    'task.create',
    'task.update',
    'volunteer.view.department',
  ];
  for (const action of sportsCoordPermActions) {
    const permId = permMap.get(action);
    if (permId) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: sportsCoordRole.id,
            permissionId: permId,
          },
        },
        update: {},
        create: { roleId: sportsCoordRole.id, permissionId: permId },
      });
    }
  }
  // Clean up tournament-structure grants from earlier seed runs, before this
  // exclusion existed — upserts above only add/refresh, they never remove.
  await prisma.rolePermission.deleteMany({
    where: {
      roleId: { in: [overallCoordRole.id, sportsCoordRole.id] },
      permission: {
        action: {
          in: ['competition.manage', 'tournament.create', 'tournament.update'],
        },
      },
    },
  });

  // Media Head permissions
  const mediaPermActions = [
    'media.create',
    'media.update',
    'media.publish',
    'standings.view',
    'match.view',
    'task.view',
    'task.create',
    'task.update',
    'volunteer.view.department',
  ];
  for (const action of mediaPermActions) {
    const permId = permMap.get(action);
    if (permId) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: mediaHeadRole.id,
            permissionId: permId,
          },
        },
        update: {},
        create: { roleId: mediaHeadRole.id, permissionId: permId },
      });
    }
  }

  // Media Team member permissions — submit-only, no media.publish (they queue
  // content for the Media Head to approve; see MediaAssetsModule).
  const mediaTeamPermActions = [
    'media.create',
    'standings.view',
    'match.view',
    'task.view',
    'task.update',
  ];
  for (const action of mediaTeamPermActions) {
    const permId = permMap.get(action);
    if (permId) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: mediaTeamRole.id,
            permissionId: permId,
          },
        },
        update: {},
        create: { roleId: mediaTeamRole.id, permissionId: permId },
      });
    }
  }

  // Hospitality & Security Head permissions — the two functions run as one
  // combined team on the ground (per the real org chart), so this role gets
  // the union of what a Hospitality Head and a Security Head each held.
  const hospitalitySecurityHeadPermActions = [
    'participant.view',
    'participant.update',
    'participant.create',
    'venue.view',
    'venue.update',
    'team.view',
    'match.view',
    'standings.view',
    'security.access',
    'task.view',
    'task.create',
    'task.update',
    'volunteer.view.department',
  ];
  for (const action of hospitalitySecurityHeadPermActions) {
    const permId = permMap.get(action);
    if (permId) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: hospitalitySecurityHeadRole.id,
            permissionId: permId,
          },
        },
        update: {},
        create: {
          roleId: hospitalitySecurityHeadRole.id,
          permissionId: permId,
        },
      });
    }
  }

  // Hospitality & Security Volunteers are restricted to the Security tab (no
  // separate Workforce/RBAC/Sports/Venue tabs) — see organizer/page.tsx
  // canSeeWorkforceDept, which deliberately excludes this role. task.view/
  // task.update are still granted so they can see and complete tasks assigned
  // to them; those show up inside the Security tab's own task list, not the
  // full Workforce dispatch card. Also carries the generic ground-volunteer
  // permissions (match/standings/fixture/team view) since Hospitality has no
  // separate ground role of its own — see GROUND_ROLE_BY_DEPARTMENT.
  const hospitalitySecurityVolunteerPermActions = [
    'participant.view',
    'participant.update',
    'venue.view',
    'security.access',
    'task.view',
    'task.update',
    'match.view',
    'score.view',
    'standings.view',
    'fixture.view',
    'team.view',
  ];
  for (const action of hospitalitySecurityVolunteerPermActions) {
    const permissionId = permMap.get(action);
    if (permissionId) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: hospitalitySecurityVolunteerRole.id,
            permissionId,
          },
        },
        update: {},
        create: { roleId: hospitalitySecurityVolunteerRole.id, permissionId },
      });
    }
  }

  // Web Dev Head permissions (RBAC administration + technical/site configuration)
  const webDevPermActions = [
    'role.view',
    'role.assign',
    'role.revoke',
    'user.view',
    'user.update',
    'audit.view',
    'sponsor.create',
    'sponsor.update',
    'sponsor.delete',
    'venue.view',
    'venue.create',
    'venue.update',
    'sport.view',
    'sport.create',
    'sport.update',
    // Tournament structure (create/update/delete a Tournament, seed it,
    // generate its bracket) is deliberately kept to this role plus Convener/
    // Co-Convener — see TournamentsService.verifyCompetitionAuthority. Sports
    // Coordinators get match.create/match.update instead, scoped to their own
    // sport, which only lets them CRUD matches inside a tournament someone
    // with this permission already built.
    'tournament.view',
    'tournament.create',
    'tournament.update',
    'competition.manage',
    'task.view',
    'task.create',
    'task.update',
    'volunteer.view.department',
  ];
  for (const action of webDevPermActions) {
    const permId = permMap.get(action);
    if (permId) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: webDevHeadRole.id,
            permissionId: permId,
          },
        },
        update: {},
        create: { roleId: webDevHeadRole.id, permissionId: permId },
      });
    }
  }

  // Sponsorship Head permissions — owns the sponsor roster shown on the
  // public site plus their own team's tasks.
  const sponsorshipHeadPermActions = [
    'sponsor.create',
    'sponsor.update',
    'sponsor.delete',
    'task.view',
    'task.create',
    'task.update',
    'volunteer.view.department',
  ];
  for (const action of sponsorshipHeadPermActions) {
    const permId = permMap.get(action);
    if (permId) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: sponsorshipHeadRole.id,
            permissionId: permId,
          },
        },
        update: {},
        create: { roleId: sponsorshipHeadRole.id, permissionId: permId },
      });
    }
  }

  // Event Management Head permissions — general on-ground logistics
  // oversight, not tied to a single sport or department's resources.
  const eventManagementHeadPermActions = [
    'task.view',
    'task.create',
    'task.update',
    'volunteer.view.department',
    'venue.view',
    'participant.view',
  ];
  for (const action of eventManagementHeadPermActions) {
    const permId = permMap.get(action);
    if (permId) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: eventManagementHeadRole.id,
            permissionId: permId,
          },
        },
        update: {},
        create: { roleId: eventManagementHeadRole.id, permissionId: permId },
      });
    }
  }

  // Design Head permissions — creative/graphics team; media.create lets them
  // queue design assets the same way Media Team submits photos.
  const designHeadPermActions = [
    'task.view',
    'task.create',
    'task.update',
    'volunteer.view.department',
    'media.create',
  ];
  for (const action of designHeadPermActions) {
    const permId = permMap.get(action);
    if (permId) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: designHeadRole.id,
            permissionId: permId,
          },
        },
        update: {},
        create: { roleId: designHeadRole.id, permissionId: permId },
      });
    }
  }

  // Volunteer permissions
  const volunteerPermActions = [
    'match.view',
    'score.view',
    'standings.view',
    'fixture.view',
    'team.view',
    'venue.view',
    'task.view',
    'task.update',
  ];
  for (const action of volunteerPermActions) {
    const permId = permMap.get(action);
    if (permId) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: volunteerRole.id,
            permissionId: permId,
          },
        },
        update: {},
        create: { roleId: volunteerRole.id, permissionId: permId },
      });
    }
  }

  // Sports Volunteer permissions — ground-level sports duty. Deliberately no
  // score.update/result.submit: scoring authority for this role comes only from
  // being assigned as a MatchOfficial on a specific match (see ScoringService.
  // verifyScoringAuthority and OperationsTasksService's match-linked task flow),
  // never sport-wide.
  const sportsVolunteerPermActions = [
    'match.view',
    'score.view',
    'standings.view',
    'task.view',
    'task.update',
  ];
  for (const action of sportsVolunteerPermActions) {
    const permId = permMap.get(action);
    if (permId) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: sportsVolunteerRole.id,
            permissionId: permId,
          },
        },
        update: {},
        create: { roleId: sportsVolunteerRole.id, permissionId: permId },
      });
    }
  }

  // `--convener=<email>`: recovery path for when the sign-in bootstrap
  // (CONVENER_BOOTSTRAP_EMAIL) couldn't run, e.g. roles weren't seeded yet.
  // The account must have signed in with Google once so its User row exists.
  const convenerEmail = process.argv
    .find((arg) => arg.startsWith('--convener='))
    ?.slice('--convener='.length)
    .trim()
    .toLowerCase();
  if (convenerEmail) {
    const user = await prisma.user.findUnique({
      where: { emailHash: seedBlindIndex(convenerEmail) },
    });
    if (!user)
      throw new Error(
        `No account for ${convenerEmail}. Sign in with Google once, then re-run.`,
      );
    const existing = await prisma.userRole.findFirst({
      where: {
        userId: user.id,
        roleId: convenerRole.id,
        eventId: { equals: null },
        departmentId: { equals: null },
        sportId: { equals: null },
      },
    });
    if (existing) {
      console.log(`${convenerEmail} is already CONVENER.`);
    } else {
      const userRole = await prisma.userRole.create({
        data: { userId: user.id, roleId: convenerRole.id },
      });
      await prisma.auditLog.create({
        data: {
          userId: null,
          action: 'role.assign',
          resource: 'UserRole',
          resourceId: userRole.id,
          newState: {
            targetUserId: user.id,
            targetUserEmail: user.email,
            roleName: 'CONVENER',
            source: 'seed --convener',
          },
        },
      });
      console.log(`Granted CONVENER to ${convenerEmail}.`);
    }
  }

  if (
    process.argv.includes('--roles-only') ||
    process.env.NODE_ENV === 'production'
  )
    return;

  // Seed Convoquer'26 Event
  const event = await prisma.event.upsert({
    where: { slug: 'convoquer-26' },
    update: {
      name: "Convoquer'26",
      edition: '2026',
      startDate: new Date('2026-10-01T00:00:00.000Z'),
      endDate: new Date('2026-10-04T23:59:59.000Z'),
      description: 'Official Annual Sports Fest of IIT Jammu',
      status: 'ACTIVE',
    },
    create: {
      slug: 'convoquer-26',
      name: "Convoquer'26",
      edition: '2026',
      startDate: new Date('2026-10-01T00:00:00.000Z'),
      endDate: new Date('2026-10-04T23:59:59.000Z'),
      description: 'Official Annual Sports Fest of IIT Jammu',
      status: 'ACTIVE',
    },
  });

  // Seed Confirmed Sports — Men's/Women's draws are separate Sport records
  // (not a field on one shared Sport) since each fields its own champion,
  // standings and medal count. Squash was dropped; Athletics/Weight Lifting/
  // E-Sports exist as placeholders with no tournament yet (format on hold).
  const confirmedSports: {
    name: string;
    description: string;
    scoringMode?: string;
  }[] = [
    {
      name: 'Badminton (Men)',
      description: 'Knockout tournament, group stage then knockout',
    },
    {
      name: 'Badminton (Women)',
      description: 'Knockout tournament, group stage then knockout',
    },
    {
      name: 'Basketball (Men)',
      description: '5v5 full-court knockout tournament',
    },
    {
      name: 'Basketball (Women)',
      description: '5v5 full-court knockout tournament',
    },
    { name: 'Cricket', description: 'Knockout tournament' },
    { name: 'Football', description: 'Knockout tournament' },
    { name: 'Table Tennis (Men)', description: 'Knockout tournament' },
    { name: 'Table Tennis (Women)', description: 'Knockout tournament' },
    { name: 'Volleyball (Men)', description: 'Knockout tournament' },
    { name: 'Volleyball (Women)', description: 'Knockout tournament' },
    {
      name: 'Chess (Men)',
      description: 'Round robin, Sonneborn–Berger tiebreak',
      scoringMode: 'RESULT_ONLY',
    },
    {
      name: 'Chess (Women)',
      description: 'Round robin, Sonneborn–Berger tiebreak',
      scoringMode: 'RESULT_ONLY',
    },
    { name: 'Athletics', description: 'Track and field — format TBC' },
    { name: 'Weight Lifting', description: 'Format on hold' },
    { name: 'E-Sports', description: 'BGMI, Free Fire, Valorant — format TBC' },
  ];

  for (const sport of confirmedSports) {
    const existing = await prisma.sport.findFirst({
      where: { eventId: event.id, name: sport.name },
    });
    const scoringMode = sport.scoringMode ?? 'LIVE';

    if (existing) {
      await prisma.sport.update({
        where: { id: existing.id },
        data: { description: sport.description, status: 'ACTIVE', scoringMode },
      });
    } else {
      await prisma.sport.create({
        data: {
          eventId: event.id,
          name: sport.name,
          description: sport.description,
          status: 'ACTIVE',
          scoringMode,
        },
      });
    }
  }

  // Seed Venues — no coordinates yet; the Web Dev Head places pins on the
  // campus map via /sports/manager once these exist.
  const campusVenues: { name: string; location: string | null }[] = [
    { name: 'Badminton Courts', location: 'Chinar Sports Complex' },
    { name: 'Basketball Court', location: null },
    { name: 'Student Activity Centre', location: 'Chinar Sports Complex' },
    { name: 'Khel Gaon', location: 'Athletics Ground' },
    { name: 'Football Ground', location: null },
    { name: 'Table Tennis Court', location: 'Chinar Sports Complex' },
    { name: 'Volleyball Court', location: null },
  ];

  for (const venue of campusVenues) {
    const existing = await prisma.venue.findFirst({
      where: { eventId: event.id, name: venue.name },
    });

    if (existing) {
      await prisma.venue.update({
        where: { id: existing.id },
        data: { location: venue.location, status: 'ACTIVE' },
      });
    } else {
      await prisma.venue.create({
        data: {
          eventId: event.id,
          name: venue.name,
          location: venue.location,
          status: 'ACTIVE',
        },
      });
    }
  }

  // Seed Participating Institutes — the 17 confirmed delegations, exactly as
  // named in the official participation sheet.
  const institutesData: { name: string; shortName: string }[] = [
    { name: 'MIET', shortName: 'MIET' },
    { name: 'IIM Jammu', shortName: 'IIMJ' },
    { name: 'SMVDU', shortName: 'SMVDU' },
    { name: 'ASCOMS', shortName: 'ASCOMS' },
    { name: 'Central University of Jammu', shortName: 'CU' },
    { name: 'GMC Jammu', shortName: 'GMC' },
    { name: 'GCET', shortName: 'GCET' },
    { name: 'Bhaskar Degree College Udhampur', shortName: 'BDC' },
    { name: 'GGMS Jammu', shortName: 'GGMS' },
    { name: 'Lovely Professional University', shortName: 'LPU' },
    { name: 'IIM Amritsar', shortName: 'IIMA' },
    { name: 'Amity University, Punjab', shortName: 'AMITY' },
    { name: 'Baba Ghulam Shah Badshah University', shortName: 'BGSBU' },
    {
      name: 'Sher-e-Kashmir University of Agricultural Sciences and Technology',
      shortName: 'SKUAST',
    },
    { name: 'AIIMS', shortName: 'AIIMS' },
    { name: 'Central Sanskrit University', shortName: 'CSU' },
    { name: 'Indian Institute of Technology Jammu', shortName: 'IIT Jammu' },
  ];

  for (const inst of institutesData) {
    const existing = await prisma.institute.findFirst({
      where: { eventId: event.id, name: inst.name },
    });
    if (existing) {
      await prisma.institute.update({
        where: { id: existing.id },
        data: { shortName: inst.shortName, status: 'ACTIVE' },
      });
    } else {
      await prisma.institute.create({
        data: {
          eventId: event.id,
          name: inst.name,
          shortName: inst.shortName,
          status: 'ACTIVE',
        },
      });
    }
  }

  console.log(
    'Seeding complete. Seeded permissions, roles, event, sports, venues, and institutes. Teams, brackets and volunteer import are a separate pass.',
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
