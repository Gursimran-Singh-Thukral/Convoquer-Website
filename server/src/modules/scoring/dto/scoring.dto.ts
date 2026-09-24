export class StartMatchDto {
  period?: string;
}

export class PauseMatchDto {
  reason?: string;
  period?: string;
}

export class ResumeMatchDto {
  period?: string;
}

export class EndMatchDto {
  winnerTeamId?: string;
  scoreDetails?: Record<string, any>;
  notes?: string;
}

export class RecordScoreEventDto {
  requestId?: string;
  teamId?: string;
  participantId?: string;
  eventType!: string;
  points?: number;
  period?: string;
  metadata?: Record<string, any>;
}

export class ReverseScoreEventDto {
  reason!: string;
}

export class UpdateScoreManualDto {
  teamAScore?: number;
  teamBScore?: number;
  winnerTeamId?: string;
  currentPeriod?: string;
  scoreDetails?: Record<string, any>;
  reason!: string;
}
