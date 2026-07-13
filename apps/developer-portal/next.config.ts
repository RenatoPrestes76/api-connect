import type { NextConfig } from 'next';

const config: NextConfig = {
  serverExternalPackages: ['@prisma/client', 'pino', 'shiki'],
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
  async redirects() {
    return [{ source: '/docs', destination: '/docs/getting-started', permanent: false }];
  },
};

export default config;
