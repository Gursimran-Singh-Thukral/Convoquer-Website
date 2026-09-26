import { randomUUID } from 'crypto';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { RbacService } from '../src/modules/rbac/rbac.service.js';
import { VolunteersService } from '../src/modules/volunteers/volunteers.service.js';
import { OperationsTasksService } from '../src/modules/operations-tasks/operations-tasks.service.js';
import { DashboardService } from '../src/modules/dashboard/dashboard.service.js';
import { EventsService } from '../src/modules/competition/events.service.js';
import { SportsService } from '../src/modules/competition/sports.service.js';
import { VenuesService } from '../src/modules/competition/venues.service.js';
import { InstitutesService } from '../src/modules/teams/institutes.service.js';
import { TeamsService } from '../src/modules/teams/teams.service.js';
import { ParticipantsService } from '../src/modules/teams/participants.service.js';
import { TournamentsService } from '../src/modules/fixtures/tournaments.service.js';
import { MatchesService } from '../src/modules/fixtures/matches.service.js';
import { encryptField, blindIndex } from '../src/common/crypto/field-crypto.js';

/**
 * Proves the three volunteer-workflow requirements against the REAL database
 * (not mocks): a department Head sees only their own department's roster and
 * tasks; a plain volunteer sees only the tasks assigned specifically to them,
 * never their whole department's; and the Hospitality "expected audience per
 * venue" projection is computed correctly from real fixtures/team rosters.
 */
