import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_BUILD_DIR || '.next',
  reactCompiler: true,
  allowedDevOrigins: ['127.0.0.1'],
  poweredByHeader: false,
  async rewrites() {
    const upstream = (process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000/api').replace(
      /\/+$/,
      '',
    );
    return [{ source: '/api/:path*', destination: `${upstream}/:path*` }];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
      ...[
        'organizer',
        'scorer',
        'security',
        'rbac',
        'tournaments',
        'results/approvals',
        'sports/manager',
      ].map((path) => ({
        source: `/${path}/:path*`,
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      })),
      { source: '/matches', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

export default nextConfig;
