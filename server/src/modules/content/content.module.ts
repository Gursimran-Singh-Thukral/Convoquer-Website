import {
  Module,
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../database/prisma.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { RbacModule } from '../rbac/rbac.module.js';
import { SessionGuard } from '../../common/guards/session.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator.js';
import { CreateContentDto, UpdateContentDto } from './dto/content.dto.js';

@Controller('api/content')
export class ContentController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  publicContent(@Query('kind') kind?: string) {
    return this.prisma.contentEntry.findMany({
      where: { status: 'PUBLISHED', ...(kind ? { kind } : {}) },
      select: {
        id: true,
        kind: true,
        title: true,
        body: true,
        linkUrl: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  @Get('manage')
  @UseGuards(SessionGuard, PermissionsGuard)
  @RequirePermissions('media.publish')
  manage() {
    return this.prisma.contentEntry.findMany({
      orderBy: { updatedAt: 'desc' },
    });
  }

  @Post()
  @UseGuards(SessionGuard, PermissionsGuard)
  @RequirePermissions('media.publish')
  async create(@Body() dto: CreateContentDto, @Req() req: Request) {
    const userId = (req.user as { id: string }).id;
    return this.prisma.$transaction(async (tx) => {
      const entry = await tx.contentEntry.create({
        data: { ...dto, createdBy: userId },
      });
      await tx.auditLog.create({
        data: {
          userId,
          action: 'content.create',
          resource: 'ContentEntry',
          resourceId: entry.id,
          newState: {
            title: entry.title,
            status: entry.status,
            kind: entry.kind,
          },
        },
      });
      return entry;
    });
  }

  @Patch(':id')
  @UseGuards(SessionGuard, PermissionsGuard)
  @RequirePermissions('media.publish')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateContentDto,
    @Req() req: Request,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const previous = await tx.contentEntry.findUnique({ where: { id } });
      if (!previous) throw new NotFoundException('Content not found');
      const entry = await tx.contentEntry.update({ where: { id }, data: dto });
      await tx.auditLog.create({
        data: {
          userId: (req.user as { id: string }).id,
          action: 'content.update',
          resource: 'ContentEntry',
          resourceId: id,
          previousState: { status: previous.status, title: previous.title },
          newState: { status: entry.status, title: entry.title },
        },
      });
      return entry;
    });
  }
}

@Module({ imports: [AuthModule, RbacModule], controllers: [ContentController] })
export class ContentModule {}
