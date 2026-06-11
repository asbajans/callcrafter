import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/lib/i18n.ts');

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      buffer: false,
      crypto: false,
    };
    return config;
  },
  async redirects() {
    return [
      {
        source: '/',
        destination: '/tr',
        permanent: false,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
