import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';

export interface UserPermissionEntry {
  action: string;
  isGlobal: boolean;
  sportIds: string[];
  eventIds: string[];
  departmentIds: string[];
}

export interface UserEffectiveAuth {
  userId: string;
  roles: string[];
  permissions: Record<string, UserPermissionEntry>;
}

@Injectable()
export class RbacService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolves all active, non-expired roles and deduplicated permissions with scope constraints.
   */
  async getUserEffectiveAuth(userId: string): Promise<UserEffectiveAuth> {
    const now = new Date();

    const userRoles = await this.prisma.userRole.findMany({
      where: {
        userId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    const activeRoles: string[] = [];
    const permissionsMap: Record<string, UserPermissionEntry> = {};

    for (const ur of userRoles) {
      if (!activeRoles.includes(ur.role.name)) {
        activeRoles.push(ur.role.name);
      }

      const isGlobal = !ur.sportId && !ur.eventId && !ur.departmentId;

      for (const rp of ur.role.permissions) {
        const action = rp.permission.action;

        if (!permissionsMap[action]) {
          permissionsMap[action] = {
            action,
            isGlobal: false,
            sportIds: [],
            eventIds: [],
            departmentIds: [],
          };
        }

        if (isGlobal) {
          permissionsMap[action].isGlobal = true;
        } else {
          if (
            ur.sportId &&
            !permissionsMap[action].sportIds.includes(ur.sportId)
          ) {
            permissionsMap[action].sportIds.push(ur.sportId);
          }
          if (
            ur.eventId &&
            !permissionsMap[action].eventIds.includes(ur.eventId)
          ) {
            permissionsMap[action].eventIds.push(ur.eventId);
          }
          if (
            ur.departmentId &&
            !permissionsMap[action].departmentIds.includes(ur.departmentId)
          ) {
            permissionsMap[action].departmentIds.push(ur.departmentId);
          }
        }
      }
    }

    return {
      userId,
      roles: activeRoles,
      permissions: permissionsMap,
    };
  }

  /**
   * Evaluates if a user has a specific permission, considering global or specific scope constraints.
   */
  async hasPermission(
    userId: string,
    action: string,
    scope?: { sportId?: string; eventId?: string; departmentId?: string },
  ): Promise<boolean> {
    const effective = await this.getUserEffectiveAuth(userId);
    const entry = effective.permissions[action];

    if (!entry) {
      return false;
    }

    // If granted globally via any active role, allow
    if (entry.isGlobal) {
      return true;
    }

    // If a scope is required, check if user has matching scoped assignment
    if (scope?.sportId && entry.sportIds.includes(scope.sportId)) {
      return true;
    }
    if (scope?.eventId && entry.eventIds.includes(scope.eventId)) {
      return true;
    }
    if (
      scope?.departmentId &&
      entry.departmentIds.includes(scope.departmentId)
    ) {
      return true;
    }

    // If no specific scope was requested and user has no global grant,
    // they don't have unrestricted access to this action
    return false;
  }

  /**
   * Evaluates if a user has any of the specified roles.
   */
  async hasAnyRole(userId: string, requiredRoles: string[]): Promise<boolean> {
    const effective = await this.getUserEffectiveAuth(userId);
    return requiredRoles.some((r) => effective.roles.includes(r));
  }

  /**
   * Assigns a role to a user and writes to the audit log.
   */
  async assignRole(
    assignerUserId: string | null,
    targetUserId: string,
    roleIdOrName: string,
    scope?: {
      sportId?: string;
      eventId?: string;
      departmentId?: string;
      expiresAt?: Date;
    },
    ipAddress?: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });
    if (!user) {
      throw new NotFoundException(
        `Target user with id "${targetUserId}" not found`,
      );
    }

    const role = await this.prisma.role.findFirst({
      where: {
        OR: [{ id: roleIdOrName }, { name: roleIdOrName }],
      },
    });
    if (!role) {
      throw new NotFoundException(`Role "${roleIdOrName}" not found`);
    }

    const userRole = await this.prisma.userRole.upsert({
      where: {
        userId_roleId_eventId_departmentId_sportId: {
          userId: targetUserId,
          roleId: role.id,
          eventId: scope?.eventId ?? (null as any),
          departmentId: scope?.departmentId ?? (null as any),
          sportId: scope?.sportId ?? (null as any),
        },
      },
      update: {
        assignedBy: assignerUserId,
        expiresAt: scope?.expiresAt ?? null,
      },
      create: {
        userId: targetUserId,
        roleId: role.id,
        eventId: scope?.eventId ?? null,
        departmentId: scope?.departmentId ?? null,
        sportId: scope?.sportId ?? null,
        assignedBy: assignerUserId,
        expiresAt: scope?.expiresAt ?? null,
      },
    });

    // Write to AuditLog for traceability
    await this.prisma.auditLog.create({
      data: {
        userId: assignerUserId,
        action: 'role.assign',
        resource: 'UserRole',
        resourceId: userRole.id,
        newState: {
          targetUserId,
          targetUserEmail: user.email,
          roleName: role.name,
          scope,
        },
        ipAddress,
      },
    });

    return userRole;
  }

  /**
   * Revokes a user role assignment and writes to the audit log.
   */
  async revokeRole(
    revokerUserId: string | null,
    userRoleId: string,
    ipAddress?: string,
  ) {
    const existing = await this.prisma.userRole.findUnique({
      where: { id: userRoleId },
      include: { role: true, user: true },
    });

    if (!existing) {
      throw new NotFoundException(
        `UserRole assignment "${userRoleId}" not found`,
      );
    }

    await this.prisma.userRole.delete({
      where: { id: userRoleId },
    });

    // Record in AuditLog
    await this.prisma.auditLog.create({
      data: {
        userId: revokerUserId,
        action: 'role.revoke',
        resource: 'UserRole',
        resourceId: userRoleId,
        previousState: {
          targetUserId: existing.userId,
          targetUserEmail: existing.user.email,
          roleName: existing.role.name,
          sportId: existing.sportId,
          eventId: existing.eventId,
        },
        ipAddress,
      },
    });

    return { success: true, message: 'Role revoked successfully' };
  }

  /**
   * Lists all defined roles with permission counts and names.
   */
  async getRoles() {
    return this.prisma.role.findMany({
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Lists all available permission actions.
   */
  async getPermissions() {
    return this.prisma.permission.findMany({
      orderBy: { action: 'asc' },
    });
  }
}
