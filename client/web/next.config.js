/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  swcMinify: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
};

module.exports = nextConfig;
