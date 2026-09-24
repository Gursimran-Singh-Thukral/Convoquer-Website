export class CreateEventDto {
  name!: string;
  slug!: string;
  edition!: string;
  startDate!: string | Date;
  endDate!: string | Date;
  description?: string;
  status?: string;
}

export class UpdateEventDto {
  name?: string;
  slug?: string;
  edition?: string;
  startDate?: string | Date;
  endDate?: string | Date;
  description?: string;
  status?: string;
}

export class CreateSportDto {
  scoringMode?: 'LIVE' | 'RESULT_ONLY';
  eventId!: string;
  name!: string;
  description?: string;
  status?: string;
}

export class UpdateSportDto {
  scoringMode?: 'LIVE' | 'RESULT_ONLY';
  name?: string;
  description?: string;
  status?: string;
}

export class CreateVenueDto {
  latitude?: number | null;
  longitude?: number | null;
  simultaneousMatches?: number;
  eventId!: string;
  name!: string;
  location?: string;
  status?: string;
  /** Percentage (0-100) position on the interactive campus map. */
  mapX?: number;
  mapY?: number;
}

export class UpdateVenueDto {
  latitude?: number | null;
  longitude?: number | null;
  simultaneousMatches?: number;
  name?: string;
  location?: string;
  status?: string;
  mapX?: number | null;
  mapY?: number | null;
}
