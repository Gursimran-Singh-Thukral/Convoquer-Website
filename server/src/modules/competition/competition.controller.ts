import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { EventsService } from './events.service.js';
import { SportsService } from './sports.service.js';
import { VenuesService } from './venues.service.js';
import { SessionGuard } from '../../common/guards/session.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator.js';
import {
  CreateEventDto,
  UpdateEventDto,
  CreateSportDto,
  UpdateSportDto,
  CreateVenueDto,
  UpdateVenueDto,
} from './dto/competition.dto.js';

@Controller('api')
export class CompetitionController {
  constructor(
    private readonly eventsService: EventsService,
    private readonly sportsService: SportsService,
    private readonly venuesService: VenuesService,
  ) {}

  // ===================================
  // EVENTS
  // ===================================

  @Get('events')
  async getEvents(@Query('status') status?: string) {
    return this.eventsService.getEvents(status);
  }

  @Get('events/:idOrSlug')
  async getEventByIdOrSlug(@Param('idOrSlug') idOrSlug: string) {
    return this.eventsService.getEventByIdOrSlug(idOrSlug);
  }

  @Post('events')
  @UseGuards(SessionGuard, PermissionsGuard)
  @RequirePermissions('sport.create')
  async createEvent(@Body() dto: CreateEventDto) {
    return this.eventsService.createEvent(dto);
  }

  @Patch('events/:id')
  @UseGuards(SessionGuard, PermissionsGuard)
  @RequirePermissions('sport.update')
  async updateEvent(@Param('id') id: string, @Body() dto: UpdateEventDto) {
    return this.eventsService.updateEvent(id, dto);
  }

  // ===================================
  // SPORTS
  // ===================================

  @Get('sports')
  async getSports(
    @Query('eventId') eventId?: string,
    @Query('status') status?: string,
  ) {
    return this.sportsService.getSports(eventId, status);
  }

  @Get('sports/:id')
  async getSportById(@Param('id') id: string) {
    return this.sportsService.getSportById(id);
  }

  @Post('sports')
  @UseGuards(SessionGuard, PermissionsGuard)
  @RequirePermissions('sport.create')
  async createSport(@Body() dto: CreateSportDto) {
    return this.sportsService.createSport(dto);
  }

  @Patch('sports/:id')
  @UseGuards(SessionGuard, PermissionsGuard)
  @RequirePermissions('sport.update')
  async updateSport(@Param('id') id: string, @Body() dto: UpdateSportDto) {
    return this.sportsService.updateSport(id, dto);
  }

  @Delete('sports/:id')
  @UseGuards(SessionGuard, PermissionsGuard)
  @RequirePermissions('sport.update')
  async deleteSport(@Param('id') id: string) {
    return this.sportsService.deleteSport(id);
  }

  // ===================================
  // VENUES
  // ===================================

  @Get('venues')
  async getVenues(
    @Query('eventId') eventId?: string,
    @Query('status') status?: string,
  ) {
    return this.venuesService.getVenues(eventId, status);
  }

  @Get('venues/:id')
  async getVenueById(@Param('id') id: string) {
    return this.venuesService.getVenueById(id);
  }

  @Post('venues')
  @UseGuards(SessionGuard, PermissionsGuard)
  @RequirePermissions('venue.create')
  async createVenue(@Body() dto: CreateVenueDto) {
    return this.venuesService.createVenue(dto);
  }

  @Patch('venues/:id')
  @UseGuards(SessionGuard, PermissionsGuard)
  @RequirePermissions('venue.update')
  async updateVenue(@Param('id') id: string, @Body() dto: UpdateVenueDto) {
    return this.venuesService.updateVenue(id, dto);
  }

  @Delete('venues/:id')
  @UseGuards(SessionGuard, PermissionsGuard)
  @RequirePermissions('venue.update')
  async deleteVenue(@Param('id') id: string) {
    return this.venuesService.deleteVenue(id);
  }
}
