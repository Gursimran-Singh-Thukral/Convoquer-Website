// Generated from request DTOs by scripts/generate-dto-schemas.py.
export const dtoSchemas: Record<
  string,
  Record<string, { type: string; required: boolean }>
> = {
  CreateAnnouncementDto: {
    heading: {
      type: 'string',
      required: true,
    },
    description: {
      type: 'string',
      required: true,
    },
    targets: {
      type: 'string[]',
      required: true,
    },
  },
  CreateEventDto: {
    name: {
      type: 'string',
      required: true,
    },
    slug: {
      type: 'string',
      required: true,
    },
    edition: {
      type: 'string',
      required: true,
    },
    startDate: {
      type: 'string | Date',
      required: true,
    },
    endDate: {
      type: 'string | Date',
      required: true,
    },
    description: {
      type: 'string',
      required: false,
    },
    status: {
      type: 'string',
      required: false,
    },
  },
  UpdateEventDto: {
    name: {
      type: 'string',
      required: false,
    },
    slug: {
      type: 'string',
      required: false,
    },
    edition: {
      type: 'string',
      required: false,
    },
    startDate: {
      type: 'string | Date',
      required: false,
    },
    endDate: {
      type: 'string | Date',
      required: false,
    },
    description: {
      type: 'string',
      required: false,
    },
    status: {
      type: 'string',
      required: false,
    },
  },
  CreateSportDto: {
    scoringMode: {
      type: "'LIVE' | 'RESULT_ONLY'",
      required: false,
    },
    eventId: {
      type: 'string',
      required: true,
    },
    name: {
      type: 'string',
      required: true,
    },
    description: {
      type: 'string',
      required: false,
    },
    status: {
      type: 'string',
      required: false,
    },
  },
  UpdateSportDto: {
    scoringMode: {
      type: "'LIVE' | 'RESULT_ONLY'",
      required: false,
    },
    name: {
      type: 'string',
      required: false,
    },
    description: {
      type: 'string',
      required: false,
    },
    status: {
      type: 'string',
      required: false,
    },
  },
  CreateVenueDto: {
    latitude: {
      type: 'number | null',
      required: false,
    },
    longitude: {
      type: 'number | null',
      required: false,
    },
    simultaneousMatches: {
      type: 'number',
      required: false,
    },
    eventId: {
      type: 'string',
      required: true,
    },
    name: {
      type: 'string',
      required: true,
    },
    location: {
      type: 'string',
      required: false,
    },
    status: {
      type: 'string',
      required: false,
    },
    mapX: {
      type: 'number',
      required: false,
    },
    mapY: {
      type: 'number',
      required: false,
    },
  },
  UpdateVenueDto: {
    latitude: {
      type: 'number | null',
      required: false,
    },
    longitude: {
      type: 'number | null',
      required: false,
    },
    simultaneousMatches: {
      type: 'number',
      required: false,
    },
    name: {
      type: 'string',
      required: false,
    },
    location: {
      type: 'string',
      required: false,
    },
    status: {
      type: 'string',
      required: false,
    },
    mapX: {
      type: 'number | null',
      required: false,
    },
    mapY: {
      type: 'number | null',
      required: false,
    },
  },
  CreateContentDto: {
    kind: {
      type: "'NEWS' | 'RULES' | 'CONTACT' | 'COMMITTEE' | 'FAQ'",
      required: true,
    },
    title: {
      type: 'string',
      required: true,
    },
    body: {
      type: 'string',
      required: true,
    },
    linkUrl: {
      type: 'string',
      required: false,
    },
    status: {
      type: "'DRAFT' | 'PUBLISHED' | 'ARCHIVED'",
      required: false,
    },
  },
  UpdateContentDto: {
    title: {
      type: 'string',
      required: false,
    },
    body: {
      type: 'string',
      required: false,
    },
    linkUrl: {
      type: 'string',
      required: false,
    },
    status: {
      type: "'DRAFT' | 'PUBLISHED' | 'ARCHIVED'",
      required: false,
    },
  },
  DashboardQueryDto: {
    eventId: {
      type: 'string',
      required: false,
    },
    sportId: {
      type: 'string',
      required: false,
    },
  },
  CreateTournamentDto: {
    eventId: {
      type: 'string',
      required: true,
    },
    sportId: {
      type: 'string',
      required: true,
    },
    name: {
      type: 'string',
      required: true,
    },
    format: {
      type: 'string',
      required: false,
    },
    pointsForWin: {
      type: 'number',
      required: false,
    },
    pointsForDraw: {
      type: 'number',
      required: false,
    },
    pointsForLoss: {
      type: 'number',
      required: false,
    },
    rulesJson: {
      type: 'Record<string, any>',
      required: false,
    },
  },
  UpdateTournamentDto: {
    name: {
      type: 'string',
      required: false,
    },
    format: {
      type: 'string',
      required: false,
    },
    status: {
      type: 'string',
      required: false,
    },
    pointsForWin: {
      type: 'number',
      required: false,
    },
    pointsForDraw: {
      type: 'number',
      required: false,
    },
    pointsForLoss: {
      type: 'number',
      required: false,
    },
    rulesJson: {
      type: 'Record<string, any>',
      required: false,
    },
  },
  TeamSeedEntryDto: {
    teamId: {
      type: 'string',
      required: true,
    },
    seedNumber: {
      type: 'number',
      required: true,
    },
    notes: {
      type: 'string',
      required: false,
    },
  },
  SetSeedsDto: {
    seeds: {
      type: 'TeamSeedEntryDto[]',
      required: true,
    },
  },
  CreateStageDto: {
    name: {
      type: 'string',
      required: true,
    },
    sequence: {
      type: 'number',
      required: false,
    },
    stageType: {
      type: 'string',
      required: false,
    },
  },
  UpdateStageDto: {
    name: {
      type: 'string',
      required: false,
    },
    sequence: {
      type: 'number',
      required: false,
    },
    status: {
      type: 'string',
      required: false,
    },
  },
  CreateMatchDto: {
    scoringMode: {
      type: "'LIVE' | 'RESULT_ONLY'",
      required: false,
    },
    tournamentId: {
      type: 'string',
      required: true,
    },
    stageId: {
      type: 'string',
      required: false,
    },
    venueId: {
      type: 'string',
      required: false,
    },
    matchNumber: {
      type: 'string',
      required: false,
    },
    teamAId: {
      type: 'string',
      required: false,
    },
    teamBId: {
      type: 'string',
      required: false,
    },
    scheduledStartTime: {
      type: 'string',
      required: true,
    },
    scheduledEndTime: {
      type: 'string',
      required: false,
    },
    scoreDetails: {
      type: 'Record<string, any>',
      required: false,
    },
  },
  UpdateMatchDto: {
    scoringMode: {
      type: "'LIVE' | 'RESULT_ONLY'",
      required: false,
    },
    stageId: {
      type: 'string',
      required: false,
    },
    venueId: {
      type: 'string',
      required: false,
    },
    matchNumber: {
      type: 'string',
      required: false,
    },
    teamAId: {
      type: 'string',
      required: false,
    },
    teamBId: {
      type: 'string',
      required: false,
    },
    teamAScore: {
      type: 'number',
      required: false,
    },
    teamBScore: {
      type: 'number',
      required: false,
    },
    winnerTeamId: {
      type: 'string',
      required: false,
    },
    status: {
      type: 'string',
      required: false,
    },
    isTelecast: {
      type: 'boolean',
      required: false,
    },
    scheduledStartTime: {
      type: 'string',
      required: false,
    },
    scheduledEndTime: {
      type: 'string',
      required: false,
    },
    scoreDetails: {
      type: 'Record<string, any>',
      required: false,
    },
  },
  RescheduleMatchDto: {
    scheduledStartTime: {
      type: 'string',
      required: true,
    },
    scheduledEndTime: {
      type: 'string',
      required: false,
    },
    venueId: {
      type: 'string',
      required: false,
    },
    reason: {
      type: 'string',
      required: false,
    },
  },
  AssignOfficialDto: {
    userId: {
      type: 'string',
      required: true,
    },
    role: {
      type: 'string',
      required: false,
    },
  },
  GenerateKnockoutBracketDto: {
    teamIds: {
      type: 'string[]',
      required: false,
    },
    seeds: {
      type: 'TeamSeedEntryDto[]',
      required: false,
    },
    stageName: {
      type: 'string',
      required: false,
    },
    defaultVenueId: {
      type: 'string',
      required: false,
    },
    startTime: {
      type: 'string',
      required: true,
    },
    matchDurationMinutes: {
      type: 'number',
      required: false,
    },
    breakMinutes: {
      type: 'number',
      required: false,
    },
    simultaneousMatches: {
      type: 'number',
      required: false,
    },
    scoringMode: {
      type: "'LIVE' | 'RESULT_ONLY'",
      required: false,
    },
  },
  GenerateRoundRobinDto: {
    teamIds: {
      type: 'string[]',
      required: true,
    },
    stageName: {
      type: 'string',
      required: false,
    },
    defaultVenueId: {
      type: 'string',
      required: false,
    },
    startTime: {
      type: 'string',
      required: true,
    },
    matchDurationMinutes: {
      type: 'number',
      required: false,
    },
    breakMinutes: {
      type: 'number',
      required: false,
    },
    simultaneousMatches: {
      type: 'number',
      required: false,
    },
    scoringMode: {
      type: "'LIVE' | 'RESULT_ONLY'",
      required: false,
    },
  },
  GenerateSwissRoundDto: {
    teamIds: {
      type: 'string[]',
      required: false,
    },
    defaultVenueId: {
      type: 'string',
      required: false,
    },
    startTime: {
      type: 'string',
      required: true,
    },
    matchDurationMinutes: {
      type: 'number',
      required: false,
    },
    breakMinutes: {
      type: 'number',
      required: false,
    },
    simultaneousMatches: {
      type: 'number',
      required: false,
    },
    scoringMode: {
      type: "'LIVE' | 'RESULT_ONLY'",
      required: false,
    },
  },
  SubmitMediaAssetDto: {
    slot: {
      type: 'string',
      required: true,
    },
    title: {
      type: 'string',
      required: true,
    },
    category: {
      type: 'string',
      required: false,
    },
    caption: {
      type: 'string',
      required: false,
    },
    imageUrl: {
      type: 'string',
      required: true,
    },
    aspect: {
      type: 'string',
      required: false,
    },
  },
  RejectMediaAssetDto: {
    reason: {
      type: 'string',
      required: false,
    },
  },
  CreateOperationsTaskDto: {
    title: {
      type: 'string',
      required: true,
    },
    department: {
      type: 'string',
      required: false,
    },
    assigneeIds: {
      type: 'string[]',
      required: false,
    },
    matchId: {
      type: 'string',
      required: false,
    },
    priority: {
      type: 'string',
      required: false,
    },
  },
  UpdateOperationsTaskDto: {
    title: {
      type: 'string',
      required: false,
    },
    department: {
      type: 'string',
      required: false,
    },
    assigneeIds: {
      type: 'string[]',
      required: false,
    },
    matchId: {
      type: 'string | null',
      required: false,
    },
    priority: {
      type: 'string',
      required: false,
    },
    status: {
      type: 'string',
      required: false,
    },
  },
  SubmitResultDto: {
    winnerTeamId: {
      type: 'string',
      required: false,
    },
    finalScoreA: {
      type: 'number',
      required: false,
    },
    finalScoreB: {
      type: 'number',
      required: false,
    },
    scoreDetails: {
      type: 'Record<string, any>',
      required: false,
    },
    notes: {
      type: 'string',
      required: false,
    },
  },
  ApproveResultDto: {
    notes: {
      type: 'string',
      required: false,
    },
  },
  RejectResultDto: {
    reason: {
      type: 'string',
      required: true,
    },
  },
  OverrideResultDto: {
    winnerTeamId: {
      type: 'string',
      required: false,
    },
    finalScoreA: {
      type: 'number',
      required: true,
    },
    finalScoreB: {
      type: 'number',
      required: true,
    },
    scoreDetails: {
      type: 'Record<string, any>',
      required: false,
    },
    reason: {
      type: 'string',
      required: true,
    },
  },
  AwardMedalDto: {
    eventId: {
      type: 'string',
      required: true,
    },
    sportId: {
      type: 'string',
      required: true,
    },
    tournamentId: {
      type: 'string',
      required: false,
    },
    instituteId: {
      type: 'string',
      required: true,
    },
    type: {
      type: "'GOLD' | 'SILVER' | 'BRONZE'",
      required: true,
    },
    notes: {
      type: 'string',
      required: false,
    },
  },
  StartMatchDto: {
    period: {
      type: 'string',
      required: false,
    },
  },
  PauseMatchDto: {
    reason: {
      type: 'string',
      required: false,
    },
    period: {
      type: 'string',
      required: false,
    },
  },
  ResumeMatchDto: {
    period: {
      type: 'string',
      required: false,
    },
  },
  EndMatchDto: {
    winnerTeamId: {
      type: 'string',
      required: false,
    },
    scoreDetails: {
      type: 'Record<string, any>',
      required: false,
    },
    notes: {
      type: 'string',
      required: false,
    },
  },
  RecordScoreEventDto: {
    requestId: {
      type: 'string',
      required: false,
    },
    teamId: {
      type: 'string',
      required: false,
    },
    participantId: {
      type: 'string',
      required: false,
    },
    eventType: {
      type: 'string',
      required: true,
    },
    points: {
      type: 'number',
      required: false,
    },
    period: {
      type: 'string',
      required: false,
    },
    metadata: {
      type: 'Record<string, any>',
      required: false,
    },
  },
  ReverseScoreEventDto: {
    reason: {
      type: 'string',
      required: true,
    },
  },
  UpdateScoreManualDto: {
    teamAScore: {
      type: 'number',
      required: false,
    },
    teamBScore: {
      type: 'number',
      required: false,
    },
    winnerTeamId: {
      type: 'string',
      required: false,
    },
    currentPeriod: {
      type: 'string',
      required: false,
    },
    scoreDetails: {
      type: 'Record<string, any>',
      required: false,
    },
    reason: {
      type: 'string',
      required: true,
    },
  },
  UpdateSiteSettingsDto: {
    logoUrl: {
      type: 'string',
      required: false,
    },
  },
  CreateSponsorDto: {
    name: {
      type: 'string',
      required: true,
    },
    role: {
      type: 'string',
      required: true,
    },
    tier: {
      type: 'string',
      required: false,
    },
    color: {
      type: 'string',
      required: false,
    },
    logoUrl: {
      type: 'string',
      required: false,
    },
    websiteUrl: {
      type: 'string',
      required: false,
    },
    description: {
      type: 'string',
      required: false,
    },
    orderIndex: {
      type: 'number',
      required: false,
    },
  },
  UpdateSponsorDto: {
    name: {
      type: 'string',
      required: false,
    },
    role: {
      type: 'string',
      required: false,
    },
    tier: {
      type: 'string',
      required: false,
    },
    color: {
      type: 'string',
      required: false,
    },
    logoUrl: {
      type: 'string',
      required: false,
    },
    websiteUrl: {
      type: 'string',
      required: false,
    },
    description: {
      type: 'string',
      required: false,
    },
    orderIndex: {
      type: 'number',
      required: false,
    },
  },
  CreateInstituteDto: {
    eventId: {
      type: 'string',
      required: true,
    },
    name: {
      type: 'string',
      required: true,
    },
    shortName: {
      type: 'string',
      required: false,
    },
    logoUrl: {
      type: 'string',
      required: false,
    },
    city: {
      type: 'string',
      required: false,
    },
    state: {
      type: 'string',
      required: false,
    },
  },
  UpdateInstituteDto: {
    name: {
      type: 'string',
      required: false,
    },
    shortName: {
      type: 'string',
      required: false,
    },
    logoUrl: {
      type: 'string',
      required: false,
    },
    city: {
      type: 'string',
      required: false,
    },
    state: {
      type: 'string',
      required: false,
    },
    status: {
      type: 'string',
      required: false,
    },
  },
  CreateTeamDto: {
    eventId: {
      type: 'string',
      required: true,
    },
    instituteId: {
      type: 'string',
      required: true,
    },
    sportId: {
      type: 'string',
      required: true,
    },
    name: {
      type: 'string',
      required: true,
    },
  },
  UpdateTeamDto: {
    name: {
      type: 'string',
      required: false,
    },
    status: {
      type: 'string',
      required: false,
    },
  },
  CreateParticipantDto: {
    eventId: {
      type: 'string',
      required: true,
    },
    instituteId: {
      type: 'string',
      required: false,
    },
    name: {
      type: 'string',
      required: true,
    },
    photographUrl: {
      type: 'string',
      required: false,
    },
    rollNumber: {
      type: 'string',
      required: false,
    },
    gender: {
      type: 'string',
      required: false,
    },
    dateOfBirth: {
      type: 'string | Date',
      required: false,
    },
    contactNumber: {
      type: 'string',
      required: false,
    },
    category: {
      type: 'string',
      required: false,
    },
  },
  UpdateParticipantDto: {
    name: {
      type: 'string',
      required: false,
    },
    instituteId: {
      type: 'string',
      required: false,
    },
    photographUrl: {
      type: 'string',
      required: false,
    },
    rollNumber: {
      type: 'string',
      required: false,
    },
    gender: {
      type: 'string',
      required: false,
    },
    dateOfBirth: {
      type: 'string | Date',
      required: false,
    },
    contactNumber: {
      type: 'string',
      required: false,
    },
    category: {
      type: 'string',
      required: false,
    },
    isFlagged: {
      type: 'boolean',
      required: false,
    },
    flagReason: {
      type: 'string',
      required: false,
    },
  },
  RegisterOnSpotAttendeeDto: {
    eventId: {
      type: 'string',
      required: true,
    },
    name: {
      type: 'string',
      required: true,
    },
    contactNumber: {
      type: 'string',
      required: true,
    },
    category: {
      type: 'string',
      required: false,
    },
    instituteName: {
      type: 'string',
      required: false,
    },
    rollNumber: {
      type: 'string',
      required: false,
    },
    gender: {
      type: 'string',
      required: false,
    },
    photographUrl: {
      type: 'string',
      required: true,
    },
    idDocumentUrl: {
      type: 'string',
      required: true,
    },
  },
  SecurityCheckInDto: {
    participantId: {
      type: 'string',
      required: false,
    },
    gatePassNumber: {
      type: 'string',
      required: false,
    },
    venueId: {
      type: 'string',
      required: false,
    },
    notes: {
      type: 'string',
      required: false,
    },
  },
  AddTeamMemberDto: {
    participantId: {
      type: 'string',
      required: true,
    },
    role: {
      type: 'string',
      required: false,
    },
    jerseyNumber: {
      type: 'number',
      required: false,
    },
  },
  UpdateTeamMemberDto: {
    role: {
      type: 'string',
      required: false,
    },
    jerseyNumber: {
      type: 'number',
      required: false,
    },
  },
  BulkImportParticipantRow: {
    name: {
      type: 'string',
      required: true,
    },
    college: {
      type: 'string',
      required: true,
    },
    sport: {
      type: 'string',
      required: false,
    },
    rollNumber: {
      type: 'string',
      required: false,
    },
    gender: {
      type: 'string',
      required: false,
    },
    contactNumber: {
      type: 'string',
      required: false,
    },
    role: {
      type: 'string',
      required: false,
    },
    category: {
      type: 'string',
      required: false,
    },
  },
  BulkImportDto: {
    eventId: {
      type: 'string',
      required: true,
    },
    rows: {
      type: 'BulkImportParticipantRow[]',
      required: true,
    },
    dryRun: {
      type: 'boolean',
      required: false,
    },
  },
  CreateVolunteerDto: {
    name: {
      type: 'string',
      required: true,
    },
    email: {
      type: 'string',
      required: true,
    },
    contactNumber: {
      type: 'string',
      required: false,
    },
    department: {
      type: 'string',
      required: false,
    },
    shift: {
      type: 'string',
      required: false,
    },
    venueId: {
      type: 'string',
      required: false,
    },
    venueName: {
      type: 'string',
      required: false,
    },
    status: {
      type: 'string',
      required: false,
    },
  },
  UpdateVolunteerDto: {
    name: {
      type: 'string',
      required: false,
    },
    email: {
      type: 'string',
      required: false,
    },
    contactNumber: {
      type: 'string',
      required: false,
    },
    department: {
      type: 'string',
      required: false,
    },
    shift: {
      type: 'string',
      required: false,
    },
    venueId: {
      type: 'string',
      required: false,
    },
    venueName: {
      type: 'string',
      required: false,
    },
    status: {
      type: 'string',
      required: false,
    },
  },
  VolunteerImportRowDto: {
    name: {
      type: 'string',
      required: true,
    },
    email: {
      type: 'string',
      required: true,
    },
    contactNumber: {
      type: 'string',
      required: false,
    },
    department: {
      type: 'string',
      required: false,
    },
    shift: {
      type: 'string',
      required: false,
    },
    venueId: {
      type: 'string',
      required: false,
    },
    venueName: {
      type: 'string',
      required: false,
    },
    status: {
      type: 'string',
      required: false,
    },
  },
  ImportVolunteersDto: {
    rows: {
      type: 'VolunteerImportRowDto[]',
      required: true,
    },
    dryRun: {
      type: 'boolean',
      required: false,
    },
  },
  VolunteerSheetDto: {
    sheetUrl: {
      type: 'string',
      required: true,
    },
  },
  VolunteerCheckInDto: {
    venueId: {
      type: 'string',
      required: true,
    },
  },
  AssignRoleDto: {
    role: {
      type: 'string',
      required: true,
    },
    volunteerId: {
      type: 'string',
      required: false,
    },
    sportId: {
      type: 'string',
      required: false,
    },
    eventId: {
      type: 'string',
      required: false,
    },
    department: {
      type: 'string',
      required: false,
    },
    expiresAt: {
      type: 'string',
      required: false,
    },
  },
};