describe('Volunteer department isolation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let rbac: RbacService;
  let volunteersSvc: VolunteersService;
  let opsTasksSvc: OperationsTasksService;
  let dashboardSvc: DashboardService;
  let eventsSvc: EventsService;
  let sportsSvc: SportsService;
  let venuesSvc: VenuesService;
  let institutesSvc: InstitutesService;
  let teamsSvc: TeamsService;
  let participantsSvc: ParticipantsService;
  let tournamentsSvc: TournamentsService;
  let matchesSvc: MatchesService;

  let eventId: string | undefined;
  const userIds: string[] = [];
  const volunteerIds: string[] = [];
  const taskIds: string[] = [];

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = moduleFixture.get(PrismaService);
    rbac = moduleFixture.get(RbacService);
    volunteersSvc = moduleFixture.get(VolunteersService);
    opsTasksSvc = moduleFixture.get(OperationsTasksService);
    dashboardSvc = moduleFixture.get(DashboardService);
    eventsSvc = moduleFixture.get(EventsService);
    sportsSvc = moduleFixture.get(SportsService);
    venuesSvc = moduleFixture.get(VenuesService);
    institutesSvc = moduleFixture.get(InstitutesService);
    teamsSvc = moduleFixture.get(TeamsService);
    participantsSvc = moduleFixture.get(ParticipantsService);
    tournamentsSvc = moduleFixture.get(TournamentsService);
    matchesSvc = moduleFixture.get(MatchesService);
  });

  afterAll(async () => {
    for (const id of taskIds)
      await prisma.operationsTask.delete({ where: { id } }).catch(() => {});
    for (const id of volunteerIds)
      await prisma.volunteer.delete({ where: { id } }).catch(() => {});
    if (eventId)
      await prisma.event.delete({ where: { id: eventId } }).catch(() => {});
    for (const id of userIds)
      await prisma.user.delete({ where: { id } }).catch(() => {});
    await app.close();
  });

  async function makeUser(name: string) {
    const email = `e2e-vol-iso-${randomUUID()}@convoquer.test`;
    const user = await prisma.user.create({
      data: {
        email: encryptField(email)!,
        emailHash: blindIndex(email)!,
        name,
        googleSubjectId: randomUUID(),
      },
    });
    userIds.push(user.id);
    return user.id;
  }

  it('scopes rosters and tasks per department, and projects venue audience from real fixtures', async () => {
    const convenerId = await makeUser('E2E Convener');
    await rbac.assignRole(null, convenerId, 'CONVENER');

    const event = await eventsSvc.createEvent(
      {
        name: 'E2E Volunteer Isolation Fest',
        slug: `e2e-vol-iso-${randomUUID()}`,
        edition: '2099',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 86_400_000).toISOString(),
      } as any,
      convenerId,
    );
    eventId = event.id;

    const venue = await venuesSvc.createVenue({
      eventId,
      name: 'E2E Isolation Arena',
    } as any);
    const sport = await sportsSvc.createSport({
      eventId,
      name: 'Cricket',
    } as any);
    const instA = await institutesSvc.createInstitute({
      eventId,
      name: `E2E Inst A ${randomUUID().slice(0, 4)}`,
    } as any);
    const instB = await institutesSvc.createInstitute({
      eventId,
      name: `E2E Inst B ${randomUUID().slice(0, 4)}`,
    } as any);
    const teamA = await teamsSvc.createTeam({
      eventId,
      instituteId: instA.id,
      sportId: sport.id,
      name: 'E2E Team A',
    } as any);
    const teamB = await teamsSvc.createTeam({
      eventId,
      instituteId: instB.id,
      sportId: sport.id,
      name: 'E2E Team B',
    } as any);

    // Team A has 2 participants, Team B has 1 — expected audience must count 3 distinct people.
    const p1 = await participantsSvc.createParticipant({
      eventId,
      instituteId: instA.id,
      name: 'P1',
      category: 'ATHLETE',
    } as any);
    const p2 = await participantsSvc.createParticipant({
      eventId,
      instituteId: instA.id,
      name: 'P2',
      category: 'ATHLETE',
    } as any);
    const p3 = await participantsSvc.createParticipant({
      eventId,
      instituteId: instB.id,
      name: 'P3',
      category: 'ATHLETE',
    } as any);
    await teamsSvc.addMember(teamA.id, { participantId: p1.id } as any);
    await teamsSvc.addMember(teamA.id, { participantId: p2.id } as any);
    await teamsSvc.addMember(teamB.id, { participantId: p3.id } as any);

    const tournament = await tournamentsSvc.createTournament(
      {
        eventId,
        sportId: sport.id,
        name: 'E2E Cup',
        format: 'KNOCKOUT',
      } as any,
      convenerId,
    );
    await matchesSvc.generateKnockoutBracket(
      tournament.id,
      {
        teamIds: [teamA.id, teamB.id],
        defaultVenueId: venue.id,
        startTime: new Date(Date.now() + 3_600_000).toISOString(),
        matchDurationMinutes: 180,
        simultaneousMatches: 1,
      } as any,
      convenerId,
    );

    // Two department Heads, each managing only their own department.
    const hospHeadId = await makeUser('E2E Hospitality & Security Head');
    await rbac.assignRole(null, hospHeadId, 'HOSPITALITY_SECURITY_HEAD');
    const mediaHeadId = await makeUser('E2E Media Head');
    await rbac.assignRole(null, mediaHeadId, 'MEDIA_HEAD');

    // A plain volunteer in Hospitality & Security, linked to a real login account.
    const hospVolUserId = await makeUser(
      'E2E Hospitality & Security Volunteer',
    );
    await rbac.assignRole(null, hospVolUserId, 'VOLUNTEER');
    const hospVolunteer = await prisma.volunteer.create({
      data: {
        volunteerCode: `VOL-${randomUUID()}`,
        name: 'E2E Hosp Vol',
        email: `e2e-hv-${randomUUID()}@convoquer.test`,
        department: 'Hospitality & Security',
        userId: hospVolUserId,
      },
    });
    volunteerIds.push(hospVolunteer.id);

    // A Media volunteer with no linked login — exists purely to prove Hospitality & Security's Head can't see it.
    const mediaVolunteer = await prisma.volunteer.create({
      data: {
        volunteerCode: `VOL-${randomUUID()}`,
        name: 'E2E Media Vol',
        email: `e2e-mv-${randomUUID()}@convoquer.test`,
        department: 'Media',
      },
    });
    volunteerIds.push(mediaVolunteer.id);

    // Tasks: one department-wide Hospitality & Security task, one addressed specifically to
    // the Hospitality & Security volunteer, and one Media task — Requirement 3 hinges on the
    // plain volunteer NOT seeing the department-wide one.
    const deptWideTask = await opsTasksSvc.createTask(
      { title: 'Set up refreshments', department: 'Hospitality & Security' },
      hospHeadId,
    );
    taskIds.push(deptWideTask.id);
    const myTask = await opsTasksSvc.createTask(
      { title: 'Escort VIP guest', assigneeIds: [hospVolunteer.id] },
      hospHeadId,
    );
    taskIds.push(myTask.id);
    const mediaTask = await opsTasksSvc.createTask(
      { title: 'Photo coverage', department: 'Media' },
      mediaHeadId,
    );
    taskIds.push(mediaTask.id);

    // --- Requirement 2: roster visibility is Head-scoped to their own department only ---
    const hospRoster = await volunteersSvc.getRosterForUser(hospHeadId);
    expect(hospRoster.map((v) => v.id)).toContain(hospVolunteer.id);
    expect(hospRoster.map((v) => v.id)).not.toContain(mediaVolunteer.id);

    const mediaRoster = await volunteersSvc.getRosterForUser(mediaHeadId);
    expect(mediaRoster.map((v) => v.id)).toContain(mediaVolunteer.id);
    expect(mediaRoster.map((v) => v.id)).not.toContain(hospVolunteer.id);

    // A plain volunteer gets no roster at all (never their department peers) — and the
    // controller layer would 403 them (neither permission granted), not silently 200.
    const plainVolRoster = await volunteersSvc.getRosterForUser(hospVolUserId);
    expect(plainVolRoster).toEqual([]);
    expect(await rbac.hasPermission(hospVolUserId, 'volunteer.manage')).toBe(
      false,
    );
    expect(
      await rbac.hasPermission(hospVolUserId, 'volunteer.view.department'),
    ).toBe(false);
    expect(
      await rbac.hasPermission(hospHeadId, 'volunteer.view.department'),
    ).toBe(true);

    // --- Requirement 3: a plain volunteer sees only tasks assigned specifically to them ---
    // OperationsTask has no eventId scoping (it's a global table), so assertions use
    // containment/exclusion rather than exact-set equality to stay robust to any other
    // task rows that may exist in the table.
    const hospHeadTaskIds = (await opsTasksSvc.getTasks(hospHeadId)).map(
      (t) => t.id,
    );
    expect(hospHeadTaskIds).toEqual(
      expect.arrayContaining([deptWideTask.id, myTask.id]),
    );
    expect(hospHeadTaskIds).not.toContain(mediaTask.id);

    const mediaHeadTaskIds = (await opsTasksSvc.getTasks(mediaHeadId)).map(
      (t) => t.id,
    );
    expect(mediaHeadTaskIds).toContain(mediaTask.id);
    expect(mediaHeadTaskIds).not.toContain(deptWideTask.id);
    expect(mediaHeadTaskIds).not.toContain(myTask.id);

    const plainVolTaskIds = (await opsTasksSvc.getTasks(hospVolUserId)).map(
      (t) => t.id,
    );
    expect(plainVolTaskIds).toEqual([myTask.id]); // NOT deptWideTask — this is the core Requirement 3 proof

    // A plain volunteer can't be handed the task-assignment picker either — assigning is a Head action.
    expect(await opsTasksSvc.getAssignableVolunteers(hospVolUserId)).toEqual(
      [],
    );

    // --- Hospitality & Security: expected audience per venue, from the real fixture + roster we built ---
    const projection = await dashboardSvc.getVenueAudienceProjection(eventId);
    const ourVenue = projection.venues.find((v) => v.venueId === venue.id)!;
    expect(ourVenue).toBeDefined();
    expect(ourVenue.matches).toHaveLength(1);
    expect(ourVenue.expectedAudience).toBe(3); // p1, p2, p3 — distinct across both teams
  }, 30000);
});
