import { Module, forwardRef } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller.js';
import { SessionService } from './session.service.js';
import { GoogleStrategy } from './strategies/google.strategy.js';
import { UsersModule } from '../users/users.module.js';
import { RbacModule } from '../rbac/rbac.module.js';

@Module({
  imports: [
    PassportModule,
    forwardRef(() => UsersModule),
    forwardRef(() => RbacModule),
  ],
  controllers: [AuthController],
  providers: [SessionService, GoogleStrategy],
  exports: [SessionService],
})
export class AuthModule {}
