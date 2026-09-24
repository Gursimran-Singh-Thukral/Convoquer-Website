import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { createCipheriv, createHmac, randomBytes } from 'crypto';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Mirrors server/src/common/crypto/field-crypto.ts's blindIndex(). Duplicated
// (rather than imported) because this script runs standalone via
// `node --experimental-strip-types`, which can't resolve the app's compiled
// `.js` import specifiers against source `.ts` files outside a build step.
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

function seedEncrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', seedEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
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
      name: 'HOSPITALITY_HEAD',
      description: 'Hospitality, logistics and on-ground guest operations lead',
    },
    {
      name: 'SECURITY_HEAD',
      description:
        'Security, gate pass and participant clearance operations lead',
    },
    {
      name: 'SECURITY_VOLUNTEER',
      description: 'Security volunteer with gate entry and exit access',
    },
    {
      name: 'WEB_DEV_HEAD',
      description: 'Website, RBAC and technical operations lead',
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
  const hospitalityHeadRole = await prisma.role.findUniqueOrThrow({
    where: { name: 'HOSPITALITY_HEAD' },
  });
  const securityHeadRole = await prisma.role.findUniqueOrThrow({
    where: { name: 'SECURITY_HEAD' },
  });
  const securityVolunteerRole = await prisma.role.findUniqueOrThrow({
    where: { name: 'SECURITY_VOLUNTEER' },
  });
  const webDevHeadRole = await prisma.role.findUniqueOrThrow({
    where: { name: 'WEB_DEV_HEAD' },
  });
  const coConvenerRole = await prisma.role.findUniqueOrThrow({
    where: { name: 'CO_CONVENER' },
  });
  const volunteerRole = await prisma.role.findUniqueOrThrow({
    where: { name: 'VOLUNTEER' },
  });

  // Convener and Co-Convener get everything (event-wide leadership authority)
  for (const perm of allPermissions) {
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

  // Overall Sports Coordinator permissions
  const overallSportPermActions = [
    'sport.view',
    'sport.update',
    'tournament.view',
    'tournament.create',
    'tournament.update',
    'competition.manage',
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

  // Sports Coordinator permissions (scoped per sport)
  const sportsCoordPermActions = [
    'sport.view',
    'tournament.view',
    'tournament.update',
    'competition.manage',
    'team.view',
    'participant.view',
    'fixture.view',
    'fixture.create',
    'fixture.update',
    'match.view',
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

  // Hospitality Head permissions
  const hospitalityPermActions = [
    'participant.view',
    'participant.update',
    'venue.view',
    'venue.update',
    'team.view',
    'match.view',
    'standings.view',
    'task.view',
    'task.create',
    'task.update',
    'volunteer.view.department',
  ];
  for (const action of hospitalityPermActions) {
    const permId = permMap.get(action);
    if (permId) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: hospitalityHeadRole.id,
            permissionId: permId,
          },
        },
        update: {},
        create: { roleId: hospitalityHeadRole.id, permissionId: permId },
      });
    }
  }

  // Security Head permissions
  const securityPermActions = [
    'participant.view',
    'participant.update',
    'participant.create',
    'venue.view',
    'match.view',
    'standings.view',
    'security.access',
    'task.view',
    'task.create',
    'task.update',
    'volunteer.view.department',
  ];
  for (const action of securityPermActions) {
    const permId = permMap.get(action);
    if (permId) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: securityHeadRole.id,
            permissionId: permId,
          },
        },
        update: {},
        create: { roleId: securityHeadRole.id, permissionId: permId },
      });
    }
  }

  // Security Volunteers are restricted to the Security tab (no separate
  // Workforce/RBAC/Sports/Venue tabs) — see organizer/page.tsx canSeeWorkforceDept,
  // which deliberately excludes this role. task.view/task.update are still
  // granted so they can see and complete tasks assigned to them; those show up
  // inside the Security tab's own task list, not the full Workforce dispatch card.
  const securityVolunteerPermActions = [
    'participant.view',
    'participant.update',
    'venue.view',
    'security.access',
    'task.view',
    'task.update',
  ];
  for (const action of securityVolunteerPermActions) {
    const permissionId = permMap.get(action);
    if (permissionId) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: securityVolunteerRole.id,
            permissionId,
          },
        },
        update: {},
        create: { roleId: securityVolunteerRole.id, permissionId },
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
    'sport.view',
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

  // Seed Confirmed Sports
  const confirmedSports = [
    { name: 'Cricket', description: 'T20 & League Cricket tournament' },
    {
      name: 'Football',
      description: 'Full-pitch inter-college football championship',
    },
    { name: 'Basketball', description: '5v5 full-court basketball tournament' },
    { name: 'Volleyball', description: 'Standard 6v6 volleyball championship' },
    {
      name: 'Badminton',
      description: 'Singles and doubles badminton competition',
    },
    {
      name: 'Table Tennis',
      description: 'Singles and doubles table tennis tournament',
    },
    { name: 'Athletics', description: 'Track and field athletics events' },
    { name: 'Chess', description: 'Classical & rapid chess tournament' },
    { name: 'Squash', description: 'Singles squash tournament' },
    {
      name: 'Weightlifting',
      description: 'Snatch and Clean & Jerk weightlifting competition',
    },
  ];

  for (const sport of confirmedSports) {
    const existing = await prisma.sport.findFirst({
      where: { eventId: event.id, name: sport.name },
    });

    if (existing) {
      await prisma.sport.update({
        where: { id: existing.id },
        data: { description: sport.description, status: 'ACTIVE' },
      });
    } else {
      await prisma.sport.create({
        data: {
          eventId: event.id,
          name: sport.name,
          description: sport.description,
          status: 'ACTIVE',
        },
      });
    }
  }

  // Seed Venues
  const campusVenues = [
    { name: 'Main Ground', location: 'Campus West' },
    { name: 'Cricket Ground', location: 'Campus South' },
    {
      name: 'Indoor Sports Complex',
      location: 'Student Activity Centre (SAC)',
    },
    { name: 'Basketball Court', location: 'Outdoor Sports Enclave' },
    { name: 'Volleyball Court', location: 'Outdoor Sports Enclave' },
    { name: 'Squash Court', location: 'Student Activity Centre (SAC)' },
    { name: 'Weightlifting Hall', location: 'Student Activity Centre (SAC)' },
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

  // Seed Participating Institutes
  const institutesData = [
    {
      name: 'Indian Institute of Technology Jammu',
      shortName: 'IIT Jammu',
      city: 'Jammu',
      state: 'J&K',
    },
    {
      name: 'National Institute of Technology Srinagar',
      shortName: 'NIT Srinagar',
      city: 'Srinagar',
      state: 'J&K',
    },
    {
      name: 'Shri Mata Vaishno Devi University',
      shortName: 'SMVDU',
      city: 'Katra',
      state: 'J&K',
    },
    {
      name: 'Government College of Engineering and Technology',
      shortName: 'GCET Jammu',
      city: 'Jammu',
      state: 'J&K',
    },
  ];

  const institutesMap = new Map<string, any>();
  for (const inst of institutesData) {
    let existing = await prisma.institute.findFirst({
      where: { eventId: event.id, name: inst.name },
    });
    if (!existing) {
      existing = await prisma.institute.create({
        data: {
          eventId: event.id,
          name: inst.name,
          shortName: inst.shortName,
          city: inst.city,
          state: inst.state,
          status: 'ACTIVE',
        },
      });
    }
    institutesMap.set(inst.shortName, existing);
  }

  // Seed Sample Teams & Athletes for Football
  const football = await prisma.sport.findFirst({
    where: { eventId: event.id, name: 'Football' },
  });
  const iitj = institutesMap.get('IIT Jammu');
  const nits = institutesMap.get('NIT Srinagar');

  if (football && iitj && nits) {
    // 1. IIT Jammu Football Team
    let iitjTeam = await prisma.team.findFirst({
      where: { eventId: event.id, instituteId: iitj.id, sportId: football.id },
    });
    if (!iitjTeam) {
      iitjTeam = await prisma.team.create({
        data: {
          eventId: event.id,
          instituteId: iitj.id,
          sportId: football.id,
          name: 'IIT Jammu Football',
        },
      });
    }

    // 2. NIT Srinagar Football Team
    let nitsTeam = await prisma.team.findFirst({
      where: { eventId: event.id, instituteId: nits.id, sportId: football.id },
    });
    if (!nitsTeam) {
      nitsTeam = await prisma.team.create({
        data: {
          eventId: event.id,
          instituteId: nits.id,
          sportId: football.id,
          name: 'NIT Srinagar Football',
        },
      });
    }

    // Seed Sample Athletes
    const athletes = [
      {
        name: 'Aarav Sharma',
        rollNumber: '2023UEC0012',
        instituteId: iitj.id,
        gender: 'MALE',
        teamId: iitjTeam.id,
        role: 'CAPTAIN',
        gatePassNumber: 'CQ26-P-1001',
      },
      {
        name: 'Rohan Verma',
        rollNumber: '2023UCS0045',
        instituteId: iitj.id,
        gender: 'MALE',
        teamId: iitjTeam.id,
        role: 'PLAYER',
        gatePassNumber: 'CQ26-P-1002',
      },
      {
        name: 'Tufail Ahmed',
        rollNumber: '2022NIT089',
        instituteId: nits.id,
        gender: 'MALE',
        teamId: nitsTeam.id,
        role: 'CAPTAIN',
        gatePassNumber: 'CQ26-P-2001',
      },
    ];

    for (const ath of athletes) {
      let part = await prisma.participant.findFirst({
        where: {
          eventId: event.id,
          rollNumberHash: seedBlindIndex(ath.rollNumber),
        },
      });
      if (!part) {
        part = await prisma.participant.create({
          data: {
            eventId: event.id,
            instituteId: ath.instituteId,
            name: ath.name,
            rollNumber: seedEncrypt(ath.rollNumber),
            rollNumberHash: seedBlindIndex(ath.rollNumber),
            gender: ath.gender,
            category: 'ATHLETE',
            gatePassNumber: ath.gatePassNumber,
          },
        });
      }

      await prisma.teamMember.upsert({
        where: {
          teamId_participantId: { teamId: ath.teamId, participantId: part.id },
        },
        update: { role: ath.role },
        create: {
          teamId: ath.teamId,
          participantId: part.id,
          role: ath.role,
        },
      });
    }
  }

  // Seed Sample Audience / Visitor Passes (to demonstrate Security Search & Gate Verification)
  const audienceList = [
    {
      name: 'Priya Gupta',
      contactNumber: '+919876543210',
      category: 'AUDIENCE',
      gatePassNumber: 'CQ26-AUD-3001',
      isCheckedIn: false,
    },
    {
      name: 'Amit Kumar',
      contactNumber: '+919812345678',
      category: 'AUDIENCE',
      gatePassNumber: 'CQ26-AUD-3002',
      isCheckedIn: true,
      checkedInAt: new Date(),
    },
  ];

  for (const aud of audienceList) {
    const existing = await prisma.participant.findFirst({
      where: { eventId: event.id, gatePassNumber: aud.gatePassNumber },
    });
    if (!existing) {
      await prisma.participant.create({
        data: {
          eventId: event.id,
          name: aud.name,
          contactNumber: seedEncrypt(aud.contactNumber),
          category: aud.category,
          gatePassNumber: aud.gatePassNumber,
          isCheckedIn: aud.isCheckedIn,
          checkedInAt: aud.checkedInAt,
        },
      });
    }
  }

  // =========================================================================
  // SEED TOURNAMENT, SEEDS, FIXTURES & MATCHES (PHASE 7)
  // =========================================================================
  const footballSport = await prisma.sport.findFirst({
    where: { eventId: event.id, name: 'Football' },
  });
  const mainGround = await prisma.venue.findFirst({
    where: { eventId: event.id, name: 'Main Ground' },
  });

  if (footballSport && mainGround) {
    let footballTournament = await prisma.tournament.findFirst({
      where: {
        eventId: event.id,
        sportId: footballSport.id,
        name: "Convoquer'26 Inter-College Football Cup",
      },
    });

    if (!footballTournament) {
      footballTournament = await prisma.tournament.create({
        data: {
          eventId: event.id,
          sportId: footballSport.id,
          name: "Convoquer'26 Inter-College Football Cup",
          format: 'KNOCKOUT',
          status: 'UPCOMING',
          pointsForWin: 3,
          pointsForDraw: 1,
          pointsForLoss: 0,
        },
      });
    }

    const smvduInst = institutesMap.get('SMVDU');
    const gcetInst = institutesMap.get('GCET Jammu');

    let teamIITJ = await prisma.team.findFirst({
      where: { eventId: event.id, name: { contains: 'IIT Jammu' } },
    });
    let teamNIT = await prisma.team.findFirst({
      where: { eventId: event.id, name: { contains: 'NIT Srinagar' } },
    });
    let teamSMVDU = await prisma.team.findFirst({
      where: { eventId: event.id, name: { contains: 'SMVDU' } },
    });
    if (!teamSMVDU && smvduInst) {
      teamSMVDU = await prisma.team.create({
        data: {
          eventId: event.id,
          instituteId: smvduInst.id,
          sportId: footballSport.id,
          name: 'SMVDU Football',
        },
      });
    }

    let teamGCET = await prisma.team.findFirst({
      where: { eventId: event.id, name: { contains: 'GCET' } },
    });
    if (!teamGCET && gcetInst) {
      teamGCET = await prisma.team.create({
        data: {
          eventId: event.id,
          instituteId: gcetInst.id,
          sportId: footballSport.id,
          name: 'GCET Football',
        },
      });
    }

    if (teamIITJ && teamNIT && teamSMVDU && teamGCET) {
      // Configure Tournament Seeding:
      // Seed 1: IIT Jammu (Defending Champ)
      // Seed 2: NIT Srinagar (Runners Up)
      // Seed 3: SMVDU
      // Seed 4: GCET
      // Ensures Seed 1 and Seed 2 are in opposite halves of the bracket and can ONLY meet in Finals!
      const seedEntries = [
        {
          teamId: teamIITJ.id,
          seedNumber: 1,
          notes: 'Defending Champion - Seed 1 (Top Half)',
        },
        {
          teamId: teamNIT.id,
          seedNumber: 2,
          notes: 'Finalist 2025 - Seed 2 (Bottom Half)',
        },
        {
          teamId: teamSMVDU.id,
          seedNumber: 3,
          notes: 'Semifinalist 2025 - Seed 3',
        },
        { teamId: teamGCET.id, seedNumber: 4, notes: 'Seed 4' },
      ];

      for (const se of seedEntries) {
        await prisma.tournamentTeamSeed.upsert({
          where: {
            tournamentId_teamId: {
              tournamentId: footballTournament.id,
              teamId: se.teamId,
            },
          },
          update: { seedNumber: se.seedNumber, notes: se.notes },
          create: {
            tournamentId: footballTournament.id,
            teamId: se.teamId,
            seedNumber: se.seedNumber,
            notes: se.notes,
          },
        });
      }

      // Create Semifinal and Final Stages
      let semiStage = await prisma.tournamentStage.findFirst({
        where: { tournamentId: footballTournament.id, name: 'Semifinals' },
      });
      if (!semiStage) {
        semiStage = await prisma.tournamentStage.create({
          data: {
            tournamentId: footballTournament.id,
            name: 'Semifinals',
            sequence: 1,
            stageType: 'KNOCKOUT',
            status: 'PENDING',
          },
        });
      }

      // Match 1: Seed 1 (IIT Jammu) vs Seed 4 (GCET) [Top Half]
      const m1Existing = await prisma.match.findFirst({
        where: { tournamentId: footballTournament.id, matchNumber: 'FB-SF-01' },
      });
      let m1 = m1Existing;
      if (!m1Existing) {
        m1 = await prisma.match.create({
          data: {
            tournamentId: footballTournament.id,
            stageId: semiStage.id,
            venueId: mainGround.id,
            matchNumber: 'FB-SF-01',
            teamAId: teamIITJ.id,
            teamBId: teamGCET.id,
            scheduledStartTime: new Date('2026-10-02T09:00:00Z'),
            scheduledEndTime: new Date('2026-10-02T10:30:00Z'),
            status: 'SCHEDULED',
          },
        });
      }

      // Match 2: Seed 2 (NIT Srinagar) vs Seed 3 (SMVDU) [Bottom Half]
      // Notice: Seed 1 and Seed 2 are separated into opposite semifinals!
      const m2Existing = await prisma.match.findFirst({
        where: { tournamentId: footballTournament.id, matchNumber: 'FB-SF-02' },
      });
      let m2 = m2Existing;
      if (!m2Existing) {
        m2 = await prisma.match.create({
          data: {
            tournamentId: footballTournament.id,
            stageId: semiStage.id,
            venueId: mainGround.id,
            matchNumber: 'FB-SF-02',
            teamAId: teamNIT.id,
            teamBId: teamSMVDU.id,
            scheduledStartTime: new Date('2026-10-02T11:00:00Z'),
            scheduledEndTime: new Date('2026-10-02T12:30:00Z'),
            status: 'SCHEDULED',
          },
        });
      }

      // Assign Lead Referee / Scorekeeper to matches
      const leadUser = await prisma.user.findFirst({
        where: { emailHash: seedBlindIndex('convener@iitjammu.ac.in') },
      });
      if (leadUser && m1 && m2) {
        await prisma.matchOfficial.upsert({
          where: { matchId_userId: { matchId: m1.id, userId: leadUser.id } },
          update: { role: 'REFEREE' },
          create: { matchId: m1.id, userId: leadUser.id, role: 'REFEREE' },
        });
        await prisma.matchOfficial.upsert({
          where: { matchId_userId: { matchId: m2.id, userId: leadUser.id } },
          update: { role: 'REFEREE' },
          create: { matchId: m2.id, userId: leadUser.id, role: 'REFEREE' },
        });
      }
    }
  }

  console.log(
    'Seeding complete. Seeded permissions, roles, event, sports, venues, institutes, teams, audience passes, tournament seeds, and seeded knockout fixtures.',
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
