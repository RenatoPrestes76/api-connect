import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@seltriva/ui', '@seltriva/types'],
  experimental: {
    typedRoutes: false,
  },
};

export default nextConfig;
