export class SubmitResultDto {
  winnerTeamId?: string;
  finalScoreA?: number;
  finalScoreB?: number;
  scoreDetails?: Record<string, any>;
  notes?: string;
}

export class ApproveResultDto {
  notes?: string;
}

export class RejectResultDto {
  reason!: string;
}

export class OverrideResultDto {
  winnerTeamId?: string;
  finalScoreA!: number;
  finalScoreB!: number;
  scoreDetails?: Record<string, any>;
  reason!: string;
}

export class AwardMedalDto {
  eventId!: string;
  sportId!: string;
  tournamentId?: string;
  instituteId!: string;
  type!: 'GOLD' | 'SILVER' | 'BRONZE';
  notes?: string;
}
