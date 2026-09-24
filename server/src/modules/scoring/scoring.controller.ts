import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ScoringService } from './scoring.service.js';
import { SessionGuard } from '../../common/guards/session.guard.js';
import {
  StartMatchDto,
  PauseMatchDto,
  ResumeMatchDto,
  EndMatchDto,
  RecordScoreEventDto,
  ReverseScoreEventDto,
  UpdateScoreManualDto,
} from './dto/scoring.dto.js';

// Deliberately no PermissionsGuard/@RequirePermissions here: these routes
// address an existing match by :id with no sportId/eventId in params, query,
// or body, so PermissionsGuard's scope-derivation would resolve to an empty
// scope and require a *global* score.update grant — locking out every
// sport-scoped coordinator and, worse, every match-assigned official (who
// may hold no RBAC permission at all, relying solely on their assignment).
// ScoringService.verifyScoringAuthority() is the real check: it loads the
// match, derives its actual sportId/eventId, and authorizes either a
// correctly-scoped RBAC grant or an assigned official for that specific
// match — see that method for the full authority model.
@Controller('api/matches')
export class ScoringController {
  constructor(private readonly scoringService: ScoringService) {}

  // ===================================
  // MATCH LIFECYCLE
  // ===================================

  @Post(':id/start')
  @UseGuards(SessionGuard)
  async startMatch(
    @Param('id') matchId: string,
    @Body() dto: StartMatchDto,
    @Req() req: Request,
  ) {
    const userId = (req as any).user.id;
    const ipAddress = req.ip;
    return this.scoringService.startMatch(matchId, dto, userId, ipAddress);
  }

  @Post(':id/pause')
  @UseGuards(SessionGuard)
  async pauseMatch(
    @Param('id') matchId: string,
    @Body() dto: PauseMatchDto,
    @Req() req: Request,
  ) {
    const userId = (req as any).user.id;
    const ipAddress = req.ip;
    return this.scoringService.pauseMatch(matchId, dto, userId, ipAddress);
  }

  @Post(':id/resume')
  @UseGuards(SessionGuard)
  async resumeMatch(
    @Param('id') matchId: string,
    @Body() dto: ResumeMatchDto,
    @Req() req: Request,
  ) {
    const userId = (req as any).user.id;
    const ipAddress = req.ip;
    return this.scoringService.resumeMatch(matchId, dto, userId, ipAddress);
  }

  @Post(':id/end')
  @UseGuards(SessionGuard)
  async endMatch(
    @Param('id') matchId: string,
    @Body() dto: EndMatchDto,
    @Req() req: Request,
  ) {
    const userId = (req as any).user.id;
    const ipAddress = req.ip;
    return this.scoringService.endMatch(matchId, dto, userId, ipAddress);
  }

  // ===================================
  // REAL-TIME SCORE EVENTS & CORRECTIONS
  // ===================================

  @Post(':id/score-events')
  @UseGuards(SessionGuard)
  async recordScoreEvent(
    @Param('id') matchId: string,
    @Body() dto: RecordScoreEventDto,
    @Req() req: Request,
  ) {
    const userId = (req as any).user.id;
    const ipAddress = req.ip;
    return this.scoringService.recordScoreEvent(
      matchId,
      dto,
      userId,
      ipAddress,
    );
  }

  @Post(':id/score-events/:eventId/reverse')
  @UseGuards(SessionGuard)
  async reverseScoreEvent(
    @Param('id') matchId: string,
    @Param('eventId') eventId: string,
    @Body() dto: ReverseScoreEventDto,
    @Req() req: Request,
  ) {
    const userId = (req as any).user.id;
    const ipAddress = req.ip;
    return this.scoringService.reverseScoreEvent(
      matchId,
      eventId,
      dto,
      userId,
      ipAddress,
    );
  }

  @Patch(':id/score-manual')
  @UseGuards(SessionGuard)
  async updateScoreManual(
    @Param('id') matchId: string,
    @Body() dto: UpdateScoreManualDto,
    @Req() req: Request,
  ) {
    const userId = (req as any).user.id;
    const ipAddress = req.ip;
    return this.scoringService.updateScoreManual(
      matchId,
      dto,
      userId,
      ipAddress,
    );
  }

  // ===================================
  // PUBLIC MATCH FEEDS
  // ===================================

  @Get(':id/score-events')
  async getScoreEvents(@Param('id') matchId: string) {
    return this.scoringService.getScoreEvents(matchId);
  }

  @Get(':id/live')
  async getLiveMatch(@Param('id') matchId: string) {
    return this.scoringService.getLiveMatch(matchId);
  }
}
