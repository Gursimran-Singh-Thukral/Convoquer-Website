import { Module } from '@nestjs/common';
import { ResultsService } from './results.service.js';
import { StandingsService } from './standings.service.js';
import { MedalsService } from './medals.service.js';
import { ResultsController } from './results.controller.js';
import { RbacModule } from '../rbac/rbac.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [RbacModule, AuthModule],
  controllers: [ResultsController],
  providers: [ResultsService, StandingsService, MedalsService],
  exports: [ResultsService, StandingsService, MedalsService],
})
export class ResultsModule {}
