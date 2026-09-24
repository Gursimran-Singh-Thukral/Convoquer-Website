import { Module } from '@nestjs/common';
import { OperationsTasksController } from './operations-tasks.controller.js';
import { OperationsTasksService } from './operations-tasks.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { RbacModule } from '../rbac/rbac.module.js';
import { FixturesModule } from '../fixtures/fixtures.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [AuthModule, RbacModule, FixturesModule, NotificationsModule],
  controllers: [OperationsTasksController],
  providers: [OperationsTasksService],
  exports: [OperationsTasksService],
})
export class OperationsTasksModule {}
