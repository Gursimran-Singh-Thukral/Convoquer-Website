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
  /** Set sports: rally points scored / conceded across all sets (tie-break). */
  rallyPointsFor?: number;
  rallyPointsAgainst?: number;
  /** Chess only. */
  byes?: number;
  buchholz?: number;
  sonnebornBerger?: number;
  /** E-Sports lobbies (Free Fire / BGMI): placement and kill points. */
  placementPoints?: number;
  killPoints?: number;
}

interface LobbyDetails {
  game?: string;
  entries: {
    teamId: string;
    rank: number | null;
    kills?: number;
    placementPoints?: number;
    killPoints?: number;
  }[];
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

    const isChess = /chess/i.test(tournament.sport?.name ?? '');
    // Tie-breaks after match points — Chess (Men), the Swiss: Sonneborn-Berger
    // then the direct encounter. Chess (Women), the round robin: Buchholz then
    // Sonneborn-Berger.
    const swiss =
      isChess &&
      /men/i.test(tournament.sport?.name ?? '') &&
      !/women/i.test(tournament.sport?.name ?? '');

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

    // E-Sports lobbies (Free Fire / BGMI) are ranked by points over every game.
    const lobbyGames = matches.filter(
      (m) =>
        (m.result?.scoreDetails as { kind?: string } | null)?.kind === 'LOBBY',
    );
    if (lobbyGames.length)
      return {
        tournament: {
          id: tournament.id,
          name: tournament.name,
          format: tournament.format,
          sport: tournament.sport?.name || 'Unknown',
        },
        stage: stageInfo,
        standings: await this.lobbyStandings(
          tournament.sportId,
          tournament.name,
          lobbyGames.map(
            (m) => m.result!.scoreDetails as unknown as LobbyDetails,
          ),
        ),
      };

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

    // Chess bookkeeping for tie-breaks: who each team played and how it went.
    const games: { a: string; b: string; ga: number; gb: number }[] = [];

