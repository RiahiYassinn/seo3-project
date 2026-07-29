/** @type {import('next').NextConfig} */
const nextConfig = {
  // Emits .next/standalone, which the production Dockerfile copies.
  output: 'standalone',
  // Dependencies are hoisted to the monorepo root, so tracing has to start
  // there or the standalone bundle misses packages like styled-jsx.
  // Next 13 still expects this under `experimental`.
  experimental: {
    outputFileTracingRoot: require('path').join(__dirname, '../../'),
  },
  // Next 13.5's SWC minifier drops the escaping on nested backticks inside
  // template literals (seen in @radix-ui/react-progress), producing a server
  // chunk that fails to parse. Terser handles it correctly.
  swcMinify: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
};

module.exports = nextConfig;
