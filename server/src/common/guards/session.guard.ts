import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { SessionService } from '../../modules/auth/session.service.js';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly sessionService: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const token = request.cookies?.sessionId;

    if (!token) {
      throw new UnauthorizedException('Authentication required');
    }

    try {
      const { session, user } =
        await this.sessionService.validateSession(token);
      request.sessionData = session;
      request.user = user;
      return true;
    } catch (e: any) {
      throw new UnauthorizedException(e.message || 'Invalid session');
    }
  }
}
