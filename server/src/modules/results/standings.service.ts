import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';

export interface TeamStanding {
  teamId: string;
  teamName: string;
  instituteId: string;
  instituteName: string;
  instituteShortName: string | null;
  played: number;
  won: number;
  lost: number;
  drawn: number;
  scoreFor: number;
  scoreAgainst: number;
  differential: number;
  points: number;
  rank: number;
}

@Injectable()
export class StandingsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Computes dynamic standings for a tournament (or specific stage/pool)
   * derived from completed matches and published results.
   */
  async getTournamentStandings(
    tournamentId: string,
    stageId?: string,
  ): Promise<{
    tournament: { id: string; name: string; format: string; sport: string };
    stage?: { id: string; name: string };
    standings: TeamStanding[];
  }> {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        sport: true,
        seeds: {
          include: {
            team: {
              include: { institute: true },
            },
          },
        },
      },
    });

    if (!tournament) {
      throw new NotFoundException(`Tournament "${tournamentId}" not found`);
    }

    let stageInfo = undefined;
    if (stageId) {
      const stage = await this.prisma.tournamentStage.findUnique({
        where: { id: stageId },
      });
      if (stage) {
        stageInfo = { id: stage.id, name: stage.name };
      }
    }

    // Points system
    const ptsWin = tournament.pointsForWin ?? 3;
    const ptsDraw = tournament.pointsForDraw ?? 1;
    const ptsLoss = tournament.pointsForLoss ?? 0;

    // Fetch matches for this tournament/stage
    const matches = await this.prisma.match.findMany({
      where: {
        tournamentId,
        ...(stageId ? { stageId } : {}),
        result: { status: 'PUBLISHED' },
      },
      include: {
        teamA: { include: { institute: true } },
        teamB: { include: { institute: true } },
        result: true,
      },
    });

    // Initialize map of teams
    const teamMap = new Map<string, TeamStanding>();

    const getOrInitTeam = (team: any): TeamStanding => {
      if (!teamMap.has(team.id)) {
        teamMap.set(team.id, {
          teamId: team.id,
          teamName: team.name,
          instituteId: team.instituteId || '',
          instituteName: team.institute?.name || '',
          instituteShortName: team.institute?.shortName || null,
          played: 0,
          won: 0,
          lost: 0,
          drawn: 0,
          scoreFor: 0,
          scoreAgainst: 0,
          differential: 0,
          points: 0,
          rank: 0,
        });
      }
      return teamMap.get(team.id)!;
    };

    // Pre-populate seeded teams in tournament
    for (const seed of tournament.seeds) {
      if (seed.team) getOrInitTeam(seed.team);
    }

    // Process each match
    for (const m of matches) {
      if (!m.teamA || !m.teamB) continue;

      const teamA = getOrInitTeam(m.teamA);
      const teamB = getOrInitTeam(m.teamB);

      // Only count matches that are completed or have published results
      if (m.result?.status !== 'PUBLISHED') {
        continue;
      }

      const scoreA = m.result ? m.result.finalScoreA : (m.teamAScore ?? 0);
      const scoreB = m.result ? m.result.finalScoreB : (m.teamBScore ?? 0);

      teamA.played++;
      teamB.played++;

      teamA.scoreFor += scoreA;
      teamA.scoreAgainst += scoreB;
      teamA.differential = teamA.scoreFor - teamA.scoreAgainst;

      teamB.scoreFor += scoreB;
      teamB.scoreAgainst += scoreA;
      teamB.differential = teamB.scoreFor - teamB.scoreAgainst;

      let winnerId = m.result?.winnerTeamId ?? m.winnerTeamId;
      if (!winnerId) {
        if (scoreA > scoreB) winnerId = m.teamAId;
        else if (scoreB > scoreA) winnerId = m.teamBId;
      }

      if (winnerId === m.teamAId) {
        teamA.won++;
        teamA.points += ptsWin;
        teamB.lost++;
        teamB.points += ptsLoss;
      } else if (winnerId === m.teamBId) {
        teamB.won++;
        teamB.points += ptsWin;
        teamA.lost++;
        teamA.points += ptsLoss;
      } else {
        // Draw
        teamA.drawn++;
        teamA.points += ptsDraw;
        teamB.drawn++;
        teamB.points += ptsDraw;
      }
    }

    // Sort standings:
    // 1. Points desc
    // 2. Differential desc
    // 3. Score For desc
    const sorted = Array.from(teamMap.values()).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.differential !== a.differential)
        return b.differential - a.differential;
      return b.scoreFor - a.scoreFor;
    });

    // Assign rank
    sorted.forEach((item, index) => {
      item.rank = index + 1;
    });

    return {
      tournament: {
        id: tournament.id,
        name: tournament.name,
        format: tournament.format,
        sport: tournament.sport?.name || 'Unknown',
      },
      stage: stageInfo,
      standings: sorted,
    };
  }
}
