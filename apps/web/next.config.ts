import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@seltriva/ui', '@seltriva/types'],
  typedRoutes: false,
  eslint: {
    // This app's src/ has never been run through the shared ESLint config —
    // matches the same pre-existing gap documented in apps/admin/next.config.ts.
    // `pnpm lint` still runs against this app's source separately.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
