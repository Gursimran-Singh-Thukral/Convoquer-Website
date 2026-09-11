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
import { InstitutesService } from './institutes.service.js';
import { TeamsService } from './teams.service.js';
import { ParticipantsService } from './participants.service.js';
import { SessionGuard } from '../../common/guards/session.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator.js';
import {
  CreateInstituteDto,
  UpdateInstituteDto,
  CreateTeamDto,
  UpdateTeamDto,
  CreateParticipantDto,
  UpdateParticipantDto,
  RegisterOnSpotAttendeeDto,
  SecurityCheckInDto,
  AddTeamMemberDto,
  UpdateTeamMemberDto,
  BulkImportDto,
} from './dto/teams.dto.js';

@Controller('api')
export class TeamsController {
  constructor(
    private readonly institutesService: InstitutesService,
    private readonly teamsService: TeamsService,
    private readonly participantsService: ParticipantsService,
  ) {}

  // ===================================
  // INSTITUTES
  // ===================================

  @Get('institutes')
  async getInstitutes(
    @Query('eventId') eventId?: string,
    @Query('status') status?: string,
  ) {
    return this.institutesService.getInstitutes(eventId, status);
  }

  @Get('institutes/:id')
  async getInstituteById(@Param('id') id: string) {
    return this.institutesService.getInstituteById(id);
  }

  @Post('institutes')
  @UseGuards(SessionGuard, PermissionsGuard)
  @RequirePermissions('team.create')
  async createInstitute(@Body() dto: CreateInstituteDto) {
    return this.institutesService.createInstitute(dto);
  }

  @Patch('institutes/:id')
  @UseGuards(SessionGuard, PermissionsGuard)
  @RequirePermissions('team.update')
  async updateInstitute(
    @Param('id') id: string,
    @Body() dto: UpdateInstituteDto,
  ) {
    return this.institutesService.updateInstitute(id, dto);
  }

  // ===================================
  // TEAMS
  // ===================================

  @Get('teams')
  async getTeams(
    @Query('eventId') eventId?: string,
    @Query('instituteId') instituteId?: string,
    @Query('sportId') sportId?: string,
    @Query('status') status?: string,
  ) {
    return this.teamsService.getTeams({
      eventId,
      instituteId,
      sportId,
      status,
    });
  }

  @Get('teams/:id')
  async getTeamById(@Param('id') id: string) {
    return this.teamsService.getTeamById(id);
  }

  @Post('teams')
  @UseGuards(SessionGuard, PermissionsGuard)
  @RequirePermissions('team.create')
  async createTeam(@Body() dto: CreateTeamDto) {
    return this.teamsService.createTeam(dto);
  }

  @Patch('teams/:id')
  @UseGuards(SessionGuard, PermissionsGuard)
  @RequirePermissions('team.update')
  async updateTeam(@Param('id') id: string, @Body() dto: UpdateTeamDto) {
    return this.teamsService.updateTeam(id, dto);
  }

  @Post('teams/:teamId/members')
  @UseGuards(SessionGuard, PermissionsGuard)
  @RequirePermissions('team.update')
  async addTeamMember(
    @Param('teamId') teamId: string,
    @Body() dto: AddTeamMemberDto,
  ) {
    return this.teamsService.addMember(teamId, dto);
  }

  @Patch('teams/:teamId/members/:participantId')
  @UseGuards(SessionGuard, PermissionsGuard)
  @RequirePermissions('team.update')
  async updateTeamMember(
    @Param('teamId') teamId: string,
    @Param('participantId') participantId: string,
    @Body() dto: UpdateTeamMemberDto,
  ) {
    return this.teamsService.updateMember(teamId, participantId, dto);
  }

  @Delete('teams/:teamId/members/:participantId')
  @UseGuards(SessionGuard, PermissionsGuard)
  @RequirePermissions('team.update')
  async removeTeamMember(
    @Param('teamId') teamId: string,
    @Param('participantId') participantId: string,
  ) {
    return this.teamsService.removeMember(teamId, participantId);
  }

  // ===================================
  // PARTICIPANTS & ROSTERS
  // ===================================

  @Get('participants')
  async getParticipants(
    @Query('eventId') eventId?: string,
    @Query('instituteId') instituteId?: string,
    @Query('category') category?: string,
    @Query('isCheckedIn') isCheckedIn?: string,
    @Query('query') query?: string,
  ) {
    const checkedInBool =
      isCheckedIn === 'true'
        ? true
        : isCheckedIn === 'false'
          ? false
          : undefined;
    return this.participantsService.getParticipants({
      eventId,
      instituteId,
      category,
      isCheckedIn: checkedInBool,
      query,
    });
  }

  @Get('participants/:id')
  async getParticipantById(@Param('id') id: string) {
    return this.participantsService.getParticipantById(id);
  }

  @Post('participants')
  @UseGuards(SessionGuard, PermissionsGuard)
  @RequirePermissions('participant.create')
  async createParticipant(@Body() dto: CreateParticipantDto) {
    return this.participantsService.createParticipant(dto);
  }

  @Patch('participants/:id')
  @UseGuards(SessionGuard, PermissionsGuard)
  @RequirePermissions('participant.update')
  async updateParticipant(
    @Param('id') id: string,
    @Body() dto: UpdateParticipantDto,
  ) {
    return this.participantsService.updateParticipant(id, dto);
  }

  // ====================================================
  // SECURITY DESK & ON-SPOT AUDIENCE REGISTRATION
  // ====================================================

  /**
   * Fast participant/audience verification search for security gates
   */
  @Get('security/search')
  async securitySearch(
    @Query('q') query: string,
    @Query('eventId') eventId?: string,
  ) {
    return this.participantsService.securitySearch(query, eventId);
  }

  /**
   * Security Gate Check-In Endpoint
   */
  @Post('security/check-in')
  async checkInParticipant(
    @Body() dto: SecurityCheckInDto,
    @Req() req: Request,
  ) {
    const userId = (req as any).user?.id;
    return this.participantsService.checkInParticipant(dto, userId);
  }

  /**
   * On-Spot Registration for Audience, Guests, or unlisted Athletes.
   * Immediately visible to security gate staff.
   */
  @Post('security/on-spot-pass')
  async registerOnSpotAttendee(@Body() dto: RegisterOnSpotAttendeeDto) {
    return this.participantsService.registerOnSpotAttendee(dto);
  }

  /**
   * Bulk Registration Import (Excel/CSV parsed rows)
   */
  @Post('participants/import')
  @UseGuards(SessionGuard, PermissionsGuard)
  @RequirePermissions('participant.create')
  async bulkImport(@Body() dto: BulkImportDto) {
    return this.participantsService.bulkImport(dto);
  }
}
