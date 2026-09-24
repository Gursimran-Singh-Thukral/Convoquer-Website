import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ResultsService } from './results.service.js';
import { StandingsService } from './standings.service.js';
import { MedalsService } from './medals.service.js';
import { SessionGuard } from '../../common/guards/session.guard.js';
import {
  SubmitResultDto,
  ApproveResultDto,
  RejectResultDto,
  OverrideResultDto,
  AwardMedalDto,
} from './dto/results.dto.js';

// Deliberately no PermissionsGuard/@RequirePermissions on the mutating routes
// below: they address a result/medal by :id or by sportId/eventId in the
// body, and authority depends on which sport/event that record actually
// belongs to — not something PermissionsGuard's static decorator can derive.
// ResultsService.verifyResultAuthority() / MedalsService.awardMedal() are the
// real checks: they load the record, derive its actual sportId/eventId, and
// authorize a correctly-scoped 'result.approve'/'result.override' grant (or,
// for submitResult, an assigned match official). Mirrors
// ScoringService.verifyScoringAuthority.
@Controller('api')
export class ResultsController {
  constructor(
    private readonly resultsService: ResultsService,
    private readonly standingsService: StandingsService,
    private readonly medalsService: MedalsService,
  ) {}

  // ===================================
  // RESULTS WORKFLOW
  // ===================================

  @Post('matches/:id/result')
  @UseGuards(SessionGuard)
  async submitResult(
    @Param('id') matchId: string,
    @Body() dto: SubmitResultDto,
    @Req() req: Request,
  ) {
    const userId = (req as any).user.id;
    const ipAddress = req.ip;
    return this.resultsService.submitResult(matchId, dto, userId, ipAddress);
  }

  @Patch('results/:id/approve')
  @UseGuards(SessionGuard)
  async approveResult(
    @Param('id') resultId: string,
    @Body() dto: ApproveResultDto,
    @Req() req: Request,
  ) {
    const userId = (req as any).user.id;
    const ipAddress = req.ip;
    return this.resultsService.approveResult(resultId, dto, userId, ipAddress);
  }

  @Patch('results/:id/reject')
  @UseGuards(SessionGuard)
  async rejectResult(
    @Param('id') resultId: string,
    @Body() dto: RejectResultDto,
    @Req() req: Request,
  ) {
    const userId = (req as any).user.id;
    const ipAddress = req.ip;
    return this.resultsService.rejectResult(resultId, dto, userId, ipAddress);
  }

  @Patch('results/:id/override')
  @UseGuards(SessionGuard)
  async overrideResult(
    @Param('id') resultId: string,
    @Body() dto: OverrideResultDto,
    @Req() req: Request,
  ) {
    const userId = (req as any).user.id;
    const ipAddress = req.ip;
    return this.resultsService.overrideResult(resultId, dto, userId, ipAddress);
  }

  @Get('matches/:id/result')
  async getResultByMatchId(@Param('id') matchId: string) {
    return this.resultsService.getResultByMatchId(matchId);
  }

  @Get('tournaments/:id/results')
  async getTournamentResults(@Param('id') tournamentId: string) {
    return this.resultsService.getTournamentResults(tournamentId);
  }

  // ===================================
  // STANDINGS / POINT TABLES
  // ===================================

  @Get('tournaments/:id/standings')
  async getTournamentStandings(
    @Param('id') tournamentId: string,
    @Query('stageId') stageId?: string,
  ) {
    return this.standingsService.getTournamentStandings(tournamentId, stageId);
  }

  // ===================================
  // MEDAL TALLY & AWARDS
  // ===================================

  @Post('medals')
  @UseGuards(SessionGuard)
  async awardMedal(@Body() dto: AwardMedalDto, @Req() req: Request) {
    const userId = (req as any).user.id;
    const ipAddress = req.ip;
    return this.medalsService.awardMedal(dto, userId, ipAddress);
  }

  @Get('medal-tally')
  async getGeneralMedalTally(@Query('eventId') eventId?: string) {
    return this.medalsService.getMedalTally(eventId);
  }

  @Get('events/:id/medal-tally')
  async getMedalTally(@Param('id') eventId: string) {
    return this.medalsService.getMedalTally(eventId);
  }

  @Get('medals')
  async getMedals(
    @Query('eventId') eventId?: string,
    @Query('sportId') sportId?: string,
    @Query('tournamentId') tournamentId?: string,
    @Query('instituteId') instituteId?: string,
  ) {
    return this.medalsService.getMedals({
      eventId,
      sportId,
      tournamentId,
      instituteId,
    });
  }
  @Get('results')
  async publicResults(@Query('sportId') sportId?: string) {
    return this.resultsService.getPublishedResults(sportId);
  }
}
