export class CreateTournamentDto {
  eventId!: string;
  sportId!: string;
  name!: string;
  format?: string; // KNOCKOUT, ROUND_ROBIN, LEAGUE, GROUP_KNOCKOUT
  pointsForWin?: number;
  pointsForDraw?: number;
  pointsForLoss?: number;
  rulesJson?: Record<string, any>;
}

export class UpdateTournamentDto {
  name?: string;
  format?: string;
  status?: string; // UPCOMING, ONGOING, COMPLETED
  pointsForWin?: number;
  pointsForDraw?: number;
  pointsForLoss?: number;
  rulesJson?: Record<string, any>;
}

export class TeamSeedEntryDto {
  teamId!: string;
  seedNumber!: number;
  notes?: string;
}

export class SetSeedsDto {
  seeds!: TeamSeedEntryDto[];
}

export class CreateStageDto {
  name!: string;
  sequence?: number;
  stageType?: string; // KNOCKOUT, ROUND_ROBIN
}

export class UpdateStageDto {
  name?: string;
  sequence?: number;
  status?: string;
}

export class CreateMatchDto {
  scoringMode?: 'LIVE' | 'RESULT_ONLY';
  tournamentId!: string;
  stageId?: string;
  venueId?: string;
  matchNumber?: string;
  teamAId?: string;
  teamBId?: string;
  scheduledStartTime!: string;
  scheduledEndTime?: string;
  scoreDetails?: Record<string, any>;
}

export class UpdateMatchDto {
  scoringMode?: 'LIVE' | 'RESULT_ONLY';
  stageId?: string;
  venueId?: string;
  matchNumber?: string;
  teamAId?: string;
  teamBId?: string;
  teamAScore?: number;
  teamBScore?: number;
  winnerTeamId?: string;
  status?: string;
  isTelecast?: boolean;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  scoreDetails?: Record<string, any>;
}

export class RescheduleMatchDto {
  scheduledStartTime!: string;
  scheduledEndTime?: string;
  venueId?: string;
  reason?: string;
}

export class AssignOfficialDto {
  userId!: string;
  role?: string; // SCOREKEEPER, REFEREE, UMPIRE, JUDGE
}

export class GenerateKnockoutBracketDto {
  teamIds?: string[];
  seeds?: TeamSeedEntryDto[];
  stageName?: string; // e.g. "Quarterfinals" or "Round of 16"
  defaultVenueId?: string;
  startTime!: string; // ISO date string
  matchDurationMinutes?: number; // default: 90
  breakMinutes?: number;
  simultaneousMatches?: number;
  scoringMode?: 'LIVE' | 'RESULT_ONLY'; // default: 30
}

export class GenerateRoundRobinDto {
  teamIds!: string[];
  stageName?: string; // default: "Group Stage"
  defaultVenueId?: string;
  startTime!: string;
  matchDurationMinutes?: number;
  breakMinutes?: number;
  simultaneousMatches?: number;
  scoringMode?: 'LIVE' | 'RESULT_ONLY';
}

export class GenerateSwissRoundDto {
  /** Required only for round 1 — every subsequent round derives the field from prior Swiss stages. */
  teamIds?: string[];
  defaultVenueId?: string;
  startTime!: string;
  matchDurationMinutes?: number;
  breakMinutes?: number;
  simultaneousMatches?: number;
  scoringMode?: 'LIVE' | 'RESULT_ONLY';
}
