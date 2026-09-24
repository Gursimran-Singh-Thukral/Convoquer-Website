import { randomUUID } from 'crypto';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { RbacService } from '../src/modules/rbac/rbac.service.js';
import { EventsService } from '../src/modules/competition/events.service.js';
import { SportsService } from '../src/modules/competition/sports.service.js';
import { VenuesService } from '../src/modules/competition/venues.service.js';
import { InstitutesService } from '../src/modules/teams/institutes.service.js';
import { TeamsService } from '../src/modules/teams/teams.service.js';
import { TournamentsService } from '../src/modules/fixtures/tournaments.service.js';
import { MatchesService } from '../src/modules/fixtures/matches.service.js';
import { ScoringService } from '../src/modules/scoring/scoring.service.js';
import { ResultsService } from '../src/modules/results/results.service.js';
import { encryptField, blindIndex } from '../src/common/crypto/field-crypto.js';

/**
 * "Run a sample event with events happening simultaneously and at different
 * locations" — this exercises the full organizer workflow against the real
 * database: generate two complete knockout brackets in two different sports
 * (Cricket, Badminton) at two different venues in one call each, then run one
 * match from each bracket LIVE at the same time, interleaving score events
 * between them the way two independent scorekeepers at two venues actually
 * would, through to a published result and correct bracket advancement.
 *
 * Judged the way an organizer would judge it: did generating the whole round
 * take one action, did each match end up independently and correctly scored
 * with no bleed between them, and did the winner get placed in the right
 * next-round slot without anyone touching it by hand.
 */
