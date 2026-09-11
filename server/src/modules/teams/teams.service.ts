import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import {
  CreateTeamDto,
  UpdateTeamDto,
  AddTeamMemberDto,
  UpdateTeamMemberDto,
} from './dto/teams.dto.js';

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  async getTeams(filter?: {
    eventId?: string;
    instituteId?: string;
    sportId?: string;
    status?: string;
  }) {
    return this.prisma.team.findMany({
      where: {
        ...(filter?.eventId ? { eventId: filter.eventId } : {}),
        ...(filter?.instituteId ? { instituteId: filter.instituteId } : {}),
        ...(filter?.sportId ? { sportId: filter.sportId } : {}),
        ...(filter?.status ? { status: filter.status } : {}),
      },
      include: {
        institute: { select: { id: true, name: true, shortName: true, logoUrl: true } },
        sport: { select: { id: true, name: true } },
        _count: {
          select: { members: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async getTeamById(id: string) {
    const team = await this.prisma.team.findUnique({
      where: { id },
      include: {
        institute: true,
        sport: true,
        members: {
          include: {
            participant: {
              select: {
                id: true,
                name: true,
                rollNumber: true,
                gender: true,
                photographUrl: true,
                category: true,
                isCheckedIn: true,
              },
            },
          },
          orderBy: { role: 'asc' },
        },
      },
    });

    if (!team) {
      throw new NotFoundException(`Team with id "${id}" not found`);
    }

    return team;
  }

  async createTeam(dto: CreateTeamDto) {
    const [event, institute, sport] = await Promise.all([
      this.prisma.event.findUnique({ where: { id: dto.eventId } }),
      this.prisma.institute.findUnique({ where: { id: dto.instituteId } }),
      this.prisma.sport.findUnique({ where: { id: dto.sportId } }),
    ]);

    if (!event) throw new NotFoundException(`Event "${dto.eventId}" not found`);
    if (!institute) throw new NotFoundException(`Institute "${dto.instituteId}" not found`);
    if (!sport) throw new NotFoundException(`Sport "${dto.sportId}" not found`);

    const existing = await this.prisma.team.findFirst({
      where: {
        eventId: dto.eventId,
        instituteId: dto.instituteId,
        sportId: dto.sportId,
        name: dto.name,
      },
    });
    if (existing) {
      throw new ConflictException(`Team "${dto.name}" already registered for this sport`);
    }

    return this.prisma.team.create({
      data: {
        eventId: dto.eventId,
        instituteId: dto.instituteId,
        sportId: dto.sportId,
        name: dto.name,
      },
      include: {
        institute: true,
        sport: true,
      },
    });
  }

  async updateTeam(id: string, dto: UpdateTeamDto) {
    const existing = await this.prisma.team.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Team with id "${id}" not found`);
    }

    return this.prisma.team.update({
      where: { id },
      data: {
        name: dto.name,
        status: dto.status,
      },
    });
  }

  async addMember(teamId: string, dto: AddTeamMemberDto) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) throw new NotFoundException(`Team "${teamId}" not found`);

    const participant = await this.prisma.participant.findUnique({
      where: { id: dto.participantId },
    });
    if (!participant) throw new NotFoundException(`Participant "${dto.participantId}" not found`);

    return this.prisma.teamMember.upsert({
      where: {
        teamId_participantId: {
          teamId,
          participantId: dto.participantId,
        },
      },
      update: {
        role: dto.role || 'PLAYER',
        jerseyNumber: dto.jerseyNumber,
      },
      create: {
        teamId,
        participantId: dto.participantId,
        role: dto.role || 'PLAYER',
        jerseyNumber: dto.jerseyNumber,
      },
      include: {
        participant: {
          select: {
            id: true,
            name: true,
            rollNumber: true,
            gender: true,
            category: true,
          },
        },
      },
    });
  }

  async updateMember(teamId: string, participantId: string, dto: UpdateTeamMemberDto) {
    const existing = await this.prisma.teamMember.findUnique({
      where: {
        teamId_participantId: { teamId, participantId },
      },
    });
    if (!existing) throw new NotFoundException('Team member not found');

    return this.prisma.teamMember.update({
      where: {
        teamId_participantId: { teamId, participantId },
      },
      data: {
        role: dto.role,
        jerseyNumber: dto.jerseyNumber,
      },
    });
  }

  async removeMember(teamId: string, participantId: string) {
    const existing = await this.prisma.teamMember.findUnique({
      where: {
        teamId_participantId: { teamId, participantId },
      },
    });
    if (!existing) throw new NotFoundException('Team member not found');

    await this.prisma.teamMember.delete({
      where: {
        teamId_participantId: { teamId, participantId },
      },
    });

    return { success: true, message: 'Member removed from team' };
  }
}
