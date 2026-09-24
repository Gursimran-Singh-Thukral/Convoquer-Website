import { Module, forwardRef } from '@nestjs/common';
import { RbacService } from './rbac.service.js';
import { RbacController } from './rbac.controller.js';
import { AuthModule } from '../auth/auth.module.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';

@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [RbacController],
  providers: [RbacService, PermissionsGuard, RolesGuard],
  exports: [RbacService, PermissionsGuard, RolesGuard],
})
export class RbacModule {}
