import { Module } from '@nestjs/common';
import { InstitutesService } from './institutes.service.js';
import { TeamsService } from './teams.service.js';
import { ParticipantsService } from './participants.service.js';
import { TeamsController } from './teams.controller.js';
import { AuthModule } from '../auth/auth.module.js';
import { RbacModule } from '../rbac/rbac.module.js';

@Module({
  imports: [AuthModule, RbacModule],
  controllers: [TeamsController],
  providers: [InstitutesService, TeamsService, ParticipantsService],
  exports: [InstitutesService, TeamsService, ParticipantsService],
})
export class TeamsModule {}
