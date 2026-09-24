export class CreateSponsorDto {
  name!: string;
  role!: string; // e.g. 'Principal Patron', 'Apparel Partner', 'Equipment Ally'
  tier?: string; // 'TITLE', 'POWERED_BY', 'ASSOCIATE', 'OFFICIAL_PARTNER'
  color?: string; // e.g. 'text-[#FFD700]', 'text-[#FF4500]'
  logoUrl?: string;
  websiteUrl?: string;
  description?: string;
  orderIndex?: number;
}

export class UpdateSponsorDto {
  name?: string;
  role?: string;
  tier?: string;
  color?: string;
  logoUrl?: string;
  websiteUrl?: string;
  description?: string;
  orderIndex?: number;
}
