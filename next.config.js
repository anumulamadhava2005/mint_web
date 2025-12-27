/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'www.gravatar.com',
      },
      {
        protocol: 'https',
        hostname: 's3-alpha.figma.com',
      },
      {
        protocol: 'https',
        hostname: 'api.mintit.pro',
      },
    ],
  },
  // Increase body size limit for API routes
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
};

module.exports = nextConfig;
