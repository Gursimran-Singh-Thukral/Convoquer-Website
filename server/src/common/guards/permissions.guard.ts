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

    // User must satisfy all listed permissions
    for (const permission of requiredPermissions) {
      const scope = await this.rbacService.resolveRequestScope(
        request,
        permission,
      );
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
