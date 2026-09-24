'use client';
import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api';

export function EventDates() {
  const [label, setLabel] = useState('Dates to be announced');
  useEffect(() => {
    apiGet<Array<{ startDate: string; endDate: string }>>('/events?status=ACTIVE')
      .then((events) => {
        if (!events[0]) return;
        const format = (date: string) =>
          new Date(date).toLocaleDateString('en-IN', {
            timeZone: 'Asia/Kolkata',
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          });
        setLabel(`${format(events[0].startDate)} – ${format(events[0].endDate)}`);
      })
      .catch(() => {});
  }, []);
  return <span>{label}</span>;
}
