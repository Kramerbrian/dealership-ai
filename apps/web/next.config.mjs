/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    typedRoutes: true
  },

  // Disable ESLint during builds
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Disable TypeScript during builds
  typescript: {
    ignoreBuildErrors: true,
  },

  // Production optimizations - Static export for GitHub Pages
  output: 'export',
  trailingSlash: true,
  basePath: '/dealership-ai',

  // Performance optimizations
  compress: true,
  poweredByHeader: false,

  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ]
  },

  // Webpack optimizations
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Reduce client-side bundle size
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      }
    }
    return config
  },

  // Image optimization - Disabled for static export
  images: {
    unoptimized: true,
  },

  // Environment-specific settings
  ...(process.env.NODE_ENV === 'production' && {
    // Production-only settings
    swcMinify: true,

    // Asset optimization
    assetPrefix: process.env.CDN_URL || '',

    // Error reporting
    sentry: {
      hideSourceMaps: true,
    },
  }),
};

export default nextConfig;