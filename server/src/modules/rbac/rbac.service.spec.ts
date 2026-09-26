import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RbacService } from './rbac.service.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { Reflector } from '@nestjs/core';
import {
  ForbiddenException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { blindIndex } from '../../common/crypto/field-crypto.js';

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
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      role: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        findUniqueOrThrow: vi.fn(),
      },
      permission: {
        findMany: vi.fn(),
      },
      user: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
      },
      volunteer: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
      matchOfficial: {
        count: vi.fn().mockResolvedValue(0),
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
            permissions: [{ permission: { action: 'score.update' } }],
          },
        },
      ]);

      const auth = await rbacService.getUserEffectiveAuth('user-2');

      expect(auth.roles).toContain('SPORTS_COORDINATOR');
      expect(auth.permissions['score.update'].isGlobal).toBe(false);
      expect(auth.permissions['score.update'].sportIds).toContain(
        'sport-football',
      );
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
            permissions: [{ permission: { action: 'score.update' } }],
          },
        },
      ]);
    });

    it('should grant access when accessing within authorized sport scope', async () => {
      const allowed = await rbacService.hasPermission(
        'user-coord',
        'score.update',
        {
          sportId: 'sport-football',
        },
      );
      expect(allowed).toBe(true);
    });

    it('should deny access when trying to update scores for an unauthorized sport', async () => {
      const allowed = await rbacService.hasPermission(
        'user-coord',
        'score.update',
        {
          sportId: 'sport-cricket',
        },
      );
      expect(allowed).toBe(false);
    });

    it('should deny access for unassigned actions', async () => {
      const allowed = await rbacService.hasPermission(
        'user-coord',
        'role.assign',
      );
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
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([
        'score.update',
      ]);

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
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([
        'score.update',
      ]);
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
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'target-1',
        email: 'vol@iitjammu.ac.in',
      });
      prismaMock.role.findFirst.mockResolvedValue({
        id: 'role-vol',
        name: 'VOLUNTEER',
      });
      prismaMock.userRole.findFirst.mockResolvedValue(null);
      prismaMock.userRole.create.mockResolvedValue({
        id: 'ur-new',
        userId: 'target-1',
        roleId: 'role-vol',
      });
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

    it('assigns an unscoped (global) role without a null-comparison error', async () => {
      // Regression test: Prisma's composite-unique `where` shorthand rejects an
      // explicit `null` for nullable key fields, so assignRole must look the
      // existing row up via findFirst (equals: null) rather than upsert() by
      // composite key. This previously threw PrismaClientValidationError for
      // every unscoped assignment (the common case — e.g. granting CONVENER).
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'target-2',
        email: 'convener@iitjammu.ac.in',
      });
      prismaMock.role.findFirst.mockResolvedValue({
        id: 'role-convener',
        name: 'CONVENER',
      });
      prismaMock.userRole.findFirst.mockResolvedValue(null);
      prismaMock.userRole.create.mockResolvedValue({
        id: 'ur-global',
        userId: 'target-2',
        roleId: 'role-convener',
      });
      prismaMock.auditLog.create.mockResolvedValue({ id: 'audit-2' });

      await rbacService.assignRole(null, 'target-2', 'CONVENER', {});

      expect(prismaMock.userRole.findFirst).toHaveBeenCalledWith({
        where: {
          userId: 'target-2',
          roleId: 'role-convener',
          eventId: { equals: null },
          departmentId: { equals: null },
          sportId: { equals: null },
        },
      });
      expect(prismaMock.userRole.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'target-2',
          roleId: 'role-convener',
          eventId: null,
          departmentId: null,
          sportId: null,
        }),
      });
    });

    it('updates an existing unscoped assignment instead of creating a duplicate', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'target-3',
        email: 'media@iitjammu.ac.in',
      });
      prismaMock.role.findFirst.mockResolvedValue({
        id: 'role-media',
        name: 'MEDIA_HEAD',
      });
      prismaMock.userRole.findFirst.mockResolvedValue({
        id: 'ur-existing',
        userId: 'target-3',
        roleId: 'role-media',
      });
      prismaMock.userRole.update.mockResolvedValue({
        id: 'ur-existing',
        userId: 'target-3',
        roleId: 'role-media',
      });
      prismaMock.auditLog.create.mockResolvedValue({ id: 'audit-3' });

      await rbacService.assignRole('convener-1', 'target-3', 'MEDIA_HEAD');

      expect(prismaMock.userRole.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'ur-existing' } }),
      );
      expect(prismaMock.userRole.create).not.toHaveBeenCalled();
    });
  });

  describe('assignRoleWithVolunteerScopes — ground role inference & head departments', () => {
    const ROLES: Record<string, { id: string; name: string }> = {
      'role-volunteer': { id: 'role-volunteer', name: 'VOLUNTEER' },
      VOLUNTEER: { id: 'role-volunteer', name: 'VOLUNTEER' },
      'role-security-vol': {
        id: 'role-security-vol',
        name: 'HOSPITALITY_SECURITY_VOLUNTEER',
      },
      HOSPITALITY_SECURITY_VOLUNTEER: {
        id: 'role-security-vol',
        name: 'HOSPITALITY_SECURITY_VOLUNTEER',
      },
      'role-security-head': {
        id: 'role-security-head',
        name: 'HOSPITALITY_SECURITY_HEAD',
      },
      HOSPITALITY_SECURITY_HEAD: {
        id: 'role-security-head',
        name: 'HOSPITALITY_SECURITY_HEAD',
      },
    };

    function mockLinkedVolunteer(department: string) {
      const volunteer = {
        id: 'vol-1',
        email: 'ground@iitjammu.ac.in',
        department,
      };
      prismaMock.volunteer.findUnique.mockResolvedValue(volunteer);
      prismaMock.user.findUnique.mockResolvedValue({
        emailHash: blindIndex(volunteer.email),
      });
      return volunteer;
    }

    beforeEach(() => {
      // Both assignRoleWithVolunteerScopes and the assignRole() it calls into
      // look roles up by id-or-name — resolve either from the same fixed table
      // so a role resolved by name earlier is found again correctly by id later.
      prismaMock.role.findFirst.mockImplementation(async ({ where }: any) => {
        const key = where.OR[0].id ?? where.OR[1]?.name;
        return ROLES[key] ?? ROLES[where.OR[1]?.name] ?? null;
      });
      prismaMock.role.findUniqueOrThrow.mockImplementation(
        async ({ where }: any) => ROLES[where.name],
      );
      prismaMock.userRole.create.mockResolvedValue({ id: 'ur-new' });
      prismaMock.auditLog.create.mockResolvedValue({ id: 'audit-x' });
    });

    it('infers HOSPITALITY_SECURITY_VOLUNTEER when the generic VOLUNTEER role is picked with department "Hospitality & Security"', async () => {
      mockLinkedVolunteer('Hospitality & Security');

      await rbacService.assignRoleWithVolunteerScopes(
        'admin-1',
        'target-1',
        'VOLUNTEER',
        { volunteerId: 'vol-1', department: 'Hospitality & Security' },
      );

      expect(prismaMock.role.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { name: 'HOSPITALITY_SECURITY_VOLUNTEER' },
      });
      expect(prismaMock.userRole.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ roleId: 'role-security-vol' }),
        }),
      );
      expect(prismaMock.volunteer.update).toHaveBeenCalledWith({
        where: { id: 'vol-1' },
        data: { userId: 'target-1', department: 'Hospitality & Security' },
      });
    });

    it('falls back to the generic VOLUNTEER role for a department with no dedicated ground role', async () => {
      mockLinkedVolunteer('Web');

      await rbacService.assignRoleWithVolunteerScopes(
        'admin-1',
        'target-1',
        'VOLUNTEER',
        { volunteerId: 'vol-1', department: 'Web' },
      );

      expect(prismaMock.role.findUniqueOrThrow).not.toHaveBeenCalled();
      expect(prismaMock.userRole.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ roleId: 'role-volunteer' }),
        }),
      );
    });

    it("forces a Head role's canonical department onto the volunteer, overriding whatever they had before", async () => {
      mockLinkedVolunteer('Media'); // previously a Media volunteer

      await rbacService.assignRoleWithVolunteerScopes(
        'admin-1',
        'target-1',
        'HOSPITALITY_SECURITY_HEAD',
        { volunteerId: 'vol-1' },
      );

      expect(prismaMock.volunteer.update).toHaveBeenCalledWith({
        where: { id: 'vol-1' },
        data: { userId: 'target-1', department: 'Hospitality & Security' },
      });
      expect(prismaMock.userRole.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ roleId: 'role-security-head' }),
        }),
      );
    });

    it('rejects an unrecognized department', async () => {
      prismaMock.role.findFirst.mockResolvedValue({
        id: 'role-volunteer',
        name: 'VOLUNTEER',
      });

      await expect(
        rbacService.assignRoleWithVolunteerScopes(
          'admin-1',
          'target-1',
          'VOLUNTEER',
          { volunteerId: 'vol-1', department: 'Not A Real Department' },
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a ground-role assignment with no volunteer selected', async () => {
      prismaMock.role.findFirst.mockResolvedValue({
        id: 'role-volunteer',
        name: 'VOLUNTEER',
      });

      await expect(
        rbacService.assignRoleWithVolunteerScopes(
          'admin-1',
          'target-1',
          'VOLUNTEER',
          {},
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('assignRoleToVolunteer', () => {
    it('assigns live instead of queuing when the volunteer already has a login account, even before it is linked', async () => {
      // This volunteer was never queued via linkPendingVolunteerRole (e.g. a
      // brand-new manual assignment), so Volunteer.userId is still null even
      // though they already signed in and have a User row — the assignment
      // should discover that account by email rather than blindly queuing.
      const emailHash = blindIndex('already.signed.in@iitjammu.ac.in');
      prismaMock.volunteer.findUnique.mockResolvedValue({
        id: 'vol-1',
        email: 'already.signed.in@iitjammu.ac.in',
        userId: null,
        department: null,
      });
      prismaMock.user.findFirst.mockResolvedValue({ id: 'user-99' });
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-99',
        emailHash,
      });
      prismaMock.role.findFirst.mockResolvedValue({
        id: 'role-media',
        name: 'MEDIA_TEAM',
      });
      prismaMock.volunteer.update.mockResolvedValue({});
      prismaMock.userRole.findFirst.mockResolvedValue(null);
      prismaMock.userRole.create.mockResolvedValue({ id: 'ur-new' });
      prismaMock.auditLog.create.mockResolvedValue({ id: 'audit-1' });

      const result = await rbacService.assignRoleToVolunteer(
        'admin-1',
        'vol-1',
        'MEDIA_TEAM',
        {},
      );

      expect(result.pending).toBe(false);
      expect(prismaMock.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { emailHash } }),
      );
      expect(prismaMock.volunteer.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: 'user-99' }),
        }),
      );
      expect(prismaMock.userRole.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: 'user-99' }),
        }),
      );
    });

    it('queues the role when no login account exists for the volunteer yet', async () => {
      prismaMock.volunteer.findUnique.mockResolvedValue({
        id: 'vol-2',
        name: 'Fresh Volunteer',
        email: 'not.yet@iitjammu.ac.in',
        userId: null,
        department: null,
      });
      prismaMock.user.findFirst.mockResolvedValue(null);
      prismaMock.role.findFirst.mockResolvedValue({
        id: 'role-media',
        name: 'MEDIA_TEAM',
      });
      prismaMock.volunteer.update.mockResolvedValue({});
      prismaMock.auditLog.create.mockResolvedValue({ id: 'audit-2' });

      const result = await rbacService.assignRoleToVolunteer(
        'admin-1',
        'vol-2',
        'MEDIA_TEAM',
        {},
      );

      expect(result.pending).toBe(true);
      expect(prismaMock.volunteer.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ pendingRoleName: 'MEDIA_TEAM' }),
        }),
      );
    });
  });

  describe('bootstrapFirstConvenerIfNeeded', () => {
    beforeEach(() => {
      prismaMock.role.findUnique = vi.fn();
    });

    it('grants CONVENER when the email matches and no CONVENER exists yet', async () => {
      process.env.CONVENER_BOOTSTRAP_EMAIL = 'first.admin@iitjammu.ac.in';
      prismaMock.userRole.findFirst.mockResolvedValueOnce(null); // no existing CONVENER
      prismaMock.role.findUnique.mockResolvedValue({
        id: 'role-convener',
        name: 'CONVENER',
      });
      prismaMock.role.findFirst.mockResolvedValue({
        id: 'role-convener',
        name: 'CONVENER',
      });
      prismaMock.user.findUnique.mockResolvedValue({ id: 'user-new' });
      prismaMock.userRole.findFirst.mockResolvedValueOnce(null); // assignRole's own existing-assignment lookup
      prismaMock.userRole.create.mockResolvedValue({ id: 'ur-bootstrap' });
      prismaMock.auditLog.create.mockResolvedValue({ id: 'audit-bootstrap' });

      await rbacService.bootstrapFirstConvenerIfNeeded(
        'user-new',
        'First.Admin@iitjammu.ac.in',
      );

      expect(prismaMock.userRole.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-new',
            roleId: 'role-convener',
          }),
        }),
      );

      delete process.env.CONVENER_BOOTSTRAP_EMAIL;
    });

    it('does nothing when the email does not match', async () => {
      process.env.CONVENER_BOOTSTRAP_EMAIL = 'first.admin@iitjammu.ac.in';

      await rbacService.bootstrapFirstConvenerIfNeeded(
        'user-x',
        'someone.else@iitjammu.ac.in',
      );

      expect(prismaMock.userRole.findFirst).not.toHaveBeenCalled();
      expect(prismaMock.userRole.create).not.toHaveBeenCalled();

      delete process.env.CONVENER_BOOTSTRAP_EMAIL;
    });

    it('does nothing when a CONVENER already exists, even for the bootstrap email', async () => {
      process.env.CONVENER_BOOTSTRAP_EMAIL = 'first.admin@iitjammu.ac.in';
      prismaMock.userRole.findFirst.mockResolvedValueOnce({
        id: 'ur-existing-convener',
      });

      await rbacService.bootstrapFirstConvenerIfNeeded(
        'user-new',
        'first.admin@iitjammu.ac.in',
      );

      expect(prismaMock.userRole.create).not.toHaveBeenCalled();

      delete process.env.CONVENER_BOOTSTRAP_EMAIL;
    });

    it('does nothing when CONVENER_BOOTSTRAP_EMAIL is unset', async () => {
      delete process.env.CONVENER_BOOTSTRAP_EMAIL;

      await rbacService.bootstrapFirstConvenerIfNeeded(
        'user-new',
        'anyone@iitjammu.ac.in',
      );

      expect(prismaMock.userRole.findFirst).not.toHaveBeenCalled();
      expect(prismaMock.userRole.create).not.toHaveBeenCalled();
    });
  });

  describe('ensureSoleAdminHasWebDevHead', () => {
    beforeEach(() => {
      prismaMock.role.findUnique = vi.fn();
    });

    it('grants WEB_DEV_HEAD when the email matches and it is not already held', async () => {
      process.env.SOLE_ADMIN_EMAIL = 'admin@iitjammu.ac.in';
      prismaMock.userRole.findFirst.mockResolvedValueOnce(null); // not already held
      prismaMock.role.findUnique.mockResolvedValue({
        id: 'role-webdev',
        name: 'WEB_DEV_HEAD',
      });
      prismaMock.role.findFirst.mockResolvedValue({
        id: 'role-webdev',
        name: 'WEB_DEV_HEAD',
      });
      prismaMock.user.findUnique.mockResolvedValue({ id: 'user-admin' });
      prismaMock.userRole.findFirst.mockResolvedValueOnce(null); // assignRole's own existing-assignment lookup
      prismaMock.userRole.create.mockResolvedValue({ id: 'ur-webdev' });
      prismaMock.auditLog.create.mockResolvedValue({ id: 'audit-webdev' });

      await rbacService.ensureSoleAdminHasWebDevHead(
        'user-admin',
        'Admin@iitjammu.ac.in',
      );

      expect(prismaMock.userRole.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-admin',
            roleId: 'role-webdev',
          }),
        }),
      );

      delete process.env.SOLE_ADMIN_EMAIL;
    });

    it('does nothing when the email does not match', async () => {
      process.env.SOLE_ADMIN_EMAIL = 'admin@iitjammu.ac.in';

      await rbacService.ensureSoleAdminHasWebDevHead(
        'user-x',
        'someone.else@iitjammu.ac.in',
      );

      expect(prismaMock.userRole.findFirst).not.toHaveBeenCalled();
      expect(prismaMock.userRole.create).not.toHaveBeenCalled();

      delete process.env.SOLE_ADMIN_EMAIL;
    });

    it('does nothing when the admin already holds WEB_DEV_HEAD', async () => {
      process.env.SOLE_ADMIN_EMAIL = 'admin@iitjammu.ac.in';
      prismaMock.userRole.findFirst.mockResolvedValueOnce({
        id: 'ur-existing-webdev',
      });

      await rbacService.ensureSoleAdminHasWebDevHead(
        'user-admin',
        'admin@iitjammu.ac.in',
      );

      expect(prismaMock.userRole.create).not.toHaveBeenCalled();

      delete process.env.SOLE_ADMIN_EMAIL;
    });

    it('does nothing when SOLE_ADMIN_EMAIL is unset', async () => {
      delete process.env.SOLE_ADMIN_EMAIL;

      await rbacService.ensureSoleAdminHasWebDevHead(
        'user-admin',
        'anyone@iitjammu.ac.in',
      );

      expect(prismaMock.userRole.findFirst).not.toHaveBeenCalled();
      expect(prismaMock.userRole.create).not.toHaveBeenCalled();
    });
  });
});
