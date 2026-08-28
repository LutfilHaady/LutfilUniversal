import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  allowedDevOrigins: ['172.20.10.2', '10.130.1.105'],
  turbopack: {
    root: path.resolve(__dirname),
  },
  async headers() {
    return [
      {
        source: '/(scan|log/process-step)(.*)',
        headers: [
          { key: 'Permissions-Policy', value: 'camera=*' },
        ],
      },
    ];
  },
};

export default nextConfig;
