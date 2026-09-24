import { describe, it, expect, beforeEach } from 'vitest';
import { RealtimeService } from './realtime.service.js';
import { REALTIME_EVENTS } from './dto/realtime.dto.js';
import { firstValueFrom, take, toArray } from 'rxjs';

describe('RealtimeService & Event Bus', () => {
  let realtimeService: RealtimeService;

  beforeEach(() => {
    realtimeService = new RealtimeService();
  });

  it('should deliver match score updates to match-specific subscribers', async () => {
    const subscriberPromise = firstValueFrom(
      realtimeService
        .subscribeToTopic('matches:match-123', 60000)
        .pipe(take(1)),
    );

    // Emit event
    realtimeService.emitMatchScoreUpdated('match-123', {
      matchId: 'match-123',
      teamAScore: 2,
      teamBScore: 1,
    });

    const received = await subscriberPromise;
    expect(received.type).toBe(REALTIME_EVENTS.MATCH_SCORE_UPDATED);
    expect(received.data.matchId).toBe('match-123');
    expect(received.data.teamAScore).toBe(2);
  });

  it('should isolate match topics so unrelated match subscribers do not receive them', async () => {
    const receivedEvents: any[] = [];

    const sub = realtimeService
      .subscribeToTopic('matches:match-A', 60000)
      .subscribe((msg) => receivedEvents.push(msg));

    // Emit on match-B
    realtimeService.emitMatchScoreUpdated('match-B', {
      matchId: 'match-B',
      teamAScore: 5,
    });

    // Short wait
    await new Promise((r) => setTimeout(r, 20));
    sub.unsubscribe();

    expect(receivedEvents).toHaveLength(0);
  });

  it('should broadcast live score and status events to global public:live ticker', async () => {
    const subscriberPromise = firstValueFrom(
      realtimeService
        .subscribeToTopic('public:live', 60000)
        .pipe(take(2), toArray()),
    );

    realtimeService.emitMatchStatusUpdated('match-1', {
      status: 'LIVE',
      period: '1st Half',
    });

    realtimeService.emitMatchScoreUpdated('match-1', {
      teamAScore: 1,
      teamBScore: 0,
    });

    const received = await subscriberPromise;
    expect(received).toHaveLength(2);
    expect(received[0].type).toBe(REALTIME_EVENTS.MATCH_STATUS_UPDATED);
    expect(received[1].type).toBe(REALTIME_EVENTS.MATCH_SCORE_UPDATED);
  });

  it('should route result.submitted events to organizer topic', async () => {
    const subscriberPromise = firstValueFrom(
      realtimeService.subscribeToTopic('organizer', 60000).pipe(take(1)),
    );

    realtimeService.emitResultSubmitted({
      matchId: 'match-99',
      submittedBy: 'user-referee',
      finalScoreA: 3,
      finalScoreB: 2,
    });

    const received = await subscriberPromise;
    expect(received.type).toBe(REALTIME_EVENTS.RESULT_SUBMITTED);
    expect(received.data.matchId).toBe('match-99');
  });

  it('should broadcast tournament standings and published result events', async () => {
    const subscriberPromise = firstValueFrom(
      realtimeService
        .subscribeToTopic('tournaments:tourn-1', 60000)
        .pipe(take(2), toArray()),
    );

    realtimeService.emitResultPublished('tourn-1', 'm-1', {
      resultId: 'res-1',
      winnerTeamId: 'team-a',
    });

    realtimeService.emitStandingsUpdated('tourn-1', {
      tournamentId: 'tourn-1',
    });

    const received = await subscriberPromise;
    expect(received).toHaveLength(2);
    expect(received[0].type).toBe(REALTIME_EVENTS.RESULT_PUBLISHED);
    expect(received[1].type).toBe(REALTIME_EVENTS.STANDINGS_UPDATED);
  });

  it('should support subscribing to multiple topics simultaneously', async () => {
    const subscriberPromise = firstValueFrom(
      realtimeService
        .subscribeToTopics(['matches:m-1', 'matches:m-2'], 60000)
        .pipe(take(2), toArray()),
    );

    realtimeService.emitMatchScoreUpdated('m-1', { score: 1 });
    realtimeService.emitMatchScoreUpdated('m-2', { score: 2 });

    const received = await subscriberPromise;
    expect(received).toHaveLength(2);
  });
});
