import { Global, Module } from '@nestjs/common';
import { RealtimeService } from './realtime.service.js';
import { RealtimeController } from './realtime.controller.js';
import { AuthModule } from '../auth/auth.module.js';
import { RbacModule } from '../rbac/rbac.module.js';

@Global()
@Module({
  imports: [AuthModule, RbacModule],
  controllers: [RealtimeController],
  providers: [RealtimeService],
  exports: [RealtimeService],
})
export class RealtimeModule {}
