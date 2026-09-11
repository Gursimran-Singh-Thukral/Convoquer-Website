import { Module } from '@nestjs/common';
import { EventsService } from './events.service.js';
import { SportsService } from './sports.service.js';
import { VenuesService } from './venues.service.js';
import { CompetitionController } from './competition.controller.js';
import { AuthModule } from '../auth/auth.module.js';
import { RbacModule } from '../rbac/rbac.module.js';

@Module({
  imports: [AuthModule, RbacModule],
  controllers: [CompetitionController],
  providers: [EventsService, SportsService, VenuesService],
  exports: [EventsService, SportsService, VenuesService],
})
export class CompetitionModule {}
