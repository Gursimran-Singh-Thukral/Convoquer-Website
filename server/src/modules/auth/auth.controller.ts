import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { SessionService } from './session.service.js';
import { UsersService } from '../users/users.service.js';
import { GoogleAuthGuard } from './guards/google-auth.guard.js';
import { RbacService } from '../rbac/rbac.service.js';

@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly sessionService: SessionService,
    private readonly usersService: UsersService,
    private readonly rbacService: RbacService,
  ) {}

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  async googleAuth() {
    // Initiates the Google OAuth flow
  }

  // Accepts both paths: the app's own default is /api/auth/callback (see
  // GoogleStrategy's callbackURL), but a deployment's Google Cloud Console
  // OAuth client and/or its GOOGLE_CALLBACK_URL env var may instead be set to
  // the more conventional .../google/callback — Google redirects wherever the
  // original auth request's redirect_uri pointed, so both must resolve here
  // rather than requiring every deployment's config to match one exact path.
  @Get(['callback', 'google/callback'])
  @UseGuards(GoogleAuthGuard)
  async googleAuthRedirect(@Req() req: Request, @Res() res: Response) {
    const user = req.user as any;
    const frontendUrl =
      process.env.FRONTEND_URL ||
      process.env.CLIENT_URL ||
      'http://localhost:3000';

    if (!user) {
      return res.redirect(
        `${frontendUrl}/auth-error?reason=${encodeURIComponent('Sign-in did not return an account.')}`,
      );
    }

    await this.usersService.updateLastLogin(user.id);

    const token = await this.sessionService.createSession(
      user.id,
      req.ip,
      req.headers['user-agent'],
    );

    res.cookie('sessionId', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const access = await this.rbacService.getUserEffectiveAuth(user.id);
    const destination =
      access.roles.length && Object.keys(access.permissions).length
        ? '/organizer'
        : '/access-denied';
    res.redirect(`${frontendUrl}${destination}`);
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res() res: Response) {
    const token = req.cookies?.sessionId;
    if (token && token.includes('.')) {
      try {
        const { session } = await this.sessionService.validateSession(token);
        await this.sessionService.revokeSession(session.id, 'USER_LOGOUT');
      } catch {
        // Expired/invalid cookies can still be cleared without touching another session.
      }
    }
    res.clearCookie('sessionId');
    res.status(200).json({ success: true });
  }

  @Get('me')
  async getMe(@Req() req: Request) {
    const token = req.cookies?.sessionId;
    if (!token) {
      return { authenticated: false, user: null };
    }

    try {
      const { user } = await this.sessionService.validateSession(token);
      const fullUser = await this.usersService.getUserById(user.id);
      return {
        authenticated: true,
        user: fullUser || user,
      };
    } catch {
      return { authenticated: false, user: null };
    }
  }

  @Post('dev-login')
  async devLogin(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (
      process.env.NODE_ENV !== 'development' ||
      process.env.ENABLE_DEV_AUTH !== 'true'
    ) {
      throw new NotFoundException();
    }

    const roleName = req.body?.role || 'CONVENER';
    const email = `${roleName.toLowerCase()}@iitjammu.ac.in`;
    const name = `${roleName.replace('_', ' ')} (Demo)`;

    let user = await this.usersService.findOrCreateFromGoogle({
      id: `dev-${roleName.toLowerCase()}`,
      emails: [{ value: email }],
      displayName: name,
      photos: [],
    });

    // Grant the requested role globally so the demo login is actually usable
    // for local development/testing. Dev-only: this endpoint 404s in production.
    try {
      await this.rbacService.assignRole(null, user.id, roleName, {});
    } catch {
      // Unknown role name — leave the user with no roles rather than failing login.
    }

    const token = await this.sessionService.createSession(
      user.id,
      req.ip,
      req.headers['user-agent'],
    );

    res.cookie('sessionId', token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const fullUser = await this.usersService.getUserById(user.id);
    return {
      success: true,
      user: fullUser || user,
      role: roleName,
    };
  }

  @Post('institute-login')
  async instituteLogin(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (
      process.env.NODE_ENV !== 'development' ||
      process.env.ENABLE_DEV_AUTH !== 'true'
    ) {
      throw new NotFoundException();
    }

    const rawEmail = req.body?.email?.trim().toLowerCase();
    const role = req.body?.role || 'CONVENER';

    if (!rawEmail) {
      throw new BadRequestException('Institute email address is required.');
    }

    if (!rawEmail.endsWith('@iitjammu.ac.in')) {
      throw new ForbiddenException(
        'Domain restricted: only verified @iitjammu.ac.in accounts are authorized to sign in.',
      );
    }

    const username = rawEmail.split('@')[0];
    const name =
      req.body?.name ||
      username
        .split('.')
        .map((p: string) => p.charAt(0).toUpperCase() + p.slice(1))
        .join(' ');

    let user = await this.usersService.findOrCreateFromGoogle({
      id: `iitj-${username}`,
      emails: [{ value: rawEmail }],
      displayName: name,
      photos: [],
    });

    const token = await this.sessionService.createSession(
      user.id,
      req.ip,
      req.headers['user-agent'],
    );

    res.cookie('sessionId', token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const fullUser = await this.usersService.getUserById(user.id);
    return {
      success: true,
      user: fullUser || user,
      role: fullUser?.userRoles?.[0]?.role?.name || role,
    };
  }
}
