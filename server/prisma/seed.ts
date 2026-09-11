import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

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
    { action: 'sport.create', description: 'Create a new sport' },
    { action: 'sport.update', description: 'Update sport rules and details' },
    { action: 'tournament.view', description: 'View tournament structures' },
    { action: 'tournament.create', description: 'Create tournaments' },
    { action: 'tournament.update', description: 'Update tournaments' },

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
      name: 'MEDIA_HEAD',
      description: 'Media, gallery and announcement operations lead',
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
  const overallCoordRole = await prisma.role.findUniqueOrThrow({
    where: { name: 'OVERALL_SPORTS_COORDINATOR' },
  });
  const mediaHeadRole = await prisma.role.findUniqueOrThrow({
    where: { name: 'MEDIA_HEAD' },
  });
  const volunteerRole = await prisma.role.findUniqueOrThrow({
    where: { name: 'VOLUNTEER' },
  });

  // Convener gets everything
  for (const perm of allPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: convenerRole.id,
          permissionId: perm.id,
        },
      },
      update: {},
      create: {
        roleId: convenerRole.id,
        permissionId: perm.id,
      },
    });
  }

  // Overall Sports Coordinator permissions
  const overallSportPermActions = [
    'sport.view',
    'sport.update',
    'tournament.view',
    'tournament.create',
    'tournament.update',
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
    'standings.view',
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

  // Volunteer permissions
  const volunteerPermActions = [
    'match.view',
    'score.view',
    'standings.view',
    'fixture.view',
    'team.view',
    'venue.view',
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
        where: { eventId: event.id, rollNumber: ath.rollNumber },
      });
      if (!part) {
        part = await prisma.participant.create({
          data: {
            eventId: event.id,
            instituteId: ath.instituteId,
            name: ath.name,
            rollNumber: ath.rollNumber,
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
          contactNumber: aud.contactNumber,
          category: aud.category,
          gatePassNumber: aud.gatePassNumber,
          isCheckedIn: aud.isCheckedIn,
          checkedInAt: aud.checkedInAt,
        },
      });
    }
  }

  console.log(
    'Seeding complete. Seeded permissions, roles, event, sports, venues, institutes, teams, and audience passes.',
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
