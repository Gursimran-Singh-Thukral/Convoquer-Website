import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { SponsorsService } from '../sponsors/sponsors.service.js';
import { departmentAllowed } from '../../common/department.js';
import { DashboardQueryDto } from './dto/dashboard.dto.js';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sponsorsService: SponsorsService,
  ) {}

  /**
   * Identifies the primary operational persona and active scopes of an organizer user.
   */
  async getUserRoleContext(userId: string) {
    const userRoles = await this.prisma.userRole.findMany({
      where: {
        userId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: { role: true },
    });

    const roleNames = userRoles.map((ur) => ur.role.name);

    let primaryRole = 'VOLUNTEER';
    let scopedSportId: string | null = null;
    let scopedEventId: string | null = null;

    if (roleNames.includes('CONVENER')) {
      primaryRole = 'CONVENER';
    } else if (roleNames.includes('CO_CONVENER')) {
      primaryRole = 'CO_CONVENER';
    } else if (roleNames.includes('OVERALL_SPORTS_COORDINATOR')) {
      primaryRole = 'OVERALL_SPORTS_COORDINATOR';
    } else if (roleNames.includes('SPORTS_COORDINATOR')) {
      primaryRole = 'SPORTS_COORDINATOR';
      const coordRole = userRoles.find(
        (ur) => ur.role.name === 'SPORTS_COORDINATOR',
      );
      scopedSportId = coordRole?.sportId || null;
      scopedEventId = coordRole?.eventId || null;
    } else if (roleNames.includes('MEDIA_HEAD')) {
      primaryRole = 'MEDIA_HEAD';
    } else if (roleNames.includes('WEB_DEV_HEAD')) {
      primaryRole = 'WEB_DEV_HEAD';
    } else if (roleNames.includes('HOSPITALITY_HEAD')) {
      primaryRole = 'HOSPITALITY_HEAD';
    } else if (roleNames.includes('SECURITY_HEAD')) {
      primaryRole = 'SECURITY_HEAD';
    } else if (roleNames.includes('SECURITY_VOLUNTEER')) {
      primaryRole = 'SECURITY_VOLUNTEER';
    }

    return {
      userId,
      primaryRole,
      allRoles: roleNames,
      scopedSportId,
      scopedEventId,
    };
  }

  /**
   * Main role-adaptive overview aggregator.
   */
  async getAdaptiveOverview(userId: string, query: DashboardQueryDto) {
    const ctx = await this.getUserRoleContext(userId);
    if (!ctx.allRoles.length)
      throw new ForbiddenException('An organizer role is required');
    const eventFilter = ctx.scopedEventId || query.eventId || undefined;

    switch (ctx.primaryRole) {
      case 'CONVENER':
      case 'CO_CONVENER':
        return this.getConvenerDashboard(eventFilter);

      case 'OVERALL_SPORTS_COORDINATOR':
        return this.getOverallSportsCoordinatorDashboard(eventFilter);

      case 'SPORTS_COORDINATOR':
        return this.getSportsCoordinatorDashboard(
          ctx.scopedSportId || query.sportId,
          eventFilter,
        );

      case 'SECURITY_HEAD':
        return this.getSecurityOverview(eventFilter, 'SECURITY_HEAD');

      case 'SECURITY_VOLUNTEER':
        return this.getSecurityVolunteerOverview(eventFilter);

      case 'HOSPITALITY_HEAD':
        return this.getVenueAudienceProjection(eventFilter);

      case 'MEDIA_HEAD':
        return this.getMediaDashboard(eventFilter);

      case 'WEB_DEV_HEAD':
        return this.getWebDevDashboard();

      default:
        return this.getVolunteerDashboard(userId);
    }
  }

  // ===================================
  // CONVENER / CO-CONVENER DASHBOARD
  // ===================================

  async getConvenerDashboard(eventId?: string) {
    const [
      sportsCount,
      tournamentsCount,
      teamsCount,
      matchesCount,
      liveMatchesCount,
      completedMatchesCount,
      pendingApprovalsCount,
      participantsCount,
      checkedInParticipantsCount,
      recentAuditLogs,
      liveMatches,
    ] = await Promise.all([
      this.prisma.sport.count({ where: eventId ? { eventId } : {} }),
      this.prisma.tournament.count({ where: eventId ? { eventId } : {} }),
      this.prisma.team.count({ where: eventId ? { eventId } : {} }),
      this.prisma.match.count({
        where: eventId ? { tournament: { eventId } } : {},
      }),
      this.prisma.match.count({
        where: {
          status: 'LIVE',
          ...(eventId ? { tournament: { eventId } } : {}),
        },
      }),
      this.prisma.match.count({
        where: {
          status: 'COMPLETED',
          ...(eventId ? { tournament: { eventId } } : {}),
        },
      }),
      this.prisma.result.count({
        where: {
          status: 'SUBMITTED',
          ...(eventId ? { match: { tournament: { eventId } } } : {}),
        },
      }),
      this.prisma.participant.count({ where: eventId ? { eventId } : {} }),
      this.prisma.participant.count({
        where: {
          isCheckedIn: true,
          ...(eventId ? { eventId } : {}),
        },
      }),
      this.prisma.auditLog.findMany({
        take: 6,
        orderBy: { time: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      this.getLiveActivity(eventId),
    ]);

    return {
      persona: 'CONVENER',
      metrics: {
        sportsCount,
        tournamentsCount,
        teamsCount,
        matchesCount,
        liveMatchesCount,
        completedMatchesCount,
        pendingApprovalsCount,
        participantsCount,
        checkedInParticipantsCount,
        checkInRate:
          participantsCount > 0
            ? Math.round((checkedInParticipantsCount / participantsCount) * 100)
            : 0,
      },
      liveMatches,
      recentAuditLogs,
    };
  }

  // ===================================
  // OVERALL SPORTS COORDINATOR DASHBOARD
  // ===================================

  async getOverallSportsCoordinatorDashboard(eventId?: string) {
    const [
      sportsCount,
      liveMatchesCount,
      pendingApprovals,
      liveMatches,
      recentResults,
      matchesCount,
      completedMatchesCount,
      participantsCount,
      checkedInParticipantsCount,
    ] = await Promise.all([
      this.prisma.sport.count({ where: eventId ? { eventId } : {} }),
      this.prisma.match.count({
        where: {
          status: 'LIVE',
          ...(eventId ? { tournament: { eventId } } : {}),
        },
      }),
      this.getPendingApprovals(undefined, eventId),
      this.getLiveActivity(eventId),
      this.prisma.result.findMany({
        where: {
          status: 'PUBLISHED',
          ...(eventId ? { match: { tournament: { eventId } } } : {}),
        },
        take: 5,
        orderBy: { publishedAt: 'desc' },
        include: {
          match: {
            include: {
              teamA: { select: { name: true } },
              teamB: { select: { name: true } },
              tournament: {
                select: { name: true, sport: { select: { name: true } } },
              },
            },
          },
        },
      }),
      this.prisma.match.count({
        where: eventId ? { tournament: { eventId } } : {},
      }),
      this.prisma.match.count({
        where: {
          status: 'COMPLETED',
          ...(eventId ? { tournament: { eventId } } : {}),
        },
      }),
      this.prisma.participant.count({ where: eventId ? { eventId } : {} }),
      this.prisma.participant.count({
        where: { isCheckedIn: true, ...(eventId ? { eventId } : {}) },
      }),
    ]);

    return {
      persona: 'OVERALL_SPORTS_COORDINATOR',
      metrics: {
        sportsCount,
        liveMatchesCount,
        pendingApprovalsCount: pendingApprovals.length,
        matchesCount,
        completedMatchesCount,
        participantsCount,
        checkedInParticipantsCount,
      },
      pendingApprovals,
      liveMatches,
      recentResults,
    };
  }

  // ===================================
  // SCOPED SPORTS COORDINATOR DASHBOARD
  // ===================================

  async getSportsCoordinatorDashboard(
    sportId?: string | null,
    eventId?: string,
  ) {
    if (!sportId) {
      return {
        persona: 'SPORTS_COORDINATOR',
        message: 'No specific sport scope assigned to your account',
        tournaments: [],
        liveMatches: [],
        matchesToday: [],
      };
    }

    const sport = await this.prisma.sport.findUnique({
      where: { id: sportId },
    });

    const [
      tournaments,
      liveMatches,
      upcomingMatches,
      pendingCount,
      matchesCount,
      completedMatchesCount,
      participantsCount,
      checkedInParticipantsCount,
    ] = await Promise.all([
      this.prisma.tournament.findMany({
        where: {
          sportId,
          ...(eventId ? { eventId } : {}),
        },
        include: { stages: true },
      }),
      this.prisma.match.findMany({
        where: {
          tournament: {
            sportId,
            ...(eventId ? { eventId } : {}),
          },
          status: 'LIVE',
        },
        include: {
          teamA: true,
          teamB: true,
          venue: true,
        },
      }),
      this.prisma.match.findMany({
        where: {
          tournament: {
            sportId,
            ...(eventId ? { eventId } : {}),
          },
          status: { in: ['SCHEDULED', 'PAUSED'] },
        },
        take: 10,
        orderBy: { scheduledStartTime: 'asc' },
        include: {
          teamA: true,
          teamB: true,
          venue: true,
        },
      }),
      this.prisma.result.count({
        where: {
          status: 'SUBMITTED',
          match: {
            tournament: {
              sportId,
              ...(eventId ? { eventId } : {}),
            },
          },
        },
      }),
      this.prisma.match.count({
        where: { tournament: { sportId, ...(eventId ? { eventId } : {}) } },
      }),
      this.prisma.match.count({
        where: {
          status: 'COMPLETED',
          tournament: { sportId, ...(eventId ? { eventId } : {}) },
        },
      }),
      this.prisma.participant.count({
        where: {
          teamMembers: { some: { team: { sportId } } },
          ...(eventId ? { eventId } : {}),
        },
      }),
      this.prisma.participant.count({
        where: {
          isCheckedIn: true,
          teamMembers: { some: { team: { sportId } } },
          ...(eventId ? { eventId } : {}),
        },
      }),
    ]);

    return {
      persona: 'SPORTS_COORDINATOR',
      sport: { id: sportId, name: sport?.name || 'Assigned Sport' },
      metrics: {
        tournamentsCount: tournaments.length,
        liveMatchesCount: liveMatches.length,
        upcomingMatchesCount: upcomingMatches.length,
        pendingApprovalsCount: pendingCount,
        matchesCount,
        completedMatchesCount,
        participantsCount,
        checkedInParticipantsCount,
        checkInRate: participantsCount
          ? Math.round((checkedInParticipantsCount / participantsCount) * 100)
          : 0,
      },
      tournaments,
      liveMatches,
      upcomingMatches,
    };
  }

  // ===================================
  // MEDIA HEAD DASHBOARD
  // ===================================

  async getMediaDashboard(eventId?: string) {
    const [liveMatches, recentCompleted, upcomingFeatured] = await Promise.all([
      this.getLiveActivity(eventId),
      this.prisma.match.findMany({
        where: {
          status: 'COMPLETED',
          ...(eventId ? { tournament: { eventId } } : {}),
        },
        take: 8,
        orderBy: { actualEndTime: 'desc' },
        include: {
          teamA: {
            select: {
              id: true,
              name: true,
              institute: { select: { shortName: true } },
            },
          },
          teamB: {
            select: {
              id: true,
              name: true,
              institute: { select: { shortName: true } },
            },
          },
          winnerTeam: { select: { id: true, name: true } },
          tournament: {
            select: { name: true, sport: { select: { name: true } } },
          },
          result: true,
        },
      }),
      this.prisma.match.findMany({
        where: {
          status: 'SCHEDULED',
          ...(eventId ? { tournament: { eventId } } : {}),
        },
        take: 6,
        orderBy: { scheduledStartTime: 'asc' },
        include: {
          teamA: {
            select: {
              id: true,
              name: true,
              institute: { select: { shortName: true } },
            },
          },
          teamB: {
            select: {
              id: true,
              name: true,
              institute: { select: { shortName: true } },
            },
          },
          tournament: {
            select: { name: true, sport: { select: { name: true } } },
          },
          venue: { select: { name: true, location: true } },
        },
      }),
    ]);

    return {
      persona: 'MEDIA_HEAD',
      liveMatches,
      recentCompleted,
      upcomingFeatured,
    };
  }

  // ===================================
  // WEB DEV HEAD DASHBOARD
  // ===================================

  async getWebDevDashboard() {
    const [userCount, roleCount, sponsors, recentAuditLogs] = await Promise.all(
      [
        this.prisma.user.count(),
        this.prisma.role.count(),
        this.sponsorsService.getSponsors(),
        this.prisma.auditLog.findMany({
          take: 10,
          orderBy: { time: 'desc' },
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        }),
      ],
    );

    return {
      persona: 'WEB_DEV_HEAD',
      metrics: {
        userCount,
        roleCount,
        sponsorCount: sponsors.length,
      },
      recentAuditLogs,
    };
  }

  // ===================================
  // VOLUNTEER DASHBOARD
  // ===================================

  async getVolunteerDashboard(userId: string) {
    const [assignedMatches, volunteer] = await Promise.all([
      this.prisma.matchOfficial.findMany({
        where: { userId },
        include: {
          match: {
            include: {
              teamA: { select: { name: true } },
              teamB: { select: { name: true } },
              venue: true,
              tournament: {
                select: { name: true, sport: { select: { name: true } } },
              },
            },
          },
        },
      }),
      this.prisma.volunteer.findUnique({ where: { userId } }),
    ]);
    // A plain volunteer sees only tasks assigned specifically to them, not their
    // whole department's tasks — department-wide visibility is a Head-only concept
    // (see OperationsTasksService.getTasks, which Heads use instead of this endpoint).
    const tasks = volunteer
      ? await this.prisma.operationsTask.findMany({
          where: { assignees: { some: { volunteerId: volunteer.id } } },
          orderBy: { createdAt: 'desc' },
        })
      : [];

    // A volunteer gets a read-only slice of what their department's Head sees —
    // never the Head's manage/create controls, never a roster of colleagues (that
    // stays Head-only, see VolunteersService.getRosterForUser). Today that means
    // Hospitality volunteers get the same expected-audience-per-venue projection
    // their Head sees; other departments' Head-only views (roster management,
    // media approval queue, RBAC/audit) have no read-only equivalent yet and are
    // deliberately withheld rather than exposed in a half-safe form.
    const isHospitalityVolunteer = departmentAllowed(
      'Hospitality',
      volunteer?.department ? [volunteer.department] : [],
    );
    const venueAudience = isHospitalityVolunteer
      ? await this.getVenueAudienceProjection()
      : null;

    return {
      persona: 'VOLUNTEER',
      assignedMatches: assignedMatches.map((am) => ({
        role: am.role,
        match: am.match,
      })),
      volunteer,
      tasks,
      venues: venueAudience?.venues,
      metrics: {
        matchesCount: assignedMatches.length,
        completedMatchesCount: assignedMatches.filter(
          (item) => item.match.status === 'COMPLETED',
        ).length,
        upcomingMatchesCount: assignedMatches.filter((item) =>
          ['SCHEDULED', 'PAUSED'].includes(item.match.status),
        ).length,
        openTasks: tasks.filter((task) => task.status !== 'DONE').length,
      },
    };
  }

  // ===================================
  // SECURITY & HOSPITALITY OVERVIEW
  // ===================================

  async getSecurityOverview(eventId?: string, persona = 'SECURITY_HEAD') {
    const [totalParticipants, checkedInCount, institutes, venues] =
      await Promise.all([
        this.prisma.participant.count({ where: eventId ? { eventId } : {} }),
        this.prisma.participant.count({
          where: {
            isCheckedIn: true,
            ...(eventId ? { eventId } : {}),
          },
        }),
        this.prisma.institute.findMany({
          where: eventId ? { eventId } : {},
          include: {
            participants: {
              select: { isCheckedIn: true },
            },
          },
        }),
        this.prisma.venue.findMany({
          where: eventId ? { eventId } : {},
          select: {
            id: true,
            name: true,
            location: true,
            _count: {
              select: { presentParticipants: { where: { isCheckedIn: true } } },
            },
          },
          orderBy: { name: 'asc' },
        }),
      ]);

    const institutesBreakdown = institutes.map((inst) => {
      const total = inst.participants.length;
      const checkedIn = inst.participants.filter((p) => p.isCheckedIn).length;
      return {
        instituteId: inst.id,
        name: inst.name,
        shortName: inst.shortName,
        totalAthletes: total,
        checkedInAthletes: checkedIn,
        pendingAthletes: total - checkedIn,
      };
    });

    return {
      persona,
      metrics: {
        totalParticipants,
        checkedInCount,
        pendingCheckInCount: totalParticipants - checkedInCount,
        checkInRate:
          totalParticipants > 0
            ? Math.round((checkedInCount / totalParticipants) * 100)
            : 0,
      },
      institutesBreakdown,
      venueOccupancy: venues.map((venue) => ({
        id: venue.id,
        name: venue.name,
        location: venue.location,
        peoplePresent: venue._count.presentParticipants,
      })),
    };
  }

  /**
   * Restricted counterpart of getSecurityOverview for rank-and-file Security
   * Volunteers: keeps the gate-relevant aggregate metrics (Security Volunteers
   * all staff the one Main Gate for the whole event) but drops the per-institute
   * breakdown, which is oversight detail a Head needs and a volunteer doesn't.
   */
  async getSecurityVolunteerOverview(eventId?: string) {
    const [totalParticipants, checkedInCount, venues] = await Promise.all([
      this.prisma.participant.count({ where: eventId ? { eventId } : {} }),
      this.prisma.participant.count({
        where: { isCheckedIn: true, ...(eventId ? { eventId } : {}) },
      }),
      this.prisma.venue.findMany({
        where: eventId ? { eventId } : {},
        select: {
          id: true,
          name: true,
          location: true,
          _count: {
            select: { presentParticipants: { where: { isCheckedIn: true } } },
          },
        },
        orderBy: { name: 'asc' },
      }),
    ]);

    return {
      persona: 'SECURITY_VOLUNTEER',
      metrics: {
        totalParticipants,
        checkedInCount,
        pendingCheckInCount: totalParticipants - checkedInCount,
        checkInRate:
          totalParticipants > 0
            ? Math.round((checkedInCount / totalParticipants) * 100)
            : 0,
      },
      venueOccupancy: venues.map((venue) => ({
        id: venue.id,
        name: venue.name,
        location: venue.location,
        peoplePresent: venue._count.presentParticipants,
      })),
    };
  }

  /**
   * Hospitality dashboard: expected audience per venue, projected from the
   * fixture list rather than physical check-ins — every participant on either
   * team of a scheduled/live match at a venue is assumed to show up as audience
   * for that match (per the organizer's own assumption for this projection).
   */
  async getVenueAudienceProjection(eventId?: string) {
    const [venues, matches] = await Promise.all([
      this.prisma.venue.findMany({
        where: eventId ? { eventId } : {},
        select: {
          id: true,
          name: true,
          location: true,
          _count: {
            select: { presentParticipants: { where: { isCheckedIn: true } } },
          },
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.match.findMany({
        where: {
          status: { in: ['SCHEDULED', 'LIVE'] },
          venueId: { not: null },
          ...(eventId ? { tournament: { eventId } } : {}),
        },
        select: {
          id: true,
          venueId: true,
          status: true,
          scheduledStartTime: true,
          tournament: { select: { sport: { select: { name: true } } } },
          teamA: { select: { id: true, name: true } },
          teamB: { select: { id: true, name: true } },
        },
      }),
    ]);

    const teamIds = [
      ...new Set(
        matches
          .flatMap((m) => [m.teamA?.id, m.teamB?.id])
          .filter((id): id is string => !!id),
      ),
    ];
    const teamMembers = teamIds.length
      ? await this.prisma.teamMember.findMany({
          where: { teamId: { in: teamIds } },
          select: { teamId: true, participantId: true },
        })
      : [];
    const participantsByTeam = new Map<string, Set<string>>();
    for (const tm of teamMembers) {
      if (!participantsByTeam.has(tm.teamId))
        participantsByTeam.set(tm.teamId, new Set());
      participantsByTeam.get(tm.teamId)!.add(tm.participantId);
    }

    const matchesByVenue = new Map<string, typeof matches>();
    for (const match of matches) {
      if (!match.venueId) continue;
      if (!matchesByVenue.has(match.venueId))
        matchesByVenue.set(match.venueId, []);
      matchesByVenue.get(match.venueId)!.push(match);
    }

    const venueProjections = venues.map((venue) => {
      const venueMatches = matchesByVenue.get(venue.id) || [];
      const expectedParticipants = new Set<string>();
      for (const match of venueMatches) {
        for (const teamId of [match.teamA?.id, match.teamB?.id]) {
          if (!teamId) continue;
          for (const participantId of participantsByTeam.get(teamId) || [])
            expectedParticipants.add(participantId);
        }
      }
      return {
        venueId: venue.id,
        venueName: venue.name,
        location: venue.location,
        matches: venueMatches.map((match) => ({
          matchId: match.id,
          sport: match.tournament.sport.name,
          teamAName: match.teamA?.name || 'TBD',
          teamBName: match.teamB?.name || 'TBD',
          scheduledStartTime: match.scheduledStartTime,
          status: match.status,
        })),
        expectedAudience: expectedParticipants.size,
        currentPhysicalOccupancy: venue._count.presentParticipants,
      };
    });

    return {
      persona: 'HOSPITALITY',
      venues: venueProjections,
      metrics: {
        totalExpectedAudience: venueProjections.reduce(
          (sum, v) => sum + v.expectedAudience,
          0,
        ),
        venuesWithActiveMatches: venueProjections.filter(
          (v) => v.matches.length > 0,
        ).length,
      },
    };
  }

  // ===================================
  // REUSABLE QUERY PIPELINES
  // ===================================

  async getPendingApprovals(sportId?: string, eventId?: string) {
    return this.prisma.result.findMany({
      where: {
        status: 'SUBMITTED',
        ...(sportId ? { match: { tournament: { sportId } } } : {}),
        ...(eventId ? { match: { tournament: { eventId } } } : {}),
      },
      include: {
        match: {
          include: {
            teamA: {
              select: {
                id: true,
                name: true,
                institute: { select: { shortName: true } },
              },
            },
            teamB: {
              select: {
                id: true,
                name: true,
                institute: { select: { shortName: true } },
              },
            },
            tournament: {
              select: {
                id: true,
                name: true,
                sport: { select: { id: true, name: true } },
              },
            },
            venue: { select: { name: true } },
          },
        },
        submitter: { select: { id: true, name: true, email: true } },
      },
      orderBy: { submittedAt: 'desc' },
    });
  }

  async getLiveActivity(eventId?: string) {
    return this.prisma.match.findMany({
      where: {
        status: 'LIVE',
        ...(eventId ? { tournament: { eventId } } : {}),
      },
      include: {
        tournament: {
          select: {
            id: true,
            name: true,
            sport: { select: { id: true, name: true } },
          },
        },
        venue: { select: { id: true, name: true, location: true } },
        teamA: {
          select: {
            id: true,
            name: true,
            institute: { select: { shortName: true } },
          },
        },
        teamB: {
          select: {
            id: true,
            name: true,
            institute: { select: { shortName: true } },
          },
        },
        scoreEvents: {
          where: { isReversed: false },
          take: 3,
          orderBy: { sequenceNumber: 'desc' },
        },
      },
      orderBy: { actualStartTime: 'desc' },
    });
  }

  async getAuditLogs(params?: {
    action?: string;
    limit?: number;
    offset?: number;
  }) {
    const take = params?.limit ? Number(params.limit) : 50;
    const skip = params?.offset ? Number(params.offset) : 0;
    const where: any = {};
    if (params?.action) {
      where.action = { contains: params.action, mode: 'insensitive' };
    }

    const [total, logs] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        take,
        skip,
        orderBy: { time: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      }),
    ]);

    return { total, take, skip, logs };
  }

  /**
   * Web Dev Head triage panel — DB connectivity/latency, process uptime, and
   * the most recent error/denial-shaped audit events, all from real state
   * (no synthetic data). There is no separate app-error log table yet, so
   * "errors" are inferred from audit actions that indicate a failure/denial.
   */
  async getSystemHealth() {
    const dbCheckStart = Date.now();
    let dbOk = true;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      dbOk = false;
    }
    const dbLatencyMs = Date.now() - dbCheckStart;

    const [totalAuditEvents, last24hAuditEvents, recentIssues] =
      await Promise.all([
        this.prisma.auditLog.count(),
        this.prisma.auditLog.count({
          where: { time: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        }),
        this.prisma.auditLog.findMany({
          where: {
            OR: [
              { action: { contains: 'FAIL', mode: 'insensitive' } },
              { action: { contains: 'DENY', mode: 'insensitive' } },
              { action: { contains: 'DENIED', mode: 'insensitive' } },
              { action: { contains: 'ERROR', mode: 'insensitive' } },
              { action: { contains: 'REVOKE', mode: 'insensitive' } },
              { action: { contains: 'OVERRIDE', mode: 'insensitive' } },
            ],
          },
          take: 15,
          orderBy: { time: 'desc' },
          include: { user: { select: { id: true, name: true, email: true } } },
        }),
      ]);

    return {
      server: {
        uptimeSeconds: Math.round(process.uptime()),
        nodeVersion: process.version,
        environment: process.env.NODE_ENV || 'development',
      },
      database: {
        connected: dbOk,
        latencyMs: dbLatencyMs,
      },
      auditActivity: {
        totalEvents: totalAuditEvents,
        last24h: last24hAuditEvents,
      },
      recentIssues,
    };
  }
}
