import { Controller, Sse, Param, UseGuards } from '@nestjs/common';
import { Observable } from 'rxjs';
import { RealtimeService } from './realtime.service.js';
import { SseMessage } from './dto/realtime.dto.js';
import { SessionGuard } from '../../common/guards/session.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator.js';

@Controller('api/realtime')
export class RealtimeController {
  constructor(private readonly realtimeService: RealtimeService) {}

  /**
   * Public SSE stream for a specific match (live scores, period, cards, overs, clock).
   */
  @Sse('matches/:id')
  streamMatch(@Param('id') matchId: string): Observable<SseMessage> {
    return this.realtimeService.subscribeToTopic(`matches:${matchId}`);
  }

  /**
   * Public global live ticker stream aggregating all active matches.
   */
  @Sse('live')
  streamLiveMatches(): Observable<SseMessage> {
    return this.realtimeService.subscribeToTopic('public:live');
  }

  /**
   * Public SSE stream for tournament-level updates (standings, bracket advancement).
   */
  @Sse('tournaments/:id')
  streamTournament(@Param('id') tournamentId: string): Observable<SseMessage> {
    return this.realtimeService.subscribeToTopic(`tournaments:${tournamentId}`);
  }

  /**
   * Authenticated SSE stream for organizers (pending approvals, coordinator alerts).
   */
  @Sse('organizer')
  @UseGuards(SessionGuard, PermissionsGuard)
  @RequirePermissions('result.approve')
  streamOrganizerEvents(): Observable<SseMessage> {
    return this.realtimeService.subscribeToTopic('organizer');
  }
}
