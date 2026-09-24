import type { MetadataRoute } from 'next';
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL;
  if (!base) return [];
  return [
    '',
    '/about',
    '/sports',
    '/schedule',
    '/live',
    '/results',
    '/teams',
    '/standings',
    '/leaderboard',
    '/venues',
    '/rules',
    '/contact',
    '/news',
    '/announcements',
    '/gallery',
    '/faq',
    '/committee',
  ].map((path) => ({ url: `${base.replace(/\/$/, '')}${path}` }));
}
