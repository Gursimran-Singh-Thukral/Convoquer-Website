export class CreateVolunteerDto {
  name!: string;
  email!: string;
  contactNumber?: string;
  // One of CANONICAL_DEPARTMENTS (see server/src/common/department.ts) — a
  // volunteer belongs to exactly one department.
  department?: string;
  shift?: string; // 'MORNING', 'AFTERNOON', 'EVENING', 'NIGHT'
  venueId?: string; // Assigned venue or arena
  venueName?: string; // Denormalized venue name, for public-facing "point of contact" display
  status?: string; // 'ACTIVE', 'ON_BREAK', 'RELIEVED'
}

export class UpdateVolunteerDto {
  name?: string;
  email?: string;
  contactNumber?: string;
  department?: string;
  shift?: string;
  venueId?: string;
  venueName?: string;
  status?: string;
}

export class VolunteerImportRowDto {
  name!: string;
  email!: string;
  contactNumber?: string;
  department?: string;
  shift?: string;
  venueId?: string;
  venueName?: string;
  status?: string;
}
export class ImportVolunteersDto {
  rows!: VolunteerImportRowDto[];
  dryRun?: boolean;
}
export class VolunteerSheetDto {
  sheetUrl!: string;
}

export class VolunteerCheckInDto {
  venueId!: string;
}
