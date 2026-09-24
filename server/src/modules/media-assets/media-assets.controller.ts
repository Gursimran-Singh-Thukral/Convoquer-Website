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
import { MediaAssetsService } from './media-assets.service.js';
import { SessionGuard } from '../../common/guards/session.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator.js';
import {
  SubmitMediaAssetDto,
  RejectMediaAssetDto,
} from './dto/media-assets.dto.js';

@Controller('api/media-assets')
export class MediaAssetsController {
  constructor(private readonly mediaAssetsService: MediaAssetsService) {}

  /** Public feed — what visitors actually see on /gallery and /about. */
  @Get('published')
  async getPublished(@Query('slot') slot?: string) {
    return this.mediaAssetsService.getPublished(slot);
  }

  /** Full review queue (pending + past decisions) — media team only. */
  @Get()
  @UseGuards(SessionGuard, PermissionsGuard)
  @RequirePermissions('media.create')
  async getAll() {
    return this.mediaAssetsService.getAll();
  }

  @Post()
  @UseGuards(SessionGuard, PermissionsGuard)
  @RequirePermissions('media.create')
  async submit(@Body() dto: SubmitMediaAssetDto, @Req() req: Request) {
    const userId = (req as any).user?.id;
    return this.mediaAssetsService.submit(dto, userId);
  }

  @Patch(':id/approve')
  @UseGuards(SessionGuard, PermissionsGuard)
  @RequirePermissions('media.publish')
  async approve(@Param('id') id: string, @Req() req: Request) {
    const userId = (req as any).user?.id;
    return this.mediaAssetsService.approve(id, userId);
  }

  @Patch(':id/reject')
  @UseGuards(SessionGuard, PermissionsGuard)
  @RequirePermissions('media.publish')
  async reject(
    @Param('id') id: string,
    @Body() dto: RejectMediaAssetDto,
    @Req() req: Request,
  ) {
    const userId = (req as any).user?.id;
    return this.mediaAssetsService.reject(id, dto, userId);
  }

  @Delete(':id')
  @UseGuards(SessionGuard, PermissionsGuard)
  @RequirePermissions('media.publish')
  async remove(@Param('id') id: string) {
    return this.mediaAssetsService.remove(id);
  }
}
