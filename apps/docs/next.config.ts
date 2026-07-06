import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  transpilePackages: ['@seltriva/ui']
}

export default nextConfig
