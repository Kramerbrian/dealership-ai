/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export configuration
  output: 'export',
  trailingSlash: true,
  basePath: '/dealership-ai',

  // Disable features not supported in static export
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },

  // Image optimization disabled for static export
  images: {
    unoptimized: true,
  },

  // Performance optimizations
  compress: true,
  poweredByHeader: false,

  // Skip API routes during static generation
  generateBuildId: () => 'static-build',

  // Webpack optimizations
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      }
    }

    // Ignore API routes during build
    config.resolve.alias = {
      ...config.resolve.alias,
      '@/app/api': false,
    };

    return config
  },
};

export default nextConfig;