describe('Sample event simulation (e2e): concurrent matches, different sports, different venues', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let rbac: RbacService;
  let eventsSvc: EventsService;
  let sportsSvc: SportsService;
  let venuesSvc: VenuesService;
  let institutesSvc: InstitutesService;
  let teamsSvc: TeamsService;
  let tournamentsSvc: TournamentsService;
  let matchesSvc: MatchesService;
  let scoring: ScoringService;
  let results: ResultsService;

  let userId: string;
  let eventId: string | undefined;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = moduleFixture.get(PrismaService);
    rbac = moduleFixture.get(RbacService);
    eventsSvc = moduleFixture.get(EventsService);
    sportsSvc = moduleFixture.get(SportsService);
    venuesSvc = moduleFixture.get(VenuesService);
    institutesSvc = moduleFixture.get(InstitutesService);
    teamsSvc = moduleFixture.get(TeamsService);
    tournamentsSvc = moduleFixture.get(TournamentsService);
    matchesSvc = moduleFixture.get(MatchesService);
    scoring = moduleFixture.get(ScoringService);
    results = moduleFixture.get(ResultsService);

    const email = `e2e-sample-event-${randomUUID()}@convoquer.test`;
    const user = await prisma.user.create({
      data: {
        email: encryptField(email)!,
        emailHash: blindIndex(email)!,
        name: 'E2E Sample Event Convener',
        googleSubjectId: randomUUID(),
      },
    });
    userId = user.id;
    await rbac.assignRole(null, userId, 'CONVENER');
  });

  afterAll(async () => {
    if (eventId)
      await prisma.event.delete({ where: { id: eventId } }).catch(() => {});
    if (userId)
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    await app.close();
  });

  it('generates two full knockout brackets in one call each and runs one match from each concurrently at two venues', async () => {
    const event = await eventsSvc.createEvent(
      {
        name: 'E2E Sample Fest',
        slug: `e2e-sample-${randomUUID()}`,
        edition: '2099',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 86_400_000).toISOString(),
      } as any,
      userId,
    );
    eventId = event.id;

    const cricketVenue = await venuesSvc.createVenue({
      eventId,
      name: 'E2E Cricket Ground',
    } as any);
    const badmintonVenue = await venuesSvc.createVenue({
      eventId,
      name: 'E2E Badminton Court',
      simultaneousMatches: 4,
    } as any);
    const cricketSport = await sportsSvc.createSport({
      eventId,
      name: 'Cricket',
    } as any);
    const badmintonSport = await sportsSvc.createSport({
      eventId,
      name: 'Badminton',
    } as any);

    async function makeTeams(sportId: string, prefix: string, n: number) {
      const list = [];
      for (let i = 0; i < n; i++) {
        const inst = await institutesSvc.createInstitute({
          eventId,
          name: `${prefix} Institute ${i + 1} ${randomUUID().slice(0, 4)}`,
        } as any);
        list.push(
          await teamsSvc.createTeam({
            eventId,
            instituteId: inst.id,
            sportId,
            name: `${prefix} Team ${i + 1}`,
          } as any),
        );
      }
      return list;
    }
    const cricketTeams = await makeTeams(cricketSport.id, 'Cricket', 8);
    const badmintonTeams = await makeTeams(badmintonSport.id, 'Badminton', 8);

    // Small, fast formats via the per-tournament rulesJson override (1-over
    // cricket innings; a single 3-point badminton game) — same engine, same
    // rules, just quick enough for a test.
    const cricketTournament = await tournamentsSvc.createTournament(
      {
        eventId,
        sportId: cricketSport.id,
        name: 'E2E Cricket Cup',
        format: 'KNOCKOUT',
        rulesJson: { cricket: { oversPerInnings: 1 } },
      } as any,
      userId,
    );
    const badmintonTournament = await tournamentsSvc.createTournament(
      {
        eventId,
        sportId: badmintonSport.id,
        name: 'E2E Badminton Cup',
        format: 'KNOCKOUT',
        rulesJson: { badminton: { pointsPerGame: 3, bestOfGames: 1 } },
      } as any,
      userId,
    );

    const startTime = new Date(Date.now() + 3_600_000).toISOString();

    // Generate the ENTIRE knockout bracket for each tournament in one call —
    // this is the "ask for the whole tournament structure and generate all
    // fixtures at once" behaviour the fixture engine already provides.
    await matchesSvc.generateKnockoutBracket(
      cricketTournament.id,
      {
        teamIds: cricketTeams.map((t) => t.id),
        defaultVenueId: cricketVenue.id,
        startTime,
        matchDurationMinutes: 180,
        simultaneousMatches: 1,
      } as any,
      userId,
    );
    await matchesSvc.generateKnockoutBracket(
      badmintonTournament.id,
      {
        teamIds: badmintonTeams.map((t) => t.id),
        defaultVenueId: badmintonVenue.id,
        startTime,
        matchDurationMinutes: 30,
        simultaneousMatches: 4,
      } as any,
      userId,
    );

    const cricketMatches = await prisma.match.findMany({
      where: { tournamentId: cricketTournament.id },
    });
    const badmintonMatches = await prisma.match.findMany({
      where: { tournamentId: badmintonTournament.id },
    });

    // 8 teams -> Quarterfinals(4) + Semifinals(2) + Final(1) = 7 matches, generated in one call.
    expect(cricketMatches).toHaveLength(7);
    expect(badmintonMatches).toHaveLength(7);
    expect(cricketMatches.filter((m) => m.teamAId && m.teamBId)).toHaveLength(
      4,
    ); // no byes with 8 clean seeds
    expect(badmintonMatches.filter((m) => m.teamAId && m.teamBId)).toHaveLength(
      4,
    );
    // Every QF is wired to feed a real semifinal via a genuine FK, not a string placeholder.
    for (const qf of cricketMatches.filter((m) =>
      m.matchNumber?.startsWith('R1-'),
    )) {
      expect(qf.nextMatchId).toBeTruthy();
      expect(['A', 'B']).toContain(qf.nextMatchSlot);
    }

    const cricketQF1 = cricketMatches.find((m) => m.matchNumber === 'R1-M1')!;
    const badmintonQF1 = badmintonMatches.find(
      (m) => m.matchNumber === 'R1-M1',
    )!;
    expect(cricketQF1.venueId).toBe(cricketVenue.id);
    expect(badmintonQF1.venueId).toBe(badmintonVenue.id);

    // Start both matches LIVE — same moment, two different sports, two different venues.
    await scoring.startMatch(cricketQF1.id, {}, userId);
    await scoring.startMatch(badmintonQF1.id, {}, userId);

    // Interleave score events between the two matches, the way two independent
    // scorekeepers at two venues actually would — proves per-match state
    // never bleeds into the other match.
    await scoring.recordScoreEvent(
      cricketQF1.id,
      {
        eventType: 'START_INNINGS',
        metadata: { battingTeamId: cricketQF1.teamAId },
      },
      userId,
    );
    await scoring.recordScoreEvent(
      badmintonQF1.id,
      { eventType: 'POINT', teamId: badmintonQF1.teamAId! },
      userId,
    );
    for (let i = 0; i < 6; i++) {
      await scoring.recordScoreEvent(
        cricketQF1.id,
        {
          eventType: 'RUN',
          teamId: cricketQF1.teamAId!,
          metadata: { runs: 4 },
        },
        userId,
      ); // 24 off 6 balls, innings 1 complete
    }
    await scoring.recordScoreEvent(
      badmintonQF1.id,
      { eventType: 'POINT', teamId: badmintonQF1.teamAId! },
      userId,
    );
    await scoring.recordScoreEvent(
      badmintonQF1.id,
      { eventType: 'POINT', teamId: badmintonQF1.teamAId! },
      userId,
    ); // 3-0 — badminton QF decided

    await scoring.recordScoreEvent(
      cricketQF1.id,
      {
        eventType: 'START_INNINGS',
        metadata: { battingTeamId: cricketQF1.teamBId },
      },
      userId,
    );
    for (let i = 0; i < 6; i++) {
      await scoring.recordScoreEvent(
        cricketQF1.id,
        {
          eventType: 'RUN',
          teamId: cricketQF1.teamBId!,
          metadata: { runs: 1 },
        },
        userId,
      ); // 6 off 6 balls, chase falls well short
    }

    const liveCricket = await prisma.match.findUnique({
      where: { id: cricketQF1.id },
    });
    const liveBadminton = await prisma.match.findUnique({
      where: { id: badmintonQF1.id },
    });
    expect(liveCricket!.winnerTeamId).toBe(cricketQF1.teamAId); // defended 24, chase fell short at 6
    expect(liveBadminton!.winnerTeamId).toBe(badmintonQF1.teamAId);
    // No cross-match bleed: each match's structured scoreDetails only has its own sport's shape.
    expect((liveCricket!.scoreDetails as any).innings).toBeDefined();
    expect((liveCricket!.scoreDetails as any).games).toBeUndefined();
    expect((liveBadminton!.scoreDetails as any).games).toBeDefined();
    expect((liveBadminton!.scoreDetails as any).innings).toBeUndefined();

    // End both — this auto-submits each result — then approve both.
    await scoring.endMatch(cricketQF1.id, {}, userId);
    await scoring.endMatch(badmintonQF1.id, {}, userId);

    const cricketResult = await prisma.result.findUnique({
      where: { matchId: cricketQF1.id },
    });
    const badmintonResult = await prisma.result.findUnique({
      where: { matchId: badmintonQF1.id },
    });
    expect(cricketResult?.status).toBe('SUBMITTED');
    expect(badmintonResult?.status).toBe('SUBMITTED');

    await results.approveResult(cricketResult!.id, {}, userId);
    await results.approveResult(badmintonResult!.id, {}, userId);

    // Bracket advancement: the winner of each QF must now occupy the correct
    // slot in its semifinal — and only that slot, in only that bracket.
    const cricketSF = await prisma.match.findUnique({
      where: { id: cricketQF1.nextMatchId! },
    });
    const badmintonSF = await prisma.match.findUnique({
      where: { id: badmintonQF1.nextMatchId! },
    });
    const cricketSlotField =
      cricketQF1.nextMatchSlot === 'A' ? 'teamAId' : 'teamBId';
    const badmintonSlotField =
      badmintonQF1.nextMatchSlot === 'A' ? 'teamAId' : 'teamBId';
    expect((cricketSF as any)[cricketSlotField]).toBe(cricketQF1.teamAId);
    expect((badmintonSF as any)[badmintonSlotField]).toBe(badmintonQF1.teamAId);
    // The two brackets never touch each other's semifinal.
    expect(cricketSF!.tournamentId).toBe(cricketTournament.id);
    expect(badmintonSF!.tournamentId).toBe(badmintonTournament.id);
  }, 60_000);
});