    // Swiss byes (single-team fixtures recorded as completed wins) count as a
    // win's points but not as a played game or an opponent.
    if (isChess) {
      const byeMatches = await this.prisma.match.findMany({
        where: {
          tournamentId,
          ...(stageId ? { stageId } : {}),
          teamAId: { not: null },
          teamBId: null,
          status: 'COMPLETED',
        },
        include: { teamA: { include: { institute: true } } },
      });
      for (const bye of byeMatches) {
        const t = getOrInitTeam(bye.teamA);
        t.points += ptsWin;
        t.byes = (t.byes ?? 0) + 1;
      }
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

      const sets = m.result?.scoreDetails as {
        kind?: string;
        sets?: { a: number; b: number }[];
      } | null;
      const gameSets = m.result?.scoreDetails as {
        kind?: string;
        games?: { sets: { a: number; b: number }[] }[];
      } | null;
      const allSets =
        sets?.kind === 'SETS' && Array.isArray(sets.sets)
          ? sets.sets
          : gameSets?.kind === 'GAMES' && Array.isArray(gameSets.games)
            ? gameSets.games.flatMap((g) => g.sets)
            : null;
      if (allSets) {
        const ra = allSets.reduce((t, x) => t + x.a, 0);
        const rb = allSets.reduce((t, x) => t + x.b, 0);
        teamA.rallyPointsFor = (teamA.rallyPointsFor ?? 0) + ra;
        teamA.rallyPointsAgainst = (teamA.rallyPointsAgainst ?? 0) + rb;
        teamB.rallyPointsFor = (teamB.rallyPointsFor ?? 0) + rb;
        teamB.rallyPointsAgainst = (teamB.rallyPointsAgainst ?? 0) + ra;
      }

      let winnerId = m.result?.winnerTeamId ?? m.winnerTeamId;
      if (!winnerId) {
        if (scoreA > scoreB) winnerId = m.teamAId;
        else if (scoreB > scoreA) winnerId = m.teamBId;
      }

      if (isChess)
        games.push({
          a: m.teamA.id,
          b: m.teamB.id,
          ga: winnerId === m.teamAId ? 1 : winnerId === m.teamBId ? 0 : 0.5,
          gb: winnerId === m.teamBId ? 1 : winnerId === m.teamAId ? 0 : 0.5,
        });

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

    if (isChess) {
      const pts = (id: string) => teamMap.get(id)?.points ?? 0;
      for (const t of teamMap.values()) {
        const mine = games.filter((g) => g.a === t.teamId || g.b === t.teamId);
        const opp = mine.map((g) =>
          g.a === t.teamId ? { id: g.b, g: g.ga } : { id: g.a, g: g.gb },
        );
        // Buchholz: the sum of all opponents' points.
        t.buchholz = opp.reduce((x, o) => x + pts(o.id), 0);
        // Sonneborn-Berger: opponents' points weighted by the result against them.
        t.sonnebornBerger = opp.reduce((x, o) => x + pts(o.id) * o.g, 0);
      }
    }
    const direct = (x: TeamStanding, y: TeamStanding) => {
      const g = games.find(
        (r) =>
          (r.a === x.teamId && r.b === y.teamId) ||
          (r.a === y.teamId && r.b === x.teamId),
      );
      if (!g) return 0;
      return g.a === x.teamId ? g.gb - g.ga : g.ga - g.gb;
    };

    // Sort standings. Default: points, then differential, then score for.
    // Chess follows the published tie-break orders above.
    const sorted = Array.from(teamMap.values()).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (isChess) {
        const sb = (b.sonnebornBerger ?? 0) - (a.sonnebornBerger ?? 0);
        const order = swiss
          ? [sb, direct(a, b)]
          : [(b.buchholz ?? 0) - (a.buchholz ?? 0), sb];
        const hit = order.find((d) => d !== 0);
        if (hit) return hit;
      }
      if (b.differential !== a.differential)
        return b.differential - a.differential;
      const rallyA = (a.rallyPointsFor ?? 0) - (a.rallyPointsAgainst ?? 0);
      const rallyB = (b.rallyPointsFor ?? 0) - (b.rallyPointsAgainst ?? 0);
      if (rallyB !== rallyA) return rallyB - rallyA;
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

  /**
   * Overall points table for a Free Fire / BGMI tournament: every published
   * game adds placement points (PP) and kill points (KP). Teams level on total
   * points are separated by — Free Fire: wins, KP, PP. BGMI: wins, PP, KP.
   * A win is a first-place finish (Booyah / Chicken Dinner).
   */
  private async lobbyStandings(
    sportId: string,
    tournamentName: string,
    games: LobbyDetails[],
  ): Promise<TeamStanding[]> {
    const game =
      games.find((g) => g.game)?.game ??
      (/bgmi/i.test(tournamentName) ? 'BGMI' : 'Free Fire');
    const ids = new Set(games.flatMap((g) => g.entries.map((e) => e.teamId)));
    const teams = await this.prisma.team.findMany({
      where: {
        OR: [
          { id: { in: [...ids] } },
          { sportId, name: { contains: `(${game}`, mode: 'insensitive' } },
        ],
      },
      include: { institute: true },
    });
    const rows = new Map<string, TeamStanding & { wins: number }>();
    for (const t of teams)
      rows.set(t.id, {
        teamId: t.id,
        teamName: t.name,
        instituteId: t.instituteId,
        instituteName: t.institute?.name ?? '',
        instituteShortName: t.institute?.shortName ?? null,
        played: 0,
        won: 0,
        lost: 0,
        drawn: 0,
        scoreFor: 0,
        scoreAgainst: 0,
        differential: 0,
        points: 0,
        rank: 0,
        placementPoints: 0,
        killPoints: 0,
        wins: 0,
      });
    for (const g of games)
      for (const e of g.entries) {
        const row = rows.get(e.teamId);
        if (!row) continue;
        row.played++;
        if (e.rank === 1) row.wins++;
        row.placementPoints! += e.placementPoints ?? 0;
        row.killPoints! += e.killPoints ?? e.kills ?? 0;
      }
    const list = [...rows.values()];
    for (const r of list) {
      r.points = (r.placementPoints ?? 0) + (r.killPoints ?? 0);
      r.scoreFor = r.points;
      r.won = r.wins;
      r.lost = r.played - r.wins;
    }
    const bgmi = game === 'BGMI';
    list.sort(
      (a, b) =>
        b.points - a.points ||
        b.wins - a.wins ||
        (bgmi
          ? (b.placementPoints ?? 0) - (a.placementPoints ?? 0) ||
            (b.killPoints ?? 0) - (a.killPoints ?? 0)
          : (b.killPoints ?? 0) - (a.killPoints ?? 0) ||
            (b.placementPoints ?? 0) - (a.placementPoints ?? 0)),
    );
    list.forEach((r, i) => (r.rank = i + 1));
    return list;
  }
}
