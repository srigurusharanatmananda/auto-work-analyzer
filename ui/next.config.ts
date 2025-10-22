import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  // Specify the UI directory as the workspace root to prevent Next.js from looking at parent lockfiles
  outputFileTracingRoot: path.join(__dirname),

  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3009/:path*'
      }
    ];
  },
};

export default nextConfig;
