import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typedRoutes: false,
  eslint: {
    // The shared root .eslintrc.cjs currently fails to load under ESLint 9
    // (legacy config format, plus a stale rule name) across the whole
    // monorepo — a pre-existing issue, not specific to this app. `pnpm lint`
    // still runs against this app's source once that shared config is fixed.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
