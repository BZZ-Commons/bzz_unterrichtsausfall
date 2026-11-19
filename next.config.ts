import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'unterrichtsausfaelle.bzz.ch' }],
        destination: 'https://unterrichtsausfall.bzz.ch/:path*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
