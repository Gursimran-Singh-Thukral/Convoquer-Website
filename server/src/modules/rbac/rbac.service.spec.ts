import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RbacService } from './rbac.service.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { Reflector } from '@nestjs/core';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';

describe('RbacService & PermissionsGuard', () => {
  let rbacService: RbacService;
  let prismaMock: any;
  let reflector: Reflector;
  let permissionsGuard: PermissionsGuard;

  beforeEach(() => {
    prismaMock = {
      userRole: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        upsert: vi.fn(),
        delete: vi.fn(),
      },
      role: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      permission: {
        findMany: vi.fn(),
      },
      user: {
        findUnique: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
    };

    rbacService = new RbacService(prismaMock);
    reflector = new Reflector();
    permissionsGuard = new PermissionsGuard(reflector, rbacService);
  });

  describe('getUserEffectiveAuth', () => {
    it('should aggregate global permissions from roles without scope', async () => {
      prismaMock.userRole.findMany.mockResolvedValue([
        {
          id: 'ur-1',
          userId: 'user-1',
          sportId: null,
          eventId: null,
          departmentId: null,
          role: {
            name: 'CONVENER',
            permissions: [
              { permission: { action: 'sport.create' } },
              { permission: { action: 'score.update' } },
            ],
          },
        },
      ]);

      const auth = await rbacService.getUserEffectiveAuth('user-1');

      expect(auth.roles).toContain('CONVENER');
      expect(auth.permissions['sport.create']).toBeDefined();
      expect(auth.permissions['sport.create'].isGlobal).toBe(true);
      expect(auth.permissions['score.update'].isGlobal).toBe(true);
    });

    it('should correctly scope permissions when assigned to a specific sport', async () => {
      prismaMock.userRole.findMany.mockResolvedValue([
        {
          id: 'ur-2',
          userId: 'user-2',
          sportId: 'sport-football',
          eventId: null,
          departmentId: null,
          role: {
            name: 'SPORTS_COORDINATOR',
            permissions: [
              { permission: { action: 'score.update' } },
            ],
          },
        },
      ]);

      const auth = await rbacService.getUserEffectiveAuth('user-2');

      expect(auth.roles).toContain('SPORTS_COORDINATOR');
      expect(auth.permissions['score.update'].isGlobal).toBe(false);
      expect(auth.permissions['score.update'].sportIds).toContain('sport-football');
    });
  });

  describe('hasPermission with Scope', () => {
    beforeEach(() => {
      // User has sports coordinator role for Football only
      prismaMock.userRole.findMany.mockResolvedValue([
        {
          id: 'ur-3',
          userId: 'user-coord',
          sportId: 'sport-football',
          eventId: null,
          departmentId: null,
          role: {
            name: 'SPORTS_COORDINATOR',
            permissions: [
              { permission: { action: 'score.update' } },
            ],
          },
        },
      ]);
    });

    it('should grant access when accessing within authorized sport scope', async () => {
      const allowed = await rbacService.hasPermission('user-coord', 'score.update', {
        sportId: 'sport-football',
      });
      expect(allowed).toBe(true);
    });

    it('should deny access when trying to update scores for an unauthorized sport', async () => {
      const allowed = await rbacService.hasPermission('user-coord', 'score.update', {
        sportId: 'sport-cricket',
      });
      expect(allowed).toBe(false);
    });

    it('should deny access for unassigned actions', async () => {
      const allowed = await rbacService.hasPermission('user-coord', 'role.assign');
      expect(allowed).toBe(false);
    });
  });

  describe('PermissionsGuard', () => {
    it('should allow requests with no required permissions', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(null);

      const context: any = {
        getHandler: () => {},
        getClass: () => {},
        switchToHttp: () => ({
          getRequest: () => ({ user: { id: 'user-1' } }),
        }),
      };

      const result = await permissionsGuard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should throw UnauthorizedException if no user on request', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['score.update']);

      const context: any = {
        getHandler: () => {},
        getClass: () => {},
        switchToHttp: () => ({
          getRequest: () => ({ user: null }),
        }),
      };

      await expect(permissionsGuard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw ForbiddenException if user lacks required permission', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['role.assign']);
      vi.spyOn(rbacService, 'hasPermission').mockResolvedValue(false);

      const context: any = {
        getHandler: () => {},
        getClass: () => {},
        switchToHttp: () => ({
          getRequest: () => ({
            user: { id: 'user-regular' },
            params: {},
            query: {},
          }),
        }),
      };

      await expect(permissionsGuard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should allow access if user has all required permissions', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['score.update']);
      vi.spyOn(rbacService, 'hasPermission').mockResolvedValue(true);

      const context: any = {
        getHandler: () => {},
        getClass: () => {},
        switchToHttp: () => ({
          getRequest: () => ({
            user: { id: 'user-admin' },
            params: {},
            query: {},
          }),
        }),
      };

      const result = await permissionsGuard.canActivate(context);
      expect(result).toBe(true);
    });
  });

  describe('assignRole & AuditLog', () => {
    it('should write an audit log entry on role assignment', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 'target-1', email: 'vol@iitjammu.ac.in' });
      prismaMock.role.findFirst.mockResolvedValue({ id: 'role-vol', name: 'VOLUNTEER' });
      prismaMock.userRole.upsert.mockResolvedValue({ id: 'ur-new', userId: 'target-1', roleId: 'role-vol' });
      prismaMock.auditLog.create.mockResolvedValue({ id: 'audit-1' });

      await rbacService.assignRole('convener-1', 'target-1', 'VOLUNTEER');

      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'convener-1',
            action: 'role.assign',
            resource: 'UserRole',
            resourceId: 'ur-new',
          }),
        }),
      );
    });
  });
});
