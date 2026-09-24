import { Module } from '@nestjs/common';
import { ScoringService } from './scoring.service.js';
import { ScoringRulesService } from './scoring-rules.service.js';
import { ScoringController } from './scoring.controller.js';
import { RbacModule } from '../rbac/rbac.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { ResultsModule } from '../results/results.module.js';

@Module({
  imports: [RbacModule, AuthModule, ResultsModule],
  controllers: [ScoringController],
  providers: [ScoringService, ScoringRulesService],
  exports: [ScoringService, ScoringRulesService],
})
export class ScoringModule {}
