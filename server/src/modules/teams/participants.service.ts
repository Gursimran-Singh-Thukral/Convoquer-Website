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

// Sports seeded as separate Men's/Women's records (see seed.ts) — a bare
// "Badminton" in an import row isn't itself a Sport name and must be
// combined with the row's gender to resolve which one. Sports not in this
// set (Cricket, Football, Athletics, Weight Lifting, E-Sports, …) field one
// shared team regardless of gender, so their name is used as-is.
const GENDER_SPLIT_SPORTS = new Set([
  'badminton',
  'basketball',
  'chess',
  'table tennis',
  'volleyball',
]);

@Injectable()
export class ParticipantsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolves an import row's `sport` (+ `gender`) to the actual seeded Sport
   * name. A row that already spells out "Badminton (Men)" passes through
   * unchanged; a bare "Badminton" is combined with `gender` since that's how
   * the source data (and scripts/convert-convoquer-teams.py) represent it.
   */
  private resolveSportName(
    sportRaw: string | undefined,
    genderRaw: string | undefined,
    rowNumber: number,
  ): string | undefined {
    const sport = sportRaw?.trim();
    if (!sport) return undefined;
    if (!GENDER_SPLIT_SPORTS.has(sport.toLowerCase())) return sport;

    const gender = genderRaw?.trim().toUpperCase();
    if (gender === 'FEMALE' || gender === 'WOMEN' || gender === 'W')
      return `${sport} (Women)`;
    if (gender === 'MALE' || gender === 'MEN' || gender === 'M')
      return `${sport} (Men)`;
    throw new BadRequestException(
      `Row ${rowNumber}: "${sport}" needs a gender (MALE or FEMALE) to tell the Men's and Women's teams apart`,
    );
  }

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

  /**
   * Walk-in visitors' photograph and ID picture are visible to the sole admin
   * only (see getWalkIns); every other listing blanks them.
   */
  private redactWalkIn<
    T extends {
      gatePassNumber?: string | null;
      photographUrl?: string | null;
      idDocumentUrl?: string | null;
    },
  >(p: T, allowSensitive: boolean): T {
    const walkIn = /^CQ26-(AUD|GUEST)/.test(p.gatePassNumber ?? '');
    return walkIn && !allowSensitive
      ? { ...p, photographUrl: null, idDocumentUrl: null }
      : p;
  }

  async getParticipants(
    filter?: {
      eventId?: string;
      instituteId?: string;
      category?: string;
      isCheckedIn?: boolean;
      query?: string;
    },
    allowSensitive = false,
  ) {
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
    const decrypted = participants.map((p) =>
      this.redactWalkIn(this.decryptParticipant(p), allowSensitive),
    );
    if (!filter?.query) return decrypted;
    const q = filter.query.toLowerCase();
    return decrypted.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.rollNumber || '').toLowerCase().includes(q) ||
        (p.gatePassNumber || '').toLowerCase().includes(q),
    );
  }

  /**
   * Walk-in passes: visitors who registered themselves at the gate. Their pass
   * numbers carry the CQ26-AUD / CQ26-GUEST prefix (players' are random hex).
   * Returns the complete record, including the decrypted phone number and the
   * photograph / ID picture, for the pass-viewing screen.
   */
  async getWalkIns(filter?: { query?: string; category?: string }) {
    const rows = await this.prisma.participant.findMany({
      where: {
        OR: [
          { gatePassNumber: { startsWith: 'CQ26-AUD' } },
          { gatePassNumber: { startsWith: 'CQ26-GUEST' } },
        ],
        ...(filter?.category ? { category: filter.category } : {}),
      },
      include: {
        institute: { select: { id: true, name: true, shortName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    const all = rows.map((p) => this.decryptParticipant(p));
    const q = filter?.query?.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.gatePassNumber || '').toLowerCase().includes(q) ||
        (p.contactNumber || '').toLowerCase().includes(q) ||
        (p.rollNumber || '').toLowerCase().includes(q) ||
        (p.institute?.name || '').toLowerCase().includes(q) ||
        (p.otherInstitute || '').toLowerCase().includes(q),
    );
  }

  /**
   * Puts a participant into their college's team for a sport, creating that
   * team ("<college> <sport>") if it does not exist yet. E-Sports is excluded:
   * its teams are created by the coordinator on the result form.
   */
  async assignSport(participantId: string, sportId: string, userId: string) {
    const p = await this.prisma.participant.findUnique({
      where: { id: participantId },
      include: { institute: true },
    });
    if (!p) throw new NotFoundException('Participant not found');
    const sport = await this.prisma.sport.findUnique({
      where: { id: sportId },
    });
    if (!sport || sport.eventId !== p.eventId)
      throw new BadRequestException('Choose a sport of this event');
    if (/e-?sports/i.test(sport.name))
      throw new BadRequestException(
        'E-Sports teams are created by the E-Sports coordinator when entering results',
      );
    if (!p.instituteId || !p.institute)
      throw new BadRequestException(
        'This person has no college, so a team cannot be chosen',
      );
    const name = `${p.institute.shortName || p.institute.name} ${sport.name}`;
    let team = await this.prisma.team.findFirst({
      where: { eventId: p.eventId, instituteId: p.instituteId, sportId, name },
    });
    if (!team)
      team = await this.prisma.team.create({
        data: { eventId: p.eventId, instituteId: p.instituteId, sportId, name },
      });
    await this.prisma.teamMember.upsert({
      where: { teamId_participantId: { teamId: team.id, participantId } },
      update: {},
      create: { teamId: team.id, participantId, role: 'PLAYER' },
    });
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'participant.assign-sport',
        resource: 'Participant',
        resourceId: participantId,
        newState: { sport: sport.name, team: team.name },
      },
    });
    return team;
  }

  /** Takes a participant out of one team (the person is not deleted). */
  async removeFromTeam(participantId: string, teamId: string, userId: string) {
    const res = await this.prisma.teamMember.deleteMany({
      where: { participantId, teamId },
    });
    if (!res.count)
      throw new NotFoundException('That team membership does not exist');
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'participant.remove-from-team',
        resource: 'Participant',
        resourceId: participantId,
        newState: { teamId },
      },
    });
    return { removed: true };
  }

  /** Removes a participant, their pass, team memberships and gate movements. */
  async deleteParticipant(id: string, userId: string) {
    const p = await this.prisma.participant.findUnique({
      where: { id },
      include: { institute: true },
    });
    if (!p) throw new NotFoundException(`Participant "${id}" not found`);
    // Audit trail keeps what was removed, but no personal contact data.
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'participant.delete',
        resource: 'Participant',
        resourceId: id,
        previousState: {
          name: p.name,
          category: p.category,
          gatePassNumber: p.gatePassNumber,
          institute: p.institute?.name ?? null,
          isCheckedIn: p.isCheckedIn,
        },
      },
    });
    await this.prisma.participant.delete({ where: { id } });
    return { deleted: true, id, name: p.name };
  }

  async getParticipantById(id: string, allowSensitive = false) {
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

    return this.redactWalkIn(
      this.decryptParticipant(participant),
      allowSensitive,
    );
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

    // A walk-in's college is picked from the participating institutes. It is only
    // ever LOOKED UP here — a visitor can no longer create an institute (that is
    // what used to inflate the "participating institutes" count).
    let instituteId: string | undefined = undefined;
    if (dto.instituteId) {
      const inst = await this.prisma.institute.findUnique({
        where: { id: dto.instituteId },
      });
      if (!inst || inst.eventId !== dto.eventId)
        throw new BadRequestException('Choose a college from the list.');
      instituteId = inst.id;
    } else if (dto.instituteName) {
      const inst = await this.prisma.institute.findFirst({
        where: {
          eventId: dto.eventId,
          name: { equals: dto.instituteName.trim(), mode: 'insensitive' },
        },
      });
      instituteId = inst?.id;
    }

    const prefix = dto.category === 'AUDIENCE' ? 'CQ26-AUD' : 'CQ26-GUEST';
    const gatePassNumber = this.generateGatePass(prefix);

    const attendee = await this.prisma.participant.create({
      data: {
        eventId: dto.eventId,
        instituteId,
        otherInstitute: instituteId
          ? undefined
          : dto.otherInstitute?.trim().slice(0, 120) || undefined,
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
      // A participant is one event-level person who may belong to several
      // sport/game squads. Only reject an exact duplicate membership row;
      // including the team label also supports multiple games represented as
      // squads under one parent sport (for example BGMI and Valorant).
      const identity = `${row.college.trim().toLowerCase()}|${row.rollNumber.trim().toLowerCase()}|${row.sport?.trim().toLowerCase() || ''}|${row.team?.trim().toLowerCase() || ''}`;
      if (seen.has(identity))
        throw new BadRequestException(
          `Row ${i + 1}: duplicate participant, sport and team`,
        );
      seen.add(identity);
      const resolvedSport = this.resolveSportName(row.sport, row.gender, i + 1);
      if (
        resolvedSport &&
        !(await this.prisma.sport.findFirst({
          where: { eventId: dto.eventId, name: resolvedSport },
        }))
      ) {
        throw new BadRequestException(
          `Row ${i + 1}: create the sport "${resolvedSport}" before importing`,
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
            const resolvedSportName = this.resolveSportName(
              row.sport,
              row.gender,
              i + 1,
            );
            if (resolvedSportName) {
              sport = await tx.sport.findFirst({
                where: { eventId: dto.eventId, name: resolvedSportName },
              });
              if (!sport) {
                sport = await tx.sport.create({
                  data: { eventId: dto.eventId, name: resolvedSportName },
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
            // E-Sports teams are never created by imports: coordinators add
            // every E-Sports team themselves, so the participant stays team-less.
            if (sport && institute && !/e-?sports/i.test(sport.name)) {
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

            // 4. Create, or overwrite if this roll number already exists.
            // Re-importing the same sheet (with corrections) should land
            // those corrections, not silently keep the stale row — but a
            // field left blank in this row doesn't erase a value the
            // participant already has (e.g. one filled in later via
            // self-registration), so only fields actually present overwrite.
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

            if (participant) {
              participant = await tx.participant.update({
                where: { id: participant.id },
                data: {
                  name: row.name,
                  gender: row.gender || undefined,
                  contactNumber: row.contactNumber
                    ? encryptField(row.contactNumber)
                    : undefined,
                  category: row.category || undefined,
                },
              });
            } else {
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
