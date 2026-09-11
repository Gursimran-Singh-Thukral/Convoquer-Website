import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { TournamentsService } from './tournaments.service.js';
import { MatchesService } from './matches.service.js';
import { SessionGuard } from '../../common/guards/session.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator.js';
import {
  CreateTournamentDto,
  UpdateTournamentDto,
  SetSeedsDto,
  CreateStageDto,
  UpdateStageDto,
  CreateMatchDto,
  UpdateMatchDto,
  RescheduleMatchDto,
  AssignOfficialDto,
  GenerateKnockoutBracketDto,
  GenerateRoundRobinDto,
} from './dto/fixtures.dto.js';

@Controller('api')
export class FixturesController {
  constructor(
    private readonly tournamentsService: TournamentsService,
    private readonly matchesService: MatchesService,
  ) {}

  // ===================================
  // TOURNAMENTS
  // ===================================

  @Get('tournaments')
  async getTournaments(
    @Query('eventId') eventId?: string,
    @Query('sportId') sportId?: string,
  ) {
    return this.tournamentsService.getTournaments(eventId, sportId);
  }

  @Get('tournaments/:id')
  async getTournamentById(@Param('id') id: string) {
    return this.tournamentsService.getTournamentById(id);
  }

  @Post('tournaments')
  @UseGuards(SessionGuard, PermissionsGuard)
  @RequirePermissions('competition.manage')
  async createTournament(@Body() dto: CreateTournamentDto) {
    return this.tournamentsService.createTournament(dto);
  }

  @Patch('tournaments/:id')
  @UseGuards(SessionGuard, PermissionsGuard)
  @RequirePermissions('competition.manage')
  async updateTournament(
    @Param('id') id: string,
    @Body() dto: UpdateTournamentDto,
  ) {
    return this.tournamentsService.updateTournament(id, dto);
  }

  // ===================================
  // SEEDING (CRITICAL SEPARATION FEATURE)
  // ===================================

  @Post('tournaments/:id/seeds')
  @UseGuards(SessionGuard, PermissionsGuard)
  @RequirePermissions('competition.manage')
  async setSeeds(
    @Param('id') tournamentId: string,
    @Body() dto: SetSeedsDto,
  ) {
    return this.tournamentsService.setSeeds(tournamentId, dto);
  }

  @Get('tournaments/:id/seeds')
  async getSeeds(@Param('id') tournamentId: string) {
    return this.tournamentsService.getSeeds(tournamentId);
  }

  // ===================================
  // STAGES / ROUNDS
  // ===================================

  @Post('tournaments/:id/stages')
  @UseGuards(SessionGuard, PermissionsGuard)
  @RequirePermissions('competition.manage')
  async createStage(
    @Param('id') tournamentId: string,
    @Body() dto: CreateStageDto,
  ) {
    return this.tournamentsService.createStage(tournamentId, dto);
  }

  @Patch('stages/:id')
  @UseGuards(SessionGuard, PermissionsGuard)
  @RequirePermissions('competition.manage')
  async updateStage(
    @Param('id') id: string,
    @Body() dto: UpdateStageDto,
  ) {
    return this.tournamentsService.updateStage(id, dto);
  }

  // ===================================
  // FIXTURE / BRACKET GENERATORS
  // ===================================

  @Post('tournaments/:id/generate-bracket')
  @UseGuards(SessionGuard, PermissionsGuard)
  @RequirePermissions('competition.manage')
  async generateKnockoutBracket(
    @Param('id') tournamentId: string,
    @Body() dto: GenerateKnockoutBracketDto,
  ) {
    return this.matchesService.generateKnockoutBracket(tournamentId, dto);
  }

  @Post('tournaments/:id/generate-round-robin')
  @UseGuards(SessionGuard, PermissionsGuard)
  @RequirePermissions('competition.manage')
  async generateRoundRobin(
    @Param('id') tournamentId: string,
    @Body() dto: GenerateRoundRobinDto,
  ) {
    return this.matchesService.generateRoundRobin(tournamentId, dto);
  }

  // ===================================
  // MATCHES & SCHEDULE VIEWER
  // ===================================

  @Get('matches')
  async getMatches(
    @Query('tournamentId') tournamentId?: string,
    @Query('stageId') stageId?: string,
    @Query('venueId') venueId?: string,
    @Query('sportId') sportId?: string,
    @Query('status') status?: string,
    @Query('teamId') teamId?: string,
    @Query('date') date?: string,
  ) {
    return this.matchesService.getMatches({
      tournamentId,
      stageId,
      venueId,
      sportId,
      status,
      teamId,
      date,
    });
  }

  @Get('matches/:id')
  async getMatchById(@Param('id') id: string) {
    return this.matchesService.getMatchById(id);
  }

  @Post('matches')
  @UseGuards(SessionGuard, PermissionsGuard)
  @RequirePermissions('competition.manage')
  async createMatch(@Body() dto: CreateMatchDto) {
    return this.matchesService.createMatch(dto);
  }

  @Patch('matches/:id')
  @UseGuards(SessionGuard, PermissionsGuard)
  @RequirePermissions('competition.manage')
  async updateMatch(
    @Param('id') id: string,
    @Body() dto: UpdateMatchDto,
  ) {
    return this.matchesService.updateMatch(id, dto);
  }

  @Patch('matches/:id/reschedule')
  @UseGuards(SessionGuard, PermissionsGuard)
  @RequirePermissions('competition.manage')
  async rescheduleMatch(
    @Param('id') id: string,
    @Body() dto: RescheduleMatchDto,
    @Req() req: Request,
  ) {
    const userId = (req as any).user?.id;
    return this.matchesService.rescheduleMatch(id, dto, userId);
  }

  // ===================================
  // OFFICIALS / REFEREES / SCOREKEEPERS
  // ===================================

  @Post('matches/:id/officials')
  @UseGuards(SessionGuard, PermissionsGuard)
  @RequirePermissions('competition.manage')
  async assignOfficial(
    @Param('id') matchId: string,
    @Body() dto: AssignOfficialDto,
  ) {
    return this.matchesService.assignOfficial(matchId, dto);
  }

  @Delete('matches/:id/officials/:userId')
  @UseGuards(SessionGuard, PermissionsGuard)
  @RequirePermissions('competition.manage')
  async removeOfficial(
    @Param('id') matchId: string,
    @Param('userId') userId: string,
  ) {
    return this.matchesService.removeOfficial(matchId, userId);
  }
}
