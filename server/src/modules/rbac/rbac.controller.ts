import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';
import { RbacService } from './rbac.service.js';
import { SessionGuard } from '../../common/guards/session.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { SoleAdminGuard } from '../../common/guards/sole-admin.guard.js';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator.js';

export class AssignRoleDto {
  role!: string;
  volunteerId?: string;
  sportId?: string;
  eventId?: string;
  department?: string;
  expiresAt?: string;
}

export class AssignVolunteerRoleDto {
  role!: string;
  sportId?: string;
  eventId?: string;
  department?: string;
  expiresAt?: string;
}

@Controller('api')
export class RbacController {
  constructor(private readonly rbacService: RbacService) {}

  /**
   * Get all registered roles with their permissions
   */
  @Get('rbac/roles')
  @UseGuards(SessionGuard, SoleAdminGuard, PermissionsGuard)
  @RequirePermissions('role.view')
  async getRoles() {
    return this.rbacService.getRoles();
  }

  /**
   * Get all registered permissions
   */
  @Get('rbac/permissions')
  @UseGuards(SessionGuard, SoleAdminGuard, PermissionsGuard)
  @RequirePermissions('role.view')
  async getPermissions() {
    return this.rbacService.getPermissions();
  }

  @Get('rbac/assignment-options')
  @UseGuards(SessionGuard, SoleAdminGuard, PermissionsGuard)
  @RequirePermissions('role.assign')
  async getAssignmentOptions() {
    return this.rbacService.getAssignmentOptions();
  }

  /**
   * Get authenticated user's active roles and effective permissions
   */
  @Get('users/me/permissions')
  @UseGuards(SessionGuard)
  async getMyPermissions(@Req() req: Request) {
    const user = (req as any).user;
    return this.rbacService.getUserEffectiveAuth(user.id);
  }

  /**
   * Assign a role to a target user
   */
  @Post('users/:userId/roles')
  @UseGuards(SessionGuard, SoleAdminGuard, PermissionsGuard)
  @RequirePermissions('role.assign')
  async assignRole(
    @Param('userId') targetUserId: string,
    @Body() dto: AssignRoleDto,
    @Req() req: Request,
  ) {
    if (!dto.role) {
      throw new BadRequestException('Role name or ID is required');
    }

    const currentUserId = (req as any).user.id;
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : undefined;

    return this.rbacService.assignRoleWithVolunteerScopes(
      currentUserId,
      targetUserId,
      dto.role,
      {
        volunteerId: dto.volunteerId,
        sportId: dto.sportId,
        eventId: dto.eventId,
        department: dto.department,
        expiresAt,
      },
      req.ip,
    );
  }

  /**
   * Assign a role directly to a volunteer, whether or not they've logged in
   * yet. Linked volunteers get a live UserRole immediately; unlinked ones get
   * it queued (Volunteer.pendingRoleName) and it activates automatically on
   * their first login — see RbacService.assignRoleToVolunteer.
   */
  @Post('volunteers/:volunteerId/role')
  @UseGuards(SessionGuard, SoleAdminGuard, PermissionsGuard)
  @RequirePermissions('role.assign')
  async assignRoleToVolunteer(
    @Param('volunteerId') volunteerId: string,
    @Body() dto: AssignVolunteerRoleDto,
    @Req() req: Request,
  ) {
    if (!dto.role) {
      throw new BadRequestException('Role name or ID is required');
    }

    const currentUserId = (req as any).user.id;
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : undefined;

    return this.rbacService.assignRoleToVolunteer(
      currentUserId,
      volunteerId,
      dto.role,
      {
        sportId: dto.sportId,
        eventId: dto.eventId,
        department: dto.department,
        expiresAt,
      },
      req.ip,
    );
  }

  /**
   * Revoke a specific role assignment from a user
   */
  @Delete('users/:userId/roles/:userRoleId')
  @UseGuards(SessionGuard, SoleAdminGuard, PermissionsGuard)
  @RequirePermissions('role.revoke')
  async revokeRole(
    @Param('userId') _targetUserId: string,
    @Param('userRoleId') userRoleId: string,
    @Req() req: Request,
  ) {
    const currentUserId = (req as any).user.id;
    return this.rbacService.revokeRole(currentUserId, userRoleId, req.ip);
  }
}
