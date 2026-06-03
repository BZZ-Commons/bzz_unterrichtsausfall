import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'unterrichtsausfaelle.it.bzz.ch' }],
        destination: 'https://unterrichtsausfall.it.bzz.ch/:path*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
