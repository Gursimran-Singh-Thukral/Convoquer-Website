import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { UsersService } from '../../users/users.service.js';
import { RbacService } from '../../rbac/rbac.service.js';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private readonly usersService: UsersService,
    private readonly rbacService: RbacService,
  ) {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      callbackURL:
        process.env.GOOGLE_CALLBACK_URL ||
        `${process.env.BACKEND_URL || 'http://localhost:4000'}/api/auth/callback`,
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    try {
      const email = profile.emails?.[0]?.value;
      if (!email) {
        return done(
          new UnauthorizedException('Email not found in Google profile'),
          false,
        );
      }

      const verified =
        profile.emails?.[0]?.verified === true ||
        profile._json?.email_verified === true;
      if (
        !verified ||
        !email.toLowerCase().endsWith('@iitjammu.ac.in') ||
        profile._json?.hd !== 'iitjammu.ac.in'
      ) {
        return done(
          new UnauthorizedException(
            'Only @iitjammu.ac.in accounts are allowed',
          ),
          false,
        );
      }

      const user = await this.usersService.findOrCreateFromGoogle(profile);
      await this.rbacService.bootstrapFirstConvenerIfNeeded(user.id, email);
      await this.rbacService.linkPendingVolunteerRole(user.id, email);
      done(null, user);
    } catch (error) {
      done(error, false);
    }
  }
}
