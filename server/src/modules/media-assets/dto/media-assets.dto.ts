export const MEDIA_SLOTS = ['GALLERY', 'ABOUT'] as const;
export type MediaSlot = (typeof MEDIA_SLOTS)[number];

export class SubmitMediaAssetDto {
  slot!: string; // GALLERY, ABOUT
  title!: string;
  category?: string;
  caption?: string;
  imageUrl!: string; // data URL or hosted URL
  aspect?: string; // wide, tall, standard (gallery layout hint only)
}

export class RejectMediaAssetDto {
  reason?: string;
}
