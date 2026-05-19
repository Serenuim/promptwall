/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allows cross-origin API calls in dev
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
        ],
      },
    ]
  },
}
module.exports = nextConfig
