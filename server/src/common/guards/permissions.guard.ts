import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator.js';
import { RbacService } from '../../modules/rbac/rbac.service.js';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rbacService: RbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If endpoint has no permission restriction, allow
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.id) {
      throw new UnauthorizedException('Authentication required');
    }

    // Extract scope parameters from URL params or query if present
    const sportId =
      request.params?.sportId ||
      request.query?.sportId ||
      request.body?.sportId;
    const eventId =
      request.params?.eventId ||
      request.query?.eventId ||
      request.body?.eventId;
    const departmentId =
      request.params?.departmentId ||
      request.query?.departmentId ||
      request.body?.departmentId;

    const scope = {
      sportId: typeof sportId === 'string' ? sportId : undefined,
      eventId: typeof eventId === 'string' ? eventId : undefined,
      departmentId: typeof departmentId === 'string' ? departmentId : undefined,
    };

    // User must satisfy all listed permissions
    for (const permission of requiredPermissions) {
      const hasPerm = await this.rbacService.hasPermission(
        user.id,
        permission,
        scope,
      );
      if (!hasPerm) {
        throw new ForbiddenException(
          `Insufficient permissions: Missing permission "${permission}"`,
        );
      }
    }

    return true;
  }
}
