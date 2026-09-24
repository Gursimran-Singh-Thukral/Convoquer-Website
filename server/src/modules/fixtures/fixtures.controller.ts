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
  GenerateSwissRoundDto,
} from './dto/fixtures.dto.js';

// Deliberately no PermissionsGuard/@RequirePermissions on the mutating routes
// below: they address an existing tournament/stage/match by :id, and
// authority depends on which sport/event that record actually belongs to —
// not something PermissionsGuard's static decorator can derive.
// TournamentsService/MatchesService#verifyCompetitionAuthority() is the real
// check on every one of these: it loads the record, derives its actual
// sportId/eventId, and authorizes a correctly-scoped 'competition.manage'
// grant. Mirrors ScoringService.verifyScoringAuthority.
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
  @UseGuards(SessionGuard)
  async createTournament(
    @Body() dto: CreateTournamentDto,
    @Req() req: Request,
  ) {
    const userId = (req as any).user.id;
    return this.tournamentsService.createTournament(dto, userId);
  }

  @Patch('tournaments/:id')
  @UseGuards(SessionGuard)
  async updateTournament(
    @Param('id') id: string,
    @Body() dto: UpdateTournamentDto,
    @Req() req: Request,
  ) {
    const userId = (req as any).user.id;
    return this.tournamentsService.updateTournament(id, dto, userId);
  }

  @Delete('tournaments/:id')
  @UseGuards(SessionGuard)
  async deleteTournament(@Param('id') id: string, @Req() req: Request) {
    return this.tournamentsService.deleteTournament(id, (req as any).user.id);
  }

  // ===================================
  // SEEDING (CRITICAL SEPARATION FEATURE)
  // ===================================

  @Post('tournaments/:id/seeds')
  @UseGuards(SessionGuard)
  async setSeeds(
    @Param('id') tournamentId: string,
    @Body() dto: SetSeedsDto,
    @Req() req: Request,
  ) {
    const userId = (req as any).user.id;
    return this.tournamentsService.setSeeds(tournamentId, dto, userId);
  }

  @Get('tournaments/:id/seeds')
  async getSeeds(@Param('id') tournamentId: string) {
    return this.tournamentsService.getSeeds(tournamentId);
  }

  // ===================================
  // STAGES / ROUNDS
  // ===================================

  @Post('tournaments/:id/stages')
  @UseGuards(SessionGuard)
  async createStage(
    @Param('id') tournamentId: string,
    @Body() dto: CreateStageDto,
    @Req() req: Request,
  ) {
    const userId = (req as any).user.id;
    return this.tournamentsService.createStage(tournamentId, dto, userId);
  }

  @Patch('stages/:id')
  @UseGuards(SessionGuard)
  async updateStage(
    @Param('id') id: string,
    @Body() dto: UpdateStageDto,
    @Req() req: Request,
  ) {
    const userId = (req as any).user.id;
    return this.tournamentsService.updateStage(id, dto, userId);
  }

  // ===================================
  // FIXTURE / BRACKET GENERATORS
  // ===================================

  @Post('tournaments/:id/generate-bracket')
  @UseGuards(SessionGuard)
  async generateKnockoutBracket(
    @Param('id') tournamentId: string,
    @Body() dto: GenerateKnockoutBracketDto,
    @Req() req: Request,
  ) {
    const userId = (req as any).user.id;
    return this.matchesService.generateKnockoutBracket(
      tournamentId,
      dto,
      userId,
    );
  }

  @Post('tournaments/:id/generate-round-robin')
  @UseGuards(SessionGuard)
  async generateRoundRobin(
    @Param('id') tournamentId: string,
    @Body() dto: GenerateRoundRobinDto,
    @Req() req: Request,
  ) {
    const userId = (req as any).user.id;
    return this.matchesService.generateRoundRobin(tournamentId, dto, userId);
  }

  /**
   * Generates the next Swiss round (chess, etc). Round 1 needs `teamIds`;
   * every later round is derived automatically from standings in prior Swiss
   * stages of this tournament — see MatchesService.generateSwissRound.
   */
  @Post('tournaments/:id/generate-swiss-round')
  @UseGuards(SessionGuard)
  async generateSwissRound(
    @Param('id') tournamentId: string,
    @Body() dto: GenerateSwissRoundDto,
    @Req() req: Request,
  ) {
    const userId = (req as any).user.id;
    return this.matchesService.generateSwissRound(tournamentId, dto, userId);
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
  @UseGuards(SessionGuard)
  async createMatch(@Body() dto: CreateMatchDto, @Req() req: Request) {
    const userId = (req as any).user.id;
    return this.matchesService.createMatch(dto, userId);
  }

  @Patch('matches/:id')
  @UseGuards(SessionGuard)
  async updateMatch(
    @Param('id') id: string,
    @Body() dto: UpdateMatchDto,
    @Req() req: Request,
  ) {
    const userId = (req as any).user.id;
    return this.matchesService.updateMatch(id, dto, userId);
  }

  @Patch('matches/:id/reschedule')
  @UseGuards(SessionGuard)
  async rescheduleMatch(
    @Param('id') id: string,
    @Body() dto: RescheduleMatchDto,
    @Req() req: Request,
  ) {
    const userId = (req as any).user.id;
    return this.matchesService.rescheduleMatch(id, dto, userId);
  }

  // ===================================
  // OFFICIALS / REFEREES / SCOREKEEPERS
  // ===================================

  @Post('matches/:id/officials')
  @UseGuards(SessionGuard)
  async assignOfficial(
    @Param('id') matchId: string,
    @Body() dto: AssignOfficialDto,
    @Req() req: Request,
  ) {
    const actingUserId = (req as any).user.id;
    return this.matchesService.assignOfficial(matchId, dto, actingUserId);
  }

  @Delete('matches/:id/officials/:userId')
  @UseGuards(SessionGuard)
  async removeOfficial(
    @Param('id') matchId: string,
    @Param('userId') officialUserId: string,
    @Req() req: Request,
  ) {
    const actingUserId = (req as any).user.id;
    return this.matchesService.removeOfficial(
      matchId,
      officialUserId,
      actingUserId,
    );
  }
}
