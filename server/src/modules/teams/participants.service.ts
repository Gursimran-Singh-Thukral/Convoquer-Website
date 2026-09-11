import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import * as crypto from 'crypto';
import {
  CreateParticipantDto,
  UpdateParticipantDto,
  RegisterOnSpotAttendeeDto,
  SecurityCheckInDto,
  BulkImportDto,
} from './dto/teams.dto.js';

@Injectable()
export class ParticipantsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Helper to generate human-readable, unique gate pass codes (e.g. CQ26-7A9B)
   */
  private generateGatePass(prefix = 'CQ26'): string {
    const code = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `${prefix}-${code}`;
  }

  async getParticipants(filter?: {
    eventId?: string;
    instituteId?: string;
    category?: string;
    isCheckedIn?: boolean;
    query?: string;
  }) {
    const where: any = {};

    if (filter?.eventId) where.eventId = filter.eventId;
    if (filter?.instituteId) where.instituteId = filter.instituteId;
    if (filter?.category) where.category = filter.category;
    if (filter?.isCheckedIn !== undefined) where.isCheckedIn = filter.isCheckedIn;

    if (filter?.query) {
      where.OR = [
        { name: { contains: filter.query, mode: 'insensitive' } },
        { rollNumber: { contains: filter.query, mode: 'insensitive' } },
        { gatePassNumber: { contains: filter.query, mode: 'insensitive' } },
      ];
    }

    return this.prisma.participant.findMany({
      where,
      include: {
        institute: { select: { id: true, name: true, shortName: true } },
        teamMembers: {
          include: {
            team: {
              select: {
                id: true,
                name: true,
                sport: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getParticipantById(id: string) {
    const participant = await this.prisma.participant.findUnique({
      where: { id },
      include: {
        institute: true,
        teamMembers: {
          include: {
            team: {
              include: {
                sport: true,
              },
            },
          },
        },
      },
    });

    if (!participant) {
      throw new NotFoundException(`Participant with id "${id}" not found`);
    }

    return participant;
  }

  async createParticipant(dto: CreateParticipantDto) {
    const event = await this.prisma.event.findUnique({ where: { id: dto.eventId } });
    if (!event) throw new NotFoundException(`Event "${dto.eventId}" not found`);

    if (dto.instituteId) {
      const inst = await this.prisma.institute.findUnique({ where: { id: dto.instituteId } });
      if (!inst) throw new NotFoundException(`Institute "${dto.instituteId}" not found`);

      if (dto.rollNumber) {
        const existingParticipant = await this.prisma.participant.findFirst({
          where: {
            eventId: dto.eventId,
            instituteId: dto.instituteId,
            rollNumber: dto.rollNumber,
          },
        });
        if (existingParticipant) {
          throw new ConflictException(
            `Participant with roll number "${dto.rollNumber}" already registered for this institute`,
          );
        }
      }
    }

    const gatePassNumber = this.generateGatePass('CQ26-P');

    return this.prisma.participant.create({
      data: {
        eventId: dto.eventId,
        instituteId: dto.instituteId,
        name: dto.name,
        photographUrl: dto.photographUrl,
        rollNumber: dto.rollNumber,
        gender: dto.gender,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        contactNumber: dto.contactNumber,
        category: dto.category || 'ATHLETE',
        gatePassNumber,
      },
      include: {
        institute: true,
      },
    });
  }

  async updateParticipant(id: string, dto: UpdateParticipantDto) {
    const existing = await this.prisma.participant.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Participant with id "${id}" not found`);
    }

    return this.prisma.participant.update({
      where: { id },
      data: {
        name: dto.name,
        instituteId: dto.instituteId,
        photographUrl: dto.photographUrl,
        rollNumber: dto.rollNumber,
        gender: dto.gender,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        contactNumber: dto.contactNumber,
        category: dto.category,
      },
      include: { institute: true },
    });
  }

  /**
   * On-Spot Registration for Audience, Guests, or unlisted Attendees.
   * Immediately visible to security personnel.
   */
  async registerOnSpotAttendee(dto: RegisterOnSpotAttendeeDto) {
    const event = await this.prisma.event.findUnique({ where: { id: dto.eventId } });
    if (!event) throw new NotFoundException(`Event "${dto.eventId}" not found`);

    let instituteId: string | undefined = undefined;
    if (dto.instituteName) {
      let inst = await this.prisma.institute.findFirst({
        where: { eventId: dto.eventId, name: dto.instituteName },
      });
      if (!inst) {
        inst = await this.prisma.institute.create({
          data: {
            eventId: dto.eventId,
            name: dto.instituteName,
          },
        });
      }
      instituteId = inst.id;
    }

    const prefix = dto.category === 'AUDIENCE' ? 'CQ26-AUD' : 'CQ26-GUEST';
    const gatePassNumber = this.generateGatePass(prefix);

    const attendee = await this.prisma.participant.create({
      data: {
        eventId: dto.eventId,
        instituteId,
        name: dto.name,
        contactNumber: dto.contactNumber,
        category: dto.category || 'AUDIENCE',
        rollNumber: dto.rollNumber,
        gender: dto.gender,
        gatePassNumber,
        isCheckedIn: true, // Automatically marked checked-in upon on-spot gate issuance
        checkedInAt: new Date(),
      },
      include: {
        institute: true,
      },
    });

    return {
      message: 'Attendee registered successfully and updated to security desk',
      attendee,
    };
  }

  /**
   * Dedicated Fast Security Search for Gate Personnel.
   * Matches name, rollNumber, gatePassNumber, or phone number.
   */
  async securitySearch(query: string, eventId?: string) {
    if (!query || query.trim().length === 0) {
      throw new BadRequestException('Search query is required');
    }

    const q = query.trim();

    return this.prisma.participant.findMany({
      where: {
        ...(eventId ? { eventId } : {}),
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { rollNumber: { contains: q, mode: 'insensitive' } },
          { gatePassNumber: { contains: q, mode: 'insensitive' } },
          { contactNumber: { contains: q, mode: 'insensitive' } },
          { institute: { name: { contains: q, mode: 'insensitive' } } },
        ],
      },
      include: {
        institute: { select: { name: true, shortName: true } },
        teamMembers: {
          include: {
            team: {
              select: {
                name: true,
                sport: { select: { name: true } },
              },
            },
          },
        },
      },
      take: 20,
    });
  }

  /**
   * Check in a participant or audience member at the campus security gate.
   */
  async checkInParticipant(dto: SecurityCheckInDto, checkedInByUserId?: string) {
    if (!dto.participantId && !dto.gatePassNumber) {
      throw new BadRequestException('Either participantId or gatePassNumber must be provided');
    }

    const participant = await this.prisma.participant.findFirst({
      where: {
        OR: [
          dto.participantId ? { id: dto.participantId } : {},
          dto.gatePassNumber ? { gatePassNumber: dto.gatePassNumber } : {},
        ],
      },
      include: { institute: true },
    });

    if (!participant) {
      throw new NotFoundException('Participant / Pass not found in system');
    }

    if (participant.isCheckedIn) {
      return {
        status: 'ALREADY_CHECKED_IN',
        message: `${participant.name} was already checked in at ${participant.checkedInAt?.toLocaleTimeString()}`,
        participant,
      };
    }

    const updated = await this.prisma.participant.update({
      where: { id: participant.id },
      data: {
        isCheckedIn: true,
        checkedInAt: new Date(),
      },
      include: { institute: true },
    });

    // Write to audit log for gate traceability
    await this.prisma.auditLog.create({
      data: {
        userId: checkedInByUserId,
        action: 'security.checkin',
        resource: 'Participant',
        resourceId: participant.id,
        newState: {
          gatePassNumber: participant.gatePassNumber,
          category: participant.category,
          checkedInAt: updated.checkedInAt,
        },
      },
    });

    return {
      status: 'CHECK_IN_SUCCESS',
      message: `Welcome, ${participant.name}! Verified & Checked In.`,
      participant: updated,
    };
  }

  /**
   * Bulk Registration Import (e.g. from parsed Excel/CSV data)
   */
  async bulkImport(dto: BulkImportDto) {
    const event = await this.prisma.event.findUnique({ where: { id: dto.eventId } });
    if (!event) throw new NotFoundException(`Event "${dto.eventId}" not found`);

    let importedCount = 0;
    const errors: Array<{ row: number; error: string }> = [];

    for (let i = 0; i < dto.rows.length; i++) {
      const row = dto.rows[i];

      try {
        if (!row.name || !row.college) {
          errors.push({ row: i + 1, error: 'Name and College are required' });
          continue;
        }

        // 1. Find or create Institute
        let institute = await this.prisma.institute.findFirst({
          where: {
            eventId: dto.eventId,
            OR: [{ name: row.college }, { shortName: row.college }],
          },
        });

        if (!institute) {
          institute = await this.prisma.institute.create({
            data: {
              eventId: dto.eventId,
              name: row.college,
              shortName: row.college.length <= 10 ? row.college : undefined,
            },
          });
        }

        // 2. Find or create Sport if provided
        let sport: any = null;
        if (row.sport) {
          sport = await this.prisma.sport.findFirst({
            where: { eventId: dto.eventId, name: row.sport },
          });
          if (!sport) {
            sport = await this.prisma.sport.create({
              data: { eventId: dto.eventId, name: row.sport },
            });
          }
        }

        // 3. Find or create Team if sport and institute are known
        let team: any = null;
        if (sport && institute) {
          const teamName = `${institute.shortName || institute.name} ${sport.name}`;
          team = await this.prisma.team.findFirst({
            where: {
              eventId: dto.eventId,
              instituteId: institute.id,
              sportId: sport.id,
            },
          });
          if (!team) {
            team = await this.prisma.team.create({
              data: {
                eventId: dto.eventId,
                instituteId: institute.id,
                sportId: sport.id,
                name: teamName,
              },
            });
          }
        }

        // 4. Create or find Participant
        let participant: any = null;
        if (row.rollNumber) {
          participant = await this.prisma.participant.findFirst({
            where: {
              eventId: dto.eventId,
              instituteId: institute.id,
              rollNumber: row.rollNumber,
            },
          });
        }

        if (!participant) {
          participant = await this.prisma.participant.create({
            data: {
              eventId: dto.eventId,
              instituteId: institute.id,
              name: row.name,
              rollNumber: row.rollNumber,
              gender: row.gender,
              contactNumber: row.contactNumber,
              category: row.category || 'ATHLETE',
              gatePassNumber: this.generateGatePass('CQ26-P'),
            },
          });
        }

        // 5. Link participant to team if applicable
        if (team && participant) {
          await this.prisma.teamMember.upsert({
            where: {
              teamId_participantId: {
                teamId: team.id,
                participantId: participant.id,
              },
            },
            update: {
              role: row.role || 'PLAYER',
            },
            create: {
              teamId: team.id,
              participantId: participant.id,
              role: row.role || 'PLAYER',
            },
          });
        }

        importedCount++;
      } catch (err: any) {
        errors.push({ row: i + 1, error: err.message || 'Processing error' });
      }
    }

    return {
      success: true,
      totalRows: dto.rows.length,
      importedCount,
      errors,
    };
  }
}
