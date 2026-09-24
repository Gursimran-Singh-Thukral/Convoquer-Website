export const ANNOUNCEMENT_TARGETS = [
  'PUBLIC',
  'MEDIA_TEAM',
  'HOSPITALITY_TEAM',
  'SECURITY_TEAM',
  'WEB_DEV_TEAM',
  'VOLUNTEERS',
] as const;

export class CreateAnnouncementDto {
  heading!: string;
  description!: string;
  /** One or more of ANNOUNCEMENT_TARGETS. Must include at least one. */
  targets!: string[];
}
