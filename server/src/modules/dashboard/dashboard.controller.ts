import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { DashboardService } from './dashboard.service.js';
import { SessionGuard } from '../../common/guards/session.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator.js';
import { DashboardQueryDto } from './dto/dashboard.dto.js';

@Controller('api/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * Primary adaptive endpoint: inspects user session, resolves their active role,
   * and delivers a role-tailored dashboard payload.
   */
  @Get('overview')
  @UseGuards(SessionGuard)
  async getOverview(@Req() req: Request, @Query() query: DashboardQueryDto) {
    const userId = (req as any).user.id;
    return this.dashboardService.getAdaptiveOverview(userId, query);
  }

  /**
   * Queue of submitted results awaiting coordinator/convener review.
   */
  @Get('pending-approvals')
  @UseGuards(SessionGuard, PermissionsGuard)
  @RequirePermissions('result.approve')
  async getPendingApprovals(
    @Query('sportId') sportId?: string,
    @Query('eventId') eventId?: string,
  ) {
    return this.dashboardService.getPendingApprovals(sportId, eventId);
  }

  /**
   * Real-time active match monitor across all sports and venues.
   */
  @Get('live-activity')
  @UseGuards(SessionGuard)
  async getLiveActivity(@Query('eventId') eventId?: string) {
    return this.dashboardService.getLiveActivity(eventId);
  }

  /**
   * Security, hospitality, and athlete attendance operations view.
   */
  @Get('security-overview')
  @UseGuards(SessionGuard, PermissionsGuard)
  @RequirePermissions('participant.view')
  async getSecurityOverview(@Query('eventId') eventId?: string) {
    return this.dashboardService.getSecurityOverview(eventId);
  }

  /**
   * Audit logs explorer endpoint
   */
  @Get('audit-logs')
  @UseGuards(SessionGuard, PermissionsGuard)
  @RequirePermissions('audit.view')
  async getAuditLogs(
    @Query('action') action?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.dashboardService.getAuditLogs({ action, limit, offset });
  }

  /**
   * Server/DB health + recent error-shaped audit activity — for the Web Dev
   * Head to triage issues without needing shell/DB access.
   */
  @Get('system-health')
  @UseGuards(SessionGuard, PermissionsGuard)
  @RequirePermissions('audit.view')
  async getSystemHealth() {
    return this.dashboardService.getSystemHealth();
  }
}
