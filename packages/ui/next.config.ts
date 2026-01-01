import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Static export for Electron
  output: process.env.ELECTRON === 'true' ? 'export' : undefined,

  // For Electron static export - disable image optimization
  images: {
    unoptimized: process.env.ELECTRON === 'true',
  },

  // Transpile internal packages
  transpilePackages: ['@flowtrace/core'],

  // Disable server-side features for static export compatibility
  ...(process.env.ELECTRON === 'true' && {
    trailingSlash: true,
  }),
};

export default nextConfig;
