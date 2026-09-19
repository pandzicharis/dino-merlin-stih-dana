import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // bez ovoga Turbopack traži root u home direktoriju
  turbopack: { root: __dirname },
  // dev overlay se preklapa s dev trakom za datum
  devIndicators: false,
}

export default nextConfig
