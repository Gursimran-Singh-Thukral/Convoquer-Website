import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller.js';
import { SessionService } from './session.service.js';
import { GoogleStrategy } from './strategies/google.strategy.js';
import { UsersModule } from '../users/users.module.js';

@Module({
  imports: [PassportModule, UsersModule],
  controllers: [AuthController],
  providers: [SessionService, GoogleStrategy],
  exports: [SessionService],
})
export class AuthModule {}
