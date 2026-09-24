import { PrismaService } from '../../database/prisma.service.js';
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NotificationsService } from '../notifications/notifications.service.js';
import {
  departmentAllowed,
  isDepartmentHead,
  HEAD_ROLE_DEPARTMENT,
} from '../../common/department.js';
import {
  CreateVolunteerDto,
  UpdateVolunteerDto,
  ImportVolunteersDto,
  VolunteerCheckInDto,
} from './dto/volunteers.dto.js';

export interface VolunteerRecord {
  id: string;
  volunteerCode: string; // e.g. "VOL-2026-001"
  name: string;
  email: string;
  contactNumber?: string;
  department: string;
  userId?: string | null;
  shift: string;
  venueId?: string;
  /** Denormalized venue name (matches Venue.name), used to key the public-facing point-of-contact lookup on /live. */
  venueName?: string | null;
  status: string;
  assignedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicVolunteerRecord {
  name: string;
  department: string;
  venueName?: string | null;
}

@Injectable()
export class VolunteersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getVolunteers(filters?: {
    department?: string;
    shift?: string;
    status?: string;
    venueId?: string;
    venueName?: string | null;
  }) {
    let list = await this.prisma.volunteer.findMany({
      include: { currentVenue: { select: { id: true, name: true } } },
    });

    if (filters?.department) {
      const dep = filters.department.toLowerCase();
      list = list.filter((v) => v.department.toLowerCase().includes(dep));
    }

    if (filters?.shift) {
      const shift = filters.shift.toUpperCase();
      list = list.filter((v) => v.shift.toUpperCase() === shift);
    }

    if (filters?.status) {
      const st = filters.status.toUpperCase();
      list = list.filter((v) => v.status.toUpperCase() === st);
    }

    if (filters?.venueId) {
      list = list.filter((v) => v.venueId === filters.venueId);
    }

    if (filters?.venueName) {
      const name = filters.venueName.toLowerCase();
      list = list.filter((v) => v.venueName?.toLowerCase() === name);
    }

    return list;
  }

  /**
   * Public, field-limited roster (no email/contact number) for the audience-facing
   * "point of contact" display on /live — deliberately excludes anything guarded
   * behind `volunteer.manage` in the full record.
   */
  async getPublicVolunteers(
    venueName?: string,
  ): Promise<PublicVolunteerRecord[]> {
    const list = await this.getVolunteers({ venueName, status: 'ACTIVE' });
    return list.map((v) => ({
      name: v.name,
      department: v.department,
      venueName: v.venueName,
    }));
  }

