export class DashboardQueryDto {
  eventId?: string;
  sportId?: string;
}

export interface BaseMetricCard {
  label: string;
  value: number | string;
  change?: string;
  status?: 'normal' | 'warning' | 'alert' | 'success';
}
