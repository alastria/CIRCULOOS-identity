/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // TODO: Enable strict type checking in production
    ignoreBuildErrors: process.env.NODE_ENV !== 'production',
  },
  images: {
    unoptimized: true,
  },
  // SECURITY: Add security headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'
          },
          // Content Security Policy
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // Required for Next.js
              "style-src 'self' 'unsafe-inline'", // Required for styled-components/tailwind
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' http://localhost:* https: wss:", // Allow localhost API calls in dev
              "frame-ancestors 'self'",
              "form-action 'self'",
              "base-uri 'self'",
            ].join('; ')
          }
        ]
      }
    ]
  },
  // Turbopack for dev, webpack for build
  turbopack: {},
  webpack: (config, { isServer, webpack }) => {
    // Exclude Node.js modules from client bundle
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        assert: false,
        os: false,
        path: false,
      }

      // Ignore Node.js-only packages in client bundle
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /^(better-sqlite3|nodemailer|sql\.js)$/,
        })
      )

      // Exclude Node.js-only packages from client bundle
      config.externals = config.externals || []
      config.externals.push(
        "pino-pretty",
        "lokijs",
        "encoding",
        "tap",
        "@coinbase/wallet-sdk",
        "@gemini-wallet/core",
        "@metamask/sdk",
        "porto",
        "@safe-global/safe-apps-provider",
        "@safe-global/safe-apps-sdk",
        "@base-org/account",
        "better-sqlite3",
        "nodemailer",
        "sql.js",
      )
    } else {
      // Server-side externals
      config.externals = config.externals || []
      config.externals.push(
        "pino-pretty",
        "lokijs",
        "encoding",
        "tap",
        "@coinbase/wallet-sdk",
        "@gemini-wallet/core",
        "@metamask/sdk",
        "porto",
        "@safe-global/safe-apps-provider",
        "@safe-global/safe-apps-sdk",
        "@base-org/account",
      )
    }

    // Exclude test files from all bundles
    config.module.rules.push({
      test: /\.test\.(js|ts|tsx)$/,
      loader: 'ignore-loader'
    })

    return config
  },
}

export default nextConfig