  /**
   * Which departments a caller manages as a Head/Coordinator, for scoping the
   * roster view (see getRosterForUser). Mirrors OperationsTasksService's
   * head-department resolution — kept as a small, separate copy rather than a
   * shared dependency to avoid a circular module import between Volunteers and
   * OperationsTasks (OperationsTasksModule already depends on VolunteersModule).
   */
  private async getManagedDepartments(
    userId: string,
  ): Promise<{ global: boolean; departments: string[] }> {
    const [roles, volunteer] = await Promise.all([
      this.prisma.userRole.findMany({
        where: {
          userId,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        include: { role: true },
      }),
      this.prisma.volunteer.findUnique({ where: { userId } }),
    ]);
    const roleNames = roles.map((item) => item.role.name);
    if (roleNames.some((name) => ['CONVENER', 'CO_CONVENER'].includes(name)))
      return { global: true, departments: [] };

    const departments = new Set<string>(
      roles
        .filter((item) => isDepartmentHead(item.role.name) && item.departmentId)
        .map((item) => item.departmentId!) as string[],
    );
    // A Head's own Volunteer.department (set via RBAC role assignment, which
    // enforces the role's canonical department) is authoritative when present
    // — falling back to the hardcoded per-role default only for Heads who
    // don't have a department recorded yet.
    const isHead = roleNames.some((name) => isDepartmentHead(name));
    if (isHead && volunteer?.department) departments.add(volunteer.department);
    if (isHead && !departments.size) {
      for (const roleName of roleNames)
        if (HEAD_ROLE_DEPARTMENT[roleName])
          departments.add(HEAD_ROLE_DEPARTMENT[roleName]);
    }
    const sportIds = roles
      .filter((item) => item.role.name === 'SPORTS_COORDINATOR' && item.sportId)
      .map((item) => item.sportId!);
    if (sportIds.length) {
      const sports = await this.prisma.sport.findMany({
        where: { id: { in: sportIds } },
        select: { name: true },
      });
      departments.add('Sports');
      sports.forEach((sport) => departments.add(sport.name));
    }
    return { global: false, departments: [...departments] };
  }

  /**
   * The roster a Head/Coordinator (or Convener/Co-Convener) is allowed to see:
   * their own department's volunteers only, never the whole org's. Callers with
   * no department-managing role get an empty roster — a plain volunteer should
   * never see a colleague list, only their own profile.
   */
  async getRosterForUser(userId: string) {
    const access = await this.getManagedDepartments(userId);
    if (!access.global && !access.departments.length) return [];
    const volunteers = await this.getVolunteers({});
    if (access.global) return volunteers;
    return volunteers.filter((volunteer) =>
      departmentAllowed(volunteer.department, access.departments),
    );
  }

  async getVolunteerById(id: string) {
    const vol = await this.prisma.volunteer.findFirst({
      where: { OR: [{ id }, { volunteerCode: id }] },
    });
    if (!vol) {
      throw new NotFoundException(
        `Volunteer with ID or code "${id}" not found`,
      );
    }
    return vol;
  }

  /**
   * Backend Only: Register and onboard a new Volunteer.
   */
  async createVolunteer(dto: CreateVolunteerDto, userId?: string) {
    const codeNum = randomUUID().slice(0, 8).toUpperCase();
    const newVol: VolunteerRecord = {
      id: randomUUID(),
      volunteerCode: `VOL-2026-${codeNum}`,
      name: dto.name.trim(),
      email: dto.email.trim().toLowerCase(),
      contactNumber: dto.contactNumber?.trim(),
      department: dto.department?.trim() || 'General Operations',
      shift: (dto.shift || 'MORNING').toUpperCase(),
      venueId: dto.venueId,
      venueName: dto.venueName,
      status: (dto.status || 'ACTIVE').toUpperCase(),
      assignedBy: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const created = await this.prisma.volunteer.create({ data: newVol });
    if (created.venueName) {
      void this.notificationsService.sendVenueAssignment({
        contactNumber: created.contactNumber,
        volunteerName: created.name,
        venueName: created.venueName,
      });
    }
    return created;
  }

  /**
   * Backend Only: Update volunteer details or reassign duty.
   */
  async updateVolunteer(id: string, dto: UpdateVolunteerDto, _userId?: string) {
    const current = await this.prisma.volunteer.findFirst({
      where: { OR: [{ id }, { volunteerCode: id }] },
    });
    if (!current) {
      throw new NotFoundException(`Volunteer with ID "${id}" not found`);
    }

    const updated = {
      ...current,
      name: dto.name !== undefined ? dto.name.trim() : current.name,
      email:
        dto.email !== undefined
          ? dto.email.trim().toLowerCase()
          : current.email,
      contactNumber:
        dto.contactNumber !== undefined
          ? dto.contactNumber.trim()
          : current.contactNumber,
      department:
        dto.department !== undefined
          ? dto.department.trim()
          : current.department,
      shift: dto.shift !== undefined ? dto.shift.toUpperCase() : current.shift,
      venueId: dto.venueId !== undefined ? dto.venueId : current.venueId,
      venueName:
        dto.venueName !== undefined ? dto.venueName : current.venueName,
      status:
        dto.status !== undefined ? dto.status.toUpperCase() : current.status,
      updatedAt: new Date(),
    };

    const result = await this.prisma.volunteer.update({
      where: { id: current.id },
      data: updated,
    });
    const venueChanged =
      dto.venueName !== undefined && dto.venueName !== current.venueName;
    if (venueChanged && result.venueName) {
      void this.notificationsService.sendVenueAssignment({
        contactNumber: result.contactNumber,
        volunteerName: result.name,
        venueName: result.venueName,
      });
    }
    return result;
  }

  /**
   * Backend Only: Remove volunteer record.
   */
  async deleteVolunteer(
    id: string,
    _userId?: string,
  ): Promise<{ success: boolean; id: string }> {
    const current = await this.prisma.volunteer.findFirst({
      where: { OR: [{ id }, { volunteerCode: id }] },
    });
    if (!current) {
      throw new NotFoundException(`Volunteer with ID "${id}" not found`);
    }

    await this.prisma.volunteer.delete({ where: { id: current.id } });
    return { success: true, id };
  }
  /**
   * Self-service check-in: the logged-in volunteer reports the venue they're
   * currently at, so a Convener/Co-Convener/department Head can see live "where
   * is this volunteer" without any GPS tracking.
   */
  async checkIn(userId: string, dto: VolunteerCheckInDto) {
    const volunteer = await this.prisma.volunteer.findUnique({
      where: { userId },
    });
    if (!volunteer) {
      throw new NotFoundException(
        'No volunteer record is linked to this account',
      );
    }
    const venue = await this.prisma.venue.findUnique({
      where: { id: dto.venueId },
    });
    if (!venue) {
      throw new NotFoundException(`Venue with ID "${dto.venueId}" not found`);
    }
    return this.prisma.volunteer.update({
      where: { id: volunteer.id },
      data: { currentVenueId: venue.id, checkedInAt: new Date() },
    });
  }

  async importVolunteers(dto: ImportVolunteersDto, userId: string) {
    if (!dto.rows.length || dto.rows.length > 1000)
      throw new BadRequestException('Import between 1 and 1000 volunteers');
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`LOCK TABLE "Volunteer" IN SHARE ROW EXCLUSIVE MODE`;
        const seen = new Set<string>();
        let created = 0,
          updated = 0;
        for (let index = 0; index < dto.rows.length; index++) {
          const row = dto.rows[index];
          const email = row.email.trim().toLowerCase();
          if (seen.has(email))
            throw new BadRequestException(
              `Row ${index + 2}: duplicate email in this import`,
            );
          seen.add(email);
          const shift = row.shift?.trim().toUpperCase(),
            status = row.status?.trim().toUpperCase();
          if (
            shift &&
            !['MORNING', 'AFTERNOON', 'EVENING', 'NIGHT'].includes(shift)
          )
            throw new BadRequestException(`Row ${index + 2}: invalid shift`);
          if (status && !['ACTIVE', 'ON_BREAK', 'RELIEVED'].includes(status))
            throw new BadRequestException(`Row ${index + 2}: invalid status`);
          let venueId = row.venueId,
            venueName = row.venueName;
          if (venueId || venueName) {
            const venues = await tx.venue.findMany({
              where: venueId
                ? { id: venueId }
                : { name: { equals: venueName, mode: 'insensitive' } },
            });
            if (venues.length !== 1)
              throw new BadRequestException(
                `Row ${index + 2}: venue not found or ambiguous; use its venueId`,
              );
            venueId = venues[0].id;
            venueName = venues[0].name;
          }
          const existing = await tx.volunteer.findMany({
            where: { email: { equals: email, mode: 'insensitive' } },
          });
          if (existing.length > 1)
            throw new BadRequestException(
              `Row ${index + 2}: multiple existing volunteers have this email; resolve them before importing`,
            );
          const data = {
            name: row.name.trim(),
            email,
            contactNumber: row.contactNumber,
            department: row.department?.trim(),
            shift,
            status,
            venueId,
            venueName,
          };
          if (existing.length) {
            updated++;
            if (!dto.dryRun)
              await tx.volunteer.update({
                where: { id: existing[0].id },
                data,
              });
          } else {
            created++;
            if (!dto.dryRun)
              await tx.volunteer.create({
                data: {
                  ...data,
                  volunteerCode: `VOL-${randomUUID()}`,
                  department: data.department || 'General Operations',
                  shift: shift || 'MORNING',
                  status: status || 'ACTIVE',
                  assignedBy: userId,
                },
              });
          }
        }
        if (!dto.dryRun)
          await tx.auditLog.create({
            data: {
              userId,
              action: 'volunteer.import',
              resource: 'Volunteer',
              newState: { created, updated, rows: dto.rows.length },
            },
          });
        return {
          dryRun: !!dto.dryRun,
          created,
          updated,
          total: dto.rows.length,
        };
      },
      { timeout: 30000 },
    );
  }
}
