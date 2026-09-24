import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { randomBytes, timingSafeEqual } from 'node:crypto';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  constructor() {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();
    if (req.path.endsWith('/callback')) {
      const expected = req.cookies?.oauthState;
      const received = req.query?.state;
      res.clearCookie('oauthState', {
        path: '/api/auth',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      });
      if (
        typeof expected !== 'string' ||
        typeof received !== 'string' ||
        expected.length !== received.length ||
        !timingSafeEqual(Buffer.from(expected), Buffer.from(received))
      ) {
        throw new UnauthorizedException(
          'Invalid or expired sign-in state. Please sign in again.',
        );
      }
    } else {
      const state = randomBytes(32).toString('hex');
      res.cookie('oauthState', state, {
        path: '/api/auth',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 10 * 60 * 1000,
      });
      req.oauthState = state;
    }
    return (await super.canActivate(context)) as boolean;
  }

  getAuthenticateOptions(context: ExecutionContext) {
    return {
      session: false,
      state: context.switchToHttp().getRequest().oauthState,
    };
  }

  handleRequest(err: any, user: any, info: any, _context: ExecutionContext) {
    if (err || !user) {
      const reason = err?.message || info?.message || 'Sign-in failed.';
      throw new UnauthorizedException(reason);
    }

    return user;
  }
}
