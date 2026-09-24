import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { createObserveModule } from '@nestjs/observe';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { DatabaseModule } from './database/database.module.js';
import { AuthRateLimitMiddleware } from './common/middleware/rate-limit.middleware.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { RbacModule } from './modules/rbac/rbac.module.js';
import { CompetitionModule } from './modules/competition/competition.module.js';
import { TeamsModule } from './modules/teams/teams.module.js';
import { FixturesModule } from './modules/fixtures/fixtures.module.js';
import { ScoringModule } from './modules/scoring/scoring.module.js';
import { ResultsModule } from './modules/results/results.module.js';
import { DashboardModule } from './modules/dashboard/dashboard.module.js';
import { RealtimeModule } from './modules/realtime/realtime.module.js';
import { SponsorsModule } from './modules/sponsors/sponsors.module.js';
import { VolunteersModule } from './modules/volunteers/volunteers.module.js';
import { OperationsTasksModule } from './modules/operations-tasks/operations-tasks.module.js';
import { AnnouncementsModule } from './modules/announcements/announcements.module.js';
import { SiteSettingsModule } from './modules/site-settings/site-settings.module.js';
import { MediaAssetsModule } from './modules/media-assets/media-assets.module.js';
import { AuthController } from './modules/auth/auth.controller.js';
import { ContentModule } from './modules/content/content.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ...(process.env.OBSERVE_APP_KEY && process.env.OBSERVE_APP_SECRET
      ? [
          ObserveModule.forRoot({
            appKey: process.env.OBSERVE_APP_KEY ?? 'YOUR_APP_KEY',
            appSecret: process.env.OBSERVE_APP_SECRET ?? 'YOUR_APP_SECRET',
            serviceId: process.env.OBSERVE_SERVICE_ID ?? 'server',
          }),
        ]
      : []),
    DatabaseModule,
    UsersModule,
    AuthModule,
    RbacModule,
    CompetitionModule,
    TeamsModule,
    FixturesModule,
    ScoringModule,
    ResultsModule,
    DashboardModule,
    RealtimeModule,
    SponsorsModule,
    VolunteersModule,
    OperationsTasksModule,
    AnnouncementsModule,
    SiteSettingsModule,
    MediaAssetsModule,
    ContentModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthRateLimitMiddleware).forRoutes(AuthController);
  }
}
