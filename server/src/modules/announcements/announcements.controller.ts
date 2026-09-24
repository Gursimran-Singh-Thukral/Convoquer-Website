import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AnnouncementsService } from './announcements.service.js';
import { SessionGuard } from '../../common/guards/session.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator.js';
import {
  CreateAnnouncementDto,
  ANNOUNCEMENT_TARGETS,
} from './dto/announcements.dto.js';

@Controller('api/announcements')
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  /** Public bulletins feed consumed by /announcements. No auth required. */
  @Get('public')
  async getPublicAnnouncements() {
    return this.announcementsService.getPublicAnnouncements();
  }

  @Get('targets')
  async getTargets() {
    return ANNOUNCEMENT_TARGETS;
  }

  /** Full feed (any target), for staff dispatch history. */
  @Get()
  @UseGuards(SessionGuard)
  async getAnnouncements(@Query('target') target?: string) {
    return this.announcementsService.getAnnouncements(target);
  }

  @Post()
  @UseGuards(SessionGuard, PermissionsGuard)
  @RequirePermissions('media.publish')
  async createAnnouncement(
    @Body() dto: CreateAnnouncementDto,
    @Req() req: Request,
  ) {
    const userId = (req as any).user?.id;
    return this.announcementsService.createAnnouncement(dto, userId);
  }
}
