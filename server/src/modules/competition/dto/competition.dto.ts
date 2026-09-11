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
  eventId!: string;
  name!: string;
  description?: string;
  status?: string;
}

export class UpdateSportDto {
  name?: string;
  description?: string;
  status?: string;
}

export class CreateVenueDto {
  eventId!: string;
  name!: string;
  location?: string;
  status?: string;
}

export class UpdateVenueDto {
  name?: string;
  location?: string;
  status?: string;
}
