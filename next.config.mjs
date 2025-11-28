/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb'
    }
  },
  eslint: {
    // Skip ESLint during build; run separately via `npm run lint`
    ignoreDuringBuilds: true
  }
};

export default nextConfig;
