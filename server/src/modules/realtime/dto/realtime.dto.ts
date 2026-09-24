export const REALTIME_EVENTS = {
  MATCH_SCORE_UPDATED: 'match.score.updated',
  MATCH_STATUS_UPDATED: 'match.status.updated',
  RESULT_SUBMITTED: 'result.submitted',
  RESULT_PUBLISHED: 'result.published',
  STANDINGS_UPDATED: 'standings.updated',
  HEARTBEAT: 'system.heartbeat',
} as const;

export type RealtimeEventType =
  (typeof REALTIME_EVENTS)[keyof typeof REALTIME_EVENTS];

export interface RealtimeEnvelope<T = any> {
  topic: string; // e.g. 'matches:uuid', 'public:live', 'tournaments:uuid', 'organizer'
  event: RealtimeEventType | string;
  data: T;
  timestamp: string;
}

export interface SseMessage {
  data: any;
  id?: string;
  type?: string;
  retry?: number;
}
