import { PrismaService } from '../../database/prisma.service.js';
import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CreateSponsorDto, UpdateSponsorDto } from './dto/sponsors.dto.js';

export interface SponsorRecord {
  id: string;
  name: string;
  role: string;
  tier: string;
  color: string;
  logoUrl?: string;
  websiteUrl?: string;
  description?: string;
  orderIndex: number;
  addedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class SponsorsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSponsors(filters?: { tier?: string; role?: string }) {
    let result = await this.prisma.sponsor.findMany();

    if (filters?.tier) {
      const t = filters.tier.toUpperCase();
      result = result.filter((s) => s.tier.toUpperCase() === t);
    }

    if (filters?.role) {
      const r = filters.role.toLowerCase();
      result = result.filter((s) => s.role.toLowerCase().includes(r));
    }

    return result.sort((a, b) => a.orderIndex - b.orderIndex);
  }

  async getSponsorById(id: string) {
    const sponsor = await this.prisma.sponsor.findUnique({ where: { id } });
    if (!sponsor) {
      throw new NotFoundException(`Sponsor with ID "${id}" not found`);
    }
    return sponsor;
  }

  async createSponsor(dto: CreateSponsorDto, userId?: string) {
    const newSponsor: SponsorRecord = {
      id: randomUUID(),
      name: dto.name.trim(),
      role: dto.role.trim(),
      tier: (dto.tier || 'OFFICIAL_PARTNER').toUpperCase(),
      color: dto.color || 'text-[#FFD700]',
      logoUrl: dto.logoUrl,
      websiteUrl: dto.websiteUrl,
      description: dto.description,
      orderIndex: dto.orderIndex ?? (await this.prisma.sponsor.count()) + 1,
      addedBy: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return this.prisma.sponsor.create({ data: newSponsor });
  }

  async updateSponsor(id: string, dto: UpdateSponsorDto, _userId?: string) {
    const current = await this.prisma.sponsor.findUnique({ where: { id } });
    if (!current) {
      throw new NotFoundException(`Sponsor with ID "${id}" not found`);
    }

    const updated = {
      ...current,
      name: dto.name !== undefined ? dto.name.trim() : current.name,
      role: dto.role !== undefined ? dto.role.trim() : current.role,
      tier: dto.tier !== undefined ? dto.tier.toUpperCase() : current.tier,
      color: dto.color !== undefined ? dto.color : current.color,
      logoUrl: dto.logoUrl !== undefined ? dto.logoUrl : current.logoUrl,
      websiteUrl:
        dto.websiteUrl !== undefined ? dto.websiteUrl : current.websiteUrl,
      description:
        dto.description !== undefined ? dto.description : current.description,
      orderIndex:
        dto.orderIndex !== undefined ? dto.orderIndex : current.orderIndex,
      updatedAt: new Date(),
    };

    return this.prisma.sponsor.update({ where: { id }, data: updated });
  }

  async deleteSponsor(
    id: string,
    _userId?: string,
  ): Promise<{ success: boolean; id: string }> {
    const current = await this.prisma.sponsor.findUnique({ where: { id } });
    if (!current) {
      throw new NotFoundException(`Sponsor with ID "${id}" not found`);
    }

    await this.prisma.sponsor.delete({ where: { id } });
    return { success: true, id };
  }
}
