import { PrismaService } from '../../database/prisma.service.js';
import { Injectable, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  ANNOUNCEMENT_TARGETS,
  CreateAnnouncementDto,
} from './dto/announcements.dto.js';

export interface AnnouncementRecord {
  id: string;
  heading: string;
  description: string;
  targets: string[];
  createdBy?: string;
  createdAt: Date;
}

@Injectable()
export class AnnouncementsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAnnouncements(target?: string) {
    let list = await this.prisma.announcement.findMany();
    if (target) {
      list = list.filter((a) => a.targets.includes(target.toUpperCase()));
    }
    return list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /** Public bulletins feed — only announcements explicitly targeted at PUBLIC. */
  async getPublicAnnouncements() {
    return this.getAnnouncements('PUBLIC');
  }

  async createAnnouncement(dto: CreateAnnouncementDto, userId?: string) {
    if (!dto.heading?.trim()) {
      throw new BadRequestException('Announcement heading is required.');
    }
    if (!dto.description?.trim()) {
      throw new BadRequestException('Announcement description is required.');
    }
    if (!Array.isArray(dto.targets) || dto.targets.length === 0) {
      throw new BadRequestException('Select at least one target audience.');
    }
    const targets = dto.targets.map((t) => t.toUpperCase());
    const invalid = targets.filter(
      (t) => !ANNOUNCEMENT_TARGETS.includes(t as any),
    );
    if (invalid.length > 0) {
      throw new BadRequestException(
        `Unknown target audience: ${invalid.join(', ')}`,
      );
    }

    const announcement: AnnouncementRecord = {
      id: randomUUID(),
      heading: dto.heading.trim(),
      description: dto.description.trim(),
      targets,
      createdBy: userId,
      createdAt: new Date(),
    };
    await this.prisma.announcement.create({ data: announcement });
    // NOTE: WhatsApp delivery to targeted volunteers is not wired up yet —
    // deferred pending a WhatsApp Business API provider + credentials.
    return announcement;
  }
}
