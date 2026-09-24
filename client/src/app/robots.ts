import type { MetadataRoute } from 'next';
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL;
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/organizer',
        '/security',
        '/scorer',
        '/rbac',
        '/tournaments',
        '/matches$',
        '/results/approvals',
        '/sports/manager',
        '/pass',
        '/auth-error',
        '/login',
      ],
    },
    ...(base ? { sitemap: `${base.replace(/\/$/, '')}/sitemap.xml` } : {}),
  };
}
