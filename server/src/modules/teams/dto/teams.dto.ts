export class CreateInstituteDto {
  eventId!: string;
  name!: string;
  shortName?: string;
  logoUrl?: string;
  city?: string;
  state?: string;
}

export class UpdateInstituteDto {
  name?: string;
  shortName?: string;
  logoUrl?: string;
  city?: string;
  state?: string;
  status?: string;
}

export class CreateTeamDto {
  eventId!: string;
  instituteId!: string;
  sportId!: string;
  name!: string;
}

export class UpdateTeamDto {
  name?: string;
  status?: string;
}

export class CreateParticipantDto {
  eventId!: string;
  instituteId?: string;
  name!: string;
  photographUrl?: string;
  rollNumber?: string;
  gender?: string;
  dateOfBirth?: string | Date;
  contactNumber?: string;
  category?: string; // ATHLETE, AUDIENCE, GUEST, OFFICIAL
}

export class UpdateParticipantDto {
  name?: string;
  instituteId?: string;
  photographUrl?: string;
  rollNumber?: string;
  gender?: string;
  dateOfBirth?: string | Date;
  contactNumber?: string;
  category?: string;
  isFlagged?: boolean;
  flagReason?: string;
}

export class RegisterOnSpotAttendeeDto {
  eventId!: string;
  name!: string;
  contactNumber!: string;
  category?: string; // AUDIENCE, GUEST, ATHLETE
  instituteName?: string;
  rollNumber?: string;
  gender?: string;
  /** Data URL (or hosted URL) of a photograph taken/uploaded at the kiosk. Required. */
  photographUrl!: string;
  /** Data URL (or hosted URL) of a scanned government/college ID. Required. */
  idDocumentUrl!: string;
}

export class SecurityCheckInDto {
  participantId?: string;
  gatePassNumber?: string;
  venueId?: string;
  notes?: string;
}

export class SecurityMovementDto extends SecurityCheckInDto {
  direction!: 'ENTRY' | 'EXIT';
}

export class AddTeamMemberDto {
  participantId!: string;
  role?: string; // PLAYER, CAPTAIN, SUBSTITUTE
  jerseyNumber?: number;
}

export class UpdateTeamMemberDto {
  role?: string;
  jerseyNumber?: number;
}

export class BulkImportParticipantRow {
  name!: string;
  college!: string;
  sport?: string;
  // Distinguishes multiple squads a college fields in the same sport (e.g.
  // separate E-Sports rosters). Leave blank for sports where a college
  // fields only one team — the institute+sport pair alone identifies it.
  team?: string;
  rollNumber?: string;
  gender?: string;
  contactNumber?: string;
  role?: string; // PLAYER, CAPTAIN
  category?: string;
}

export class BulkImportDto {
  eventId!: string;
  rows!: BulkImportParticipantRow[];
  dryRun?: boolean;
}
