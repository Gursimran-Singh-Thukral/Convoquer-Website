export class CreateContentDto {
  kind!: 'NEWS' | 'RULES' | 'CONTACT' | 'COMMITTEE' | 'FAQ';
  title!: string;
  body!: string;
  linkUrl?: string;
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
}

export class UpdateContentDto {
  title?: string;
  body?: string;
  linkUrl?: string;
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
}
