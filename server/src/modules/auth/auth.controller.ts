import {
  Controller,
  Get,
  Req,
  Res,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import { SessionService } from './session.service.js';
import { UsersService } from '../users/users.service.js';

@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly sessionService: SessionService,
    private readonly usersService: UsersService,
  ) {}

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth() {
    // Initiates the Google OAuth flow
  }

  @Get('callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Req() req: Request, @Res() res: Response) {
    const user = req.user as any;
    if (!user) {
      throw new UnauthorizedException('No user from google');
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

    res.redirect('/');
  }

  @Get('logout')
  async logout(@Req() req: Request, @Res() res: Response) {
    const token = req.cookies?.sessionId;
    if (token && token.includes('.')) {
      const [sessionId] = token.split('.');
      await this.sessionService.revokeSession(sessionId, 'USER_LOGOUT');
    }
    res.clearCookie('sessionId');
    res.redirect('/');
  }
}
