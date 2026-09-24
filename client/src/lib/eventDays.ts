// Shared day-bucketing helpers so every page that needs to group things by
// "day of the event" (schedule fixtures, the live hero banner, etc.) agrees on
// the same IST calendar-day definition instead of drifting apart.

/** IST calendar-date key (YYYY-MM-DD), used to bucket timestamps into days. */
export function toIstDateKey(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

/**
 * 1-indexed day number of `targetDate` relative to the event's `eventStartDate`,
 * e.g. Day 1 on the event's first calendar day, Day 2 the next, etc.
 */
export function dayNumberForDate(eventStartDate: Date | string, targetDate: Date | string): number {
  const startKey = toIstDateKey(eventStartDate);
  const targetKey = toIstDateKey(targetDate);
  const start = new Date(`${startKey}T00:00:00+05:30`).getTime();
  const target = new Date(`${targetKey}T00:00:00+05:30`).getTime();
  const diffDays = Math.round((target - start) / (1000 * 60 * 60 * 24));
  return diffDays + 1;
}

export function isEventLive(
  startDate: Date | string,
  endDate?: Date | string | null,
  now: Date = new Date(),
): boolean {
  const start = new Date(startDate).getTime();
  const end = endDate ? new Date(endDate).getTime() : Number.POSITIVE_INFINITY;
  return now.getTime() >= start && now.getTime() <= end;
}
