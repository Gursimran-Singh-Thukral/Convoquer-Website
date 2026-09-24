import { Module } from '@nestjs/common';
import { MediaAssetsController } from './media-assets.controller.js';
import { MediaAssetsService } from './media-assets.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { RbacModule } from '../rbac/rbac.module.js';

@Module({
  imports: [AuthModule, RbacModule],
  controllers: [MediaAssetsController],
  providers: [MediaAssetsService],
  exports: [MediaAssetsService],
})
export class MediaAssetsModule {}
