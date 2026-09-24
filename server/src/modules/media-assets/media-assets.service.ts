import { PrismaService } from '../../database/prisma.service.js';
import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  MEDIA_SLOTS,
  SubmitMediaAssetDto,
  RejectMediaAssetDto,
} from './dto/media-assets.dto.js';

export interface MediaAssetRecord {
  id: string;
  slot: string;
  title: string;
  category: string;
  caption: string;
  imageUrl: string;
  aspect: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  submittedBy?: string;
  submittedAt: Date;
  reviewedBy?: string;
  reviewedAt?: Date;
  rejectionReason?: string | null;
}

const MAX_IMAGE_BYTES = 3 * 1024 * 1024; // 3MB

@Injectable()
export class MediaAssetsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAll() {
    return (await this.prisma.mediaAsset.findMany()).sort((a, b) => {
      // Pending submissions surface first so the media head sees the review queue immediately.
      if (a.status === 'PENDING' && b.status !== 'PENDING') return -1;
      if (b.status === 'PENDING' && a.status !== 'PENDING') return 1;
      return b.submittedAt.getTime() - a.submittedAt.getTime();
    });
  }

  /** Public feed — only what a media head has actually approved, per slot. */
  async getPublished(slot?: string) {
    return (await this.prisma.mediaAsset.findMany())
      .filter(
        (a) =>
          a.status === 'APPROVED' && (!slot || a.slot === slot.toUpperCase()),
      )
      .sort(
        (a, b) =>
          (b.reviewedAt?.getTime() ?? 0) - (a.reviewedAt?.getTime() ?? 0),
      );
  }

  async submit(dto: SubmitMediaAssetDto, userId?: string) {
    if (!dto.title?.trim()) {
      throw new BadRequestException('A title is required.');
    }
    if (!dto.imageUrl?.trim()) {
      throw new BadRequestException('An image is required.');
    }
    if (dto.imageUrl.length > MAX_IMAGE_BYTES * 1.4) {
      throw new BadRequestException(
        'That image is too large — please use a file under 3MB.',
      );
    }
    const slot = (dto.slot || '').toUpperCase();
    if (!MEDIA_SLOTS.includes(slot as any)) {
      throw new BadRequestException(
        `Unknown media slot "${dto.slot}". Must be one of: ${MEDIA_SLOTS.join(', ')}`,
      );
    }

    const asset: MediaAssetRecord = {
      id: randomUUID(),
      slot,
      title: dto.title.trim(),
      category: (dto.category || 'GENERAL').trim().toUpperCase(),
      caption: dto.caption?.trim() || '',
      imageUrl: dto.imageUrl,
      aspect: dto.aspect || 'standard',
      status: 'PENDING',
      submittedBy: userId,
      submittedAt: new Date(),
    };
    return this.prisma.mediaAsset.create({ data: asset });
  }

  async approve(id: string, userId?: string) {
    const asset = await this.findOrThrow(id);
    asset.status = 'APPROVED';
    asset.reviewedBy = userId ?? null;
    asset.reviewedAt = new Date();
    asset.rejectionReason = null;
    return this.prisma.mediaAsset.update({ where: { id }, data: asset });
  }

  async reject(id: string, dto: RejectMediaAssetDto, userId?: string) {
    const asset = await this.findOrThrow(id);
    asset.status = 'REJECTED';
    asset.reviewedBy = userId ?? null;
    asset.reviewedAt = new Date();
    asset.rejectionReason = dto.reason?.trim() || 'No reason given.';
    return this.prisma.mediaAsset.update({ where: { id }, data: asset });
  }

  async remove(id: string): Promise<{ success: boolean }> {
    await this.findOrThrow(id);
    await this.prisma.mediaAsset.delete({ where: { id } });
    return { success: true };
  }

  private async findOrThrow(id: string) {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!asset) {
      throw new NotFoundException(`Media asset "${id}" not found`);
    }
    return asset;
  }
}
