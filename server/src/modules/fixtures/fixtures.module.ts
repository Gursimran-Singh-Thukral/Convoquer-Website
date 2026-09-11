import { Module } from '@nestjs/common';
import { TournamentsService } from './tournaments.service.js';
import { MatchesService } from './matches.service.js';
import { FixturesController } from './fixtures.controller.js';
import { RbacModule } from '../rbac/rbac.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [RbacModule, AuthModule],
  controllers: [FixturesController],
  providers: [TournamentsService, MatchesService],
  exports: [TournamentsService, MatchesService],
})
export class FixturesModule {}
