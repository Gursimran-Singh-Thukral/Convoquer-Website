import { Controller, Get, Patch, Body, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { SiteSettingsService } from './site-settings.service.js';
import { SessionGuard } from '../../common/guards/session.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator.js';
import { UpdateSiteSettingsDto } from './dto/site-settings.dto.js';

@Controller('api/site-settings')
export class SiteSettingsController {
  constructor(private readonly siteSettingsService: SiteSettingsService) {}

  /** Public — every visitor's browser needs this to render the navbar/favicon. */
  @Get()
  async getSettings() {
    return this.siteSettingsService.getSettings();
  }

  /**
   * Update site-wide branding (currently: the Convoquer logo). Restricted to
   * the media team, same as the rest of the media/announcements surface.
   */
  @Patch()
  @UseGuards(SessionGuard, PermissionsGuard)
  @RequirePermissions('media.publish')
  async updateSettings(
    @Body() dto: UpdateSiteSettingsDto,
    @Req() req: Request,
  ) {
    const userId = (req as any).user?.id;
    return this.siteSettingsService.updateSettings(dto, userId);
  }
}
