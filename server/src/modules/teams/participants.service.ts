import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import * as crypto from 'crypto';
import {
  encryptField,
  decryptField,
  blindIndex,
} from '../../common/crypto/field-crypto.js';
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

  /**
   * rollNumber, contactNumber and idDocumentUrl are encrypted at rest
   * (`encryptField`) — every response that reaches an authenticated organizer
   * view must decrypt them first, otherwise the UI just shows ciphertext.
   */
  private decryptParticipant<
    T extends {
      rollNumber?: string | null;
      contactNumber?: string | null;
      idDocumentUrl?: string | null;
    },
  >(p: T): T {
    return {
      ...p,
      rollNumber: decryptField(p.rollNumber) ?? p.rollNumber,
      contactNumber: decryptField(p.contactNumber) ?? p.contactNumber,
      idDocumentUrl: decryptField(p.idDocumentUrl) ?? p.idDocumentUrl,
    };
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
    if (filter?.isCheckedIn !== undefined)
      where.isCheckedIn = filter.isCheckedIn;

    const participants = await this.prisma.participant.findMany({
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

    // rollNumber is encrypted at rest and can't be substring-matched in SQL,
    // so text search is applied here against the decrypted value.
    const decrypted = participants.map((p) => this.decryptParticipant(p));
    if (!filter?.query) return decrypted;
    const q = filter.query.toLowerCase();
    return decrypted.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.rollNumber || '').toLowerCase().includes(q) ||
        (p.gatePassNumber || '').toLowerCase().includes(q),
    );
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

    return this.decryptParticipant(participant);
  }

  async createParticipant(dto: CreateParticipantDto) {
    const event = await this.prisma.event.findUnique({
      where: { id: dto.eventId },
    });
    if (!event) throw new NotFoundException(`Event "${dto.eventId}" not found`);

    if (dto.instituteId) {
      const inst = await this.prisma.institute.findUnique({
        where: { id: dto.instituteId },
      });
      if (!inst)
        throw new NotFoundException(`Institute "${dto.instituteId}" not found`);

      if (dto.rollNumber) {
        const existingParticipant = await this.prisma.participant.findFirst({
          where: {
            eventId: dto.eventId,
            instituteId: dto.instituteId,
            rollNumberHash: blindIndex(dto.rollNumber),
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
        rollNumber: encryptField(dto.rollNumber),
        rollNumberHash: blindIndex(dto.rollNumber),
        gender: dto.gender,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        contactNumber: encryptField(dto.contactNumber),
        category: dto.category || 'ATHLETE',
        gatePassNumber,
      },
      include: {
        institute: true,
      },
    });
  }

  async updateParticipant(id: string, dto: UpdateParticipantDto) {
    const existing = await this.prisma.participant.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Participant with id "${id}" not found`);
    }

    return this.prisma.participant.update({
      where: { id },
      data: {
        name: dto.name,
        instituteId: dto.instituteId,
        photographUrl: dto.photographUrl,
        rollNumber:
          dto.rollNumber !== undefined
            ? encryptField(dto.rollNumber)
            : undefined,
        rollNumberHash:
          dto.rollNumber !== undefined ? blindIndex(dto.rollNumber) : undefined,
        gender: dto.gender,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        contactNumber:
          dto.contactNumber !== undefined
            ? encryptField(dto.contactNumber)
            : undefined,
        category: dto.category,
        isFlagged: dto.isFlagged,
        flagReason: dto.isFlagged === false ? null : dto.flagReason,
        flaggedAt:
          dto.isFlagged === undefined
            ? undefined
            : dto.isFlagged
              ? new Date()
              : null,
      },
      include: { institute: true },
    });
  }

  /**
   * On-Spot Registration for Audience, Guests, or unlisted Attendees.
   * Immediately visible to security personnel.
   */
  async registerOnSpotAttendee(dto: RegisterOnSpotAttendeeDto) {
    if (!dto.name?.trim()) {
      throw new BadRequestException('Name is required.');
    }
    // India-format WhatsApp/mobile number: optional +91, then a 6-9 leading digit and 9 more digits.
    const phoneDigits = (dto.contactNumber || '').replace(/[\s-]/g, '');
    if (!/^(\+91)?[6-9]\d{9}$/.test(phoneDigits)) {
      throw new BadRequestException(
        'A valid 10-digit WhatsApp/mobile number is required (e.g. +91 98765 43210).',
      );
    }
    if (!dto.photographUrl?.trim()) {
      throw new BadRequestException('A photograph of the visitor is required.');
    }
    if (!dto.idDocumentUrl?.trim()) {
      throw new BadRequestException(
        'A photo of a government or college ID is required.',
      );
    }

    const event = await this.prisma.event.findUnique({
      where: { id: dto.eventId },
    });
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
        contactNumber: encryptField(dto.contactNumber),
        category: dto.category || 'AUDIENCE',
        rollNumber: encryptField(dto.rollNumber),
        rollNumberHash: blindIndex(dto.rollNumber),
        gender: dto.gender,
        photographUrl: dto.photographUrl,
        idDocumentUrl: encryptField(dto.idDocumentUrl),
        gatePassNumber,
        isCheckedIn: false,
        checkedInAt: null,
      },
      include: {
        institute: true,
      },
    });

    return {
      message: 'Attendee registered successfully and updated to security desk',
      attendee: {
        id: attendee.id,
        name: attendee.name,
        gatePassNumber: attendee.gatePassNumber,
        category: attendee.category,
        isCheckedIn: attendee.isCheckedIn,
      },
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
    const qLower = q.toLowerCase();

    // rollNumber and contactNumber are encrypted at rest, so they can't be
    // substring-matched in SQL. Narrow to name/gatePassNumber/institute in
    // the DB query, then widen the candidate set with an exact roll-number
    // blind-index match, and finally decrypt-filter in app memory so a
    // partial phone/roll-number search still works.
    const candidates = await this.prisma.participant.findMany({
      where: {
        ...(eventId ? { eventId } : {}),
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { gatePassNumber: { contains: q, mode: 'insensitive' } },
          { institute: { name: { contains: q, mode: 'insensitive' } } },
          { rollNumberHash: blindIndex(q) },
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
      take: 200,
    });

    if (candidates.length >= 20)
      return candidates.slice(0, 20).map((p) => this.decryptParticipant(p));

    // Broaden with a decrypt-filter pass over the event's roster so partial
    // roll-number/phone-number queries still surface a match.
    const rest = await this.prisma.participant.findMany({
      where: {
        ...(eventId ? { eventId } : {}),
        id: { notIn: candidates.map((c) => c.id) },
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
    });

    const decryptMatches = rest.filter((p) => {
      const rollNumber = (decryptField(p.rollNumber) || '').toLowerCase();
      const contactNumber = (decryptField(p.contactNumber) || '').toLowerCase();
      return rollNumber.includes(qLower) || contactNumber.includes(qLower);
    });

    return [...candidates, ...decryptMatches]
      .slice(0, 20)
      .map((p) => this.decryptParticipant(p));
  }

  /**
   * Check in a participant or audience member at the campus security gate.
   */
  async checkInParticipant(
    dto: SecurityCheckInDto,
    checkedInByUserId?: string,
  ) {
    return this.recordGateMovement(
      { ...dto, direction: 'ENTRY' },
      checkedInByUserId,
    );
  }

  async recordGateMovement(
    dto: SecurityCheckInDto & { direction: 'ENTRY' | 'EXIT' },
    checkedInByUserId?: string,
  ) {
    if (!dto.participantId && !dto.gatePassNumber) {
      throw new BadRequestException(
        'Either participantId or gatePassNumber must be provided',
      );
    }

    const participant = await this.prisma.participant.findFirst({
      where: {
        ...(dto.participantId ? { id: dto.participantId } : {}),
        ...(dto.gatePassNumber ? { gatePassNumber: dto.gatePassNumber } : {}),
      },
      include: { institute: true, currentVenue: true },
    });

    if (!participant) {
      throw new NotFoundException('Participant / Pass not found in system');
    }

    const direction = dto.direction?.toUpperCase();
    if (!['ENTRY', 'EXIT'].includes(direction))
      throw new BadRequestException('Direction must be ENTRY or EXIT.');
    if (direction === 'ENTRY' && participant.isFlagged)
      throw new BadRequestException(
        'Participant is flagged. Resolve the flag before entry.',
      );
    if (direction === 'ENTRY' && participant.isCheckedIn) {
      return {
        status: 'ALREADY_CHECKED_IN',
        message: `${participant.name} was already checked in at ${participant.checkedInAt?.toLocaleTimeString()}`,
        participant,
      };
    }
    if (direction === 'EXIT' && !participant.isCheckedIn) {
      return {
        status: 'ALREADY_CHECKED_OUT',
        message: `${participant.name} is already marked outside.`,
        participant,
      };
    }
    if (dto.venueId) {
      const venue = await this.prisma.venue.findUnique({
        where: { id: dto.venueId },
      });
      if (!venue || venue.eventId !== participant.eventId)
        throw new BadRequestException(
          'Select a venue from the participant event.',
        );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.participant.update({
        where: { id: participant.id },
        data: {
          isCheckedIn: direction === 'ENTRY',
          checkedInAt:
            direction === 'ENTRY' ? new Date() : participant.checkedInAt,
          currentVenueId: direction === 'ENTRY' ? dto.venueId || null : null,
        },
        include: { institute: true, currentVenue: true },
      });
      await tx.gateMovement.create({
        data: {
          participantId: participant.id,
          venueId: dto.venueId || participant.currentVenueId,
          direction,
          recordedBy: checkedInByUserId,
        },
      });
      return changed;
    });

    // Write to audit log for gate traceability
    await this.prisma.auditLog.create({
      data: {
        userId: checkedInByUserId,
        action: direction === 'ENTRY' ? 'security.entry' : 'security.exit',
        resource: 'Participant',
        resourceId: participant.id,
        newState: {
          gatePassNumber: participant.gatePassNumber,
          category: participant.category,
          direction,
          venueId: dto.venueId || participant.currentVenueId,
          recordedAt: new Date(),
        },
      },
    });

    return {
      status: direction === 'ENTRY' ? 'CHECK_IN_SUCCESS' : 'CHECK_OUT_SUCCESS',
      message: `${participant.name} ${direction === 'ENTRY' ? 'entered' : 'exited'} successfully.`,
      participant: updated,
    };
  }

  /**
   * Bulk Registration Import (e.g. from parsed Excel/CSV data)
   */
  async bulkImport(dto: BulkImportDto, userId?: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: dto.eventId },
    });
    if (!event) throw new NotFoundException(`Event "${dto.eventId}" not found`);

    const seen = new Set<string>();
    for (let i = 0; i < dto.rows.length; i++) {
      const row = dto.rows[i];
      if (
        !row.name?.trim() ||
        !row.college?.trim() ||
        !row.rollNumber?.trim()
      ) {
        throw new BadRequestException(
          `Row ${i + 1}: name, college and rollNumber are required`,
        );
      }
      const identity = `${row.college.trim().toLowerCase()}|${row.rollNumber.trim().toLowerCase()}|${row.sport?.trim().toLowerCase() || ''}`;
      if (seen.has(identity))
        throw new BadRequestException(
          `Row ${i + 1}: duplicate participant and sport`,
        );
      seen.add(identity);
      if (
        row.sport &&
        !(await this.prisma.sport.findFirst({
          where: { eventId: dto.eventId, name: row.sport },
        }))
      ) {
        throw new BadRequestException(
          `Row ${i + 1}: create the sport "${row.sport}" before importing`,
        );
      }
    }
    if (dto.dryRun)
      return {
        success: true,
        dryRun: true,
        totalRows: dto.rows.length,
        importedCount: 0,
        errors: [],
      };
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${dto.eventId} FOR UPDATE`;
        let importedCount = 0;
        const errors: Array<{ row: number; error: string }> = [];

        for (let i = 0; i < dto.rows.length; i++) {
          const row = dto.rows[i];

          try {
            if (!row.name || !row.college) {
              errors.push({
                row: i + 1,
                error: 'Name and College are required',
              });
              continue;
            }

            // 1. Find or create Institute
            let institute = await tx.institute.findFirst({
              where: {
                eventId: dto.eventId,
                OR: [{ name: row.college }, { shortName: row.college }],
              },
            });

            if (!institute) {
              institute = await tx.institute.create({
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
              sport = await tx.sport.findFirst({
                where: { eventId: dto.eventId, name: row.sport },
              });
              if (!sport) {
                sport = await tx.sport.create({
                  data: { eventId: dto.eventId, name: row.sport },
                });
              }
            }

            // 3. Find or create Team if sport and institute are known.
            // Most sports field exactly one team per institute, so the row's
            // `team` label is normally blank and institute+sport alone
            // identifies the team. Some sports (e.g. E-Sports, with separate
            // BGMI/Free Fire/Valorant rosters) let one institute field
            // several teams in the same sport — `team` disambiguates those,
            // so it's included in both the lookup and the generated name.
            let team: any = null;
            if (sport && institute) {
              const squad = row.team?.trim();
              const teamName = squad
                ? `${institute.shortName || institute.name} ${sport.name} (${squad})`
                : `${institute.shortName || institute.name} ${sport.name}`;
              team = await tx.team.findFirst({
                where: {
                  eventId: dto.eventId,
                  instituteId: institute.id,
                  sportId: sport.id,
                  name: teamName,
                },
              });
              if (!team) {
                team = await tx.team.create({
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
              participant = await tx.participant.findFirst({
                where: {
                  eventId: dto.eventId,
                  instituteId: institute.id,
                  rollNumberHash: blindIndex(row.rollNumber),
                },
              });
            }

            if (!participant) {
              participant = await tx.participant.create({
                data: {
                  eventId: dto.eventId,
                  instituteId: institute.id,
                  name: row.name,
                  rollNumber: encryptField(row.rollNumber),
                  rollNumberHash: blindIndex(row.rollNumber),
                  gender: row.gender,
                  contactNumber: encryptField(row.contactNumber),
                  category: row.category || 'ATHLETE',
                  gatePassNumber: this.generateGatePass('CQ26-P'),
                },
              });
            }

            // 5. Link participant to team if applicable
            if (team && participant) {
              await tx.teamMember.upsert({
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
          } catch {
            throw new BadRequestException(
              `Row ${i + 1}: import failed; no rows were saved`,
            );
          }
        }

        await tx.auditLog.create({
          data: {
            userId,
            action: 'participants.import',
            resource: 'Event',
            resourceId: dto.eventId,
            newState: { totalRows: dto.rows.length, importedCount },
          },
        });
        return {
          success: true,
          totalRows: dto.rows.length,
          importedCount,
          errors,
        };
      },
      { timeout: 60000 },
    );
  }
}
