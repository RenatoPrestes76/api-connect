import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@seltriva/ui',
    '@seltriva/types',
    '@seltriva/config',
    '@seltriva/logger',
    '@seltriva/shared',
    '@seltriva/sdk'
  ]
}

export default nextConfig
