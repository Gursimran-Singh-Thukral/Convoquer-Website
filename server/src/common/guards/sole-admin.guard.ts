import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { decryptField } from '../crypto/field-crypto.js';

/**
 * Locks a route to one specific account by email, on top of whatever
 * ordinary permission check already guards it — defense in depth against
 * that permission ever being (re)granted to someone else, whether by
 * mistake, a future import, or that account's own role.assign use. Applied
 * to RBAC administration (rbac.controller.ts) and tournament-structure
 * endpoints (fixtures.controller.ts — create/update/delete a Tournament,
 * seeding, stages, and generating its bracket/round-robin/Swiss round; a
 * Sports Coordinator "populates" matches inside a structure that already
 * exists but never builds the structure itself). If SOLE_ADMIN_EMAIL isn't
 * set, this guard no-ops and access is governed by permissions alone.
 */
@Injectable()
export class SoleAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const adminEmail = process.env.SOLE_ADMIN_EMAIL?.trim().toLowerCase();
    if (!adminEmail) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) throw new UnauthorizedException('Authentication required');

    const userEmail = user.email
      ? decryptField(user.email)?.trim().toLowerCase()
      : null;
    if (userEmail !== adminEmail) {
      throw new ForbiddenException(
        'This section is restricted to a single account.',
      );
    }
    return true;
  }
}
