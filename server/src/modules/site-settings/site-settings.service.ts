import { Injectable, BadRequestException } from '@nestjs/common';
import { UpdateSiteSettingsDto } from './dto/site-settings.dto.js';
import { PrismaService } from '../../database/prisma.service.js';

export interface SiteSettingsRecord {
  logoUrl: string | null;
  updatedBy?: string;
  updatedAt: Date;
}

const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2MB, generous for a small navbar/favicon logo

@Injectable()
export class SiteSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings() {
    return (
      (await this.prisma.siteSettings.findUnique({
        where: { id: 'site' },
        select: { logoUrl: true },
      })) ?? { logoUrl: null }
    );
  }

  async updateSettings(dto: UpdateSiteSettingsDto, userId?: string) {
    if (dto.logoUrl !== undefined) {
      if (dto.logoUrl && dto.logoUrl.length > MAX_LOGO_BYTES * 1.4) {
        // Base64 inflates size ~1.37x — this is a rough guard against oversized uploads.
        throw new BadRequestException(
          'Logo image is too large — please use a file under 2MB.',
        );
      }
      const data = {
        logoUrl: dto.logoUrl || null,
        updatedBy: userId,
        updatedAt: new Date(),
      };
      return this.prisma.siteSettings.upsert({
        where: { id: 'site' },
        create: { id: 'site', ...data },
        update: data,
      });
    }
    return this.getSettings();
  }
}
