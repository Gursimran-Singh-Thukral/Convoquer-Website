import { Injectable } from '@nestjs/common';
import { Subject, Observable, merge, interval } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import {
  REALTIME_EVENTS,
  RealtimeEnvelope,
  SseMessage,
} from './dto/realtime.dto.js';

@Injectable()
export class RealtimeService {
  private readonly bus$ = new Subject<RealtimeEnvelope>();

  /**
   * Raw broadcast to the event bus.
   */
  emit(topic: string, event: string, data: any) {
    this.bus$.next({
      topic,
      event,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  // ===================================
  // DOMAIN-SPECIFIC EMITTERS
  // ===================================

  emitMatchScoreUpdated(matchId: string, payload: any) {
    this.emit(
      `matches:${matchId}`,
      REALTIME_EVENTS.MATCH_SCORE_UPDATED,
      payload,
    );
    this.emit('public:live', REALTIME_EVENTS.MATCH_SCORE_UPDATED, payload);
  }

  emitMatchStatusUpdated(matchId: string, payload: any) {
    this.emit(
      `matches:${matchId}`,
      REALTIME_EVENTS.MATCH_STATUS_UPDATED,
      payload,
    );
    this.emit('public:live', REALTIME_EVENTS.MATCH_STATUS_UPDATED, payload);
  }

  emitResultSubmitted(payload: any) {
    this.emit('organizer', REALTIME_EVENTS.RESULT_SUBMITTED, payload);
  }

  emitResultPublished(tournamentId: string, matchId: string, payload: any) {
    this.emit(`matches:${matchId}`, REALTIME_EVENTS.RESULT_PUBLISHED, payload);
    this.emit(
      `tournaments:${tournamentId}`,
      REALTIME_EVENTS.RESULT_PUBLISHED,
      payload,
    );
    this.emit('public:live', REALTIME_EVENTS.RESULT_PUBLISHED, payload);
  }

  emitStandingsUpdated(tournamentId: string, payload: any) {
    this.emit(
      `tournaments:${tournamentId}`,
      REALTIME_EVENTS.STANDINGS_UPDATED,
      payload,
    );
  }

  // ===================================
  // OBSERVABLE SUBSCRIPTIONS & SSE ADAPTER
  // ===================================

  /**
   * Subscribes to a specific topic, converting internal envelopes to SSE messages.
   * Includes keep-alive heartbeat signals to maintain active connection through proxies.
   */
  subscribeToTopic(topic: string, heartbeatMs = 25000): Observable<SseMessage> {
    const topicEvents$ = this.bus$.pipe(
      filter((env) => env.topic === topic),
      map((env) => ({
        type: env.event,
        data: env.data,
      })),
    );

    const heartbeats$ = interval(heartbeatMs).pipe(
      map(() => ({
        type: REALTIME_EVENTS.HEARTBEAT,
        data: { ping: true, timestamp: new Date().toISOString() },
      })),
    );

    return merge(topicEvents$, heartbeats$);
  }

  /**
   * Subscribes to multiple topics simultaneously.
   */
  subscribeToTopics(
    topics: string[],
    heartbeatMs = 25000,
  ): Observable<SseMessage> {
    const topicEvents$ = this.bus$.pipe(
      filter((env) => topics.includes(env.topic)),
      map((env) => ({
        type: env.event,
        data: env.data,
      })),
    );

    const heartbeats$ = interval(heartbeatMs).pipe(
      map(() => ({
        type: REALTIME_EVENTS.HEARTBEAT,
        data: { ping: true, timestamp: new Date().toISOString() },
      })),
    );

    return merge(topicEvents$, heartbeats$);
  }
}
