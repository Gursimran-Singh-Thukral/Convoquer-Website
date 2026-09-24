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
import { SponsorsService } from './sponsors.service.js';
import { SessionGuard } from '../../common/guards/session.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator.js';
import { CreateSponsorDto, UpdateSponsorDto } from './dto/sponsors.dto.js';

@Controller('api/sponsors')
export class SponsorsController {
  constructor(private readonly sponsorsService: SponsorsService) {}

  @Get()
  async getSponsors(
    @Query('tier') tier?: string,
    @Query('role') role?: string,
  ) {
    return this.sponsorsService.getSponsors({ tier, role });
  }

  @Get(':id')
  async getSponsorById(@Param('id') id: string) {
    return this.sponsorsService.getSponsorById(id);
  }

  /**
   * Add Sponsor - Strictly backend/sponsorship-head restricted.
   */
  @Post()
  @UseGuards(SessionGuard, PermissionsGuard)
  @RequirePermissions('sponsor.create')
  async createSponsor(@Body() dto: CreateSponsorDto, @Req() req: Request) {
    const userId = (req as any).user?.id;
    return this.sponsorsService.createSponsor(dto, userId);
  }

  /**
   * Update Sponsor - Strictly backend/sponsorship-head restricted.
   */
  @Patch(':id')
  @UseGuards(SessionGuard, PermissionsGuard)
  @RequirePermissions('sponsor.update')
  async updateSponsor(
    @Param('id') id: string,
    @Body() dto: UpdateSponsorDto,
    @Req() req: Request,
  ) {
    const userId = (req as any).user?.id;
    return this.sponsorsService.updateSponsor(id, dto, userId);
  }

  /**
   * Delete Sponsor - Strictly backend/sponsorship-head restricted.
   */
  @Delete(':id')
  @UseGuards(SessionGuard, PermissionsGuard)
  @RequirePermissions('sponsor.delete')
  async deleteSponsor(@Param('id') id: string, @Req() req: Request) {
    const userId = (req as any).user?.id;
    return this.sponsorsService.deleteSponsor(id, userId);
  }
}
