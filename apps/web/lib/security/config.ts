// Security configuration for DealershipAI production deployment

export const SECURITY_CONFIG = {
  // Content Security Policy
  csp: {
    'default-src': ["'self'"],
    'script-src': [
      "'self'",
      "'unsafe-eval'", // Required for Next.js in development
      "'unsafe-inline'", // Required for styled-components and dynamic styles
      'https://vercel.live',
      'https://js.sentry-cdn.com',
      'https://browser.sentry-cdn.com',
    ],
    'style-src': [
      "'self'",
      "'unsafe-inline'", // Required for styled-components
      'https://fonts.googleapis.com',
    ],
    'font-src': [
      "'self'",
      'https://fonts.gstatic.com',
    ],
    'img-src': [
      "'self'",
      'data:',
      'blob:',
      'https:',
      'https://images.unsplash.com',
      'https://via.placeholder.com',
    ],
    'connect-src': [
      "'self'",
      'https://api.openai.com',
      'https://api.anthropic.com',
      'https://api.autotrader.com',
      'https://api.cars.com',
      'https://graph.facebook.com',
      'https://api.instagram.com',
      'https://mybusinessbusinessinformation.googleapis.com',
      'https://vercel.live',
      'wss://ws.sentry-cdn.com',
      process.env.SENTRY_DSN ? new URL(process.env.SENTRY_DSN).origin : '',
      process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).origin : '',
    ].filter(Boolean),
    'frame-ancestors': ["'none'"],
    'form-action': ["'self'"],
    'base-uri': ["'self'"],
    'object-src': ["'none'"],
    'upgrade-insecure-requests': [],
  },

  // CORS settings
  cors: {
    origin: process.env.NODE_ENV === 'production'
      ? [
          'https://yourdomain.com',
          'https://dealershipai.vercel.app',
          /\.vercel\.app$/,
        ]
      : true, // Allow all origins in development
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-API-Key',
      'X-Dealer-ID',
    ],
    exposedHeaders: ['X-Total-Count', 'X-Request-ID'],
    maxAge: 86400, // 24 hours
  },

  // Rate limiting configuration
  rateLimit: {
    // API endpoints
    api: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      standardHeaders: true,
      legacyHeaders: false,
    },

    // Authentication endpoints (more restrictive)
    auth: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // limit each IP to 5 auth requests per windowMs
      standardHeaders: true,
      legacyHeaders: false,
    },

    // AI endpoints (very restrictive due to cost)
    ai: {
      windowMs: 60 * 1000, // 1 minute
      max: 10, // limit each IP to 10 AI requests per minute
      standardHeaders: true,
      legacyHeaders: false,
    },
  },

  // Security headers
  headers: {
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': [
      'camera=()',
      'microphone=()',
      'geolocation=()',
      'payment=()',
      'usb=()',
    ].join(', '),
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  },

  // Input validation
  validation: {
    maxRequestSize: '10mb',
    maxFileSize: '5mb',
    allowedFileTypes: ['.jpg', '.jpeg', '.png', '.pdf', '.csv', '.xlsx'],
    maxStringLength: 10000,
    maxArrayLength: 1000,
  },

  // Authentication security
  auth: {
    sessionTimeout: 24 * 60 * 60, // 24 hours in seconds
    maxLoginAttempts: 5,
    lockoutDuration: 15 * 60, // 15 minutes in seconds
    passwordMinLength: 8,
    requireMFA: process.env.NODE_ENV === 'production',
    jwtExpiration: '1d',
    refreshTokenExpiration: '7d',
  },

  // API key management
  apiKeys: {
    rotationInterval: 90 * 24 * 60 * 60 * 1000, // 90 days in milliseconds
    maxKeyAge: 180 * 24 * 60 * 60 * 1000, // 180 days in milliseconds
    keyLength: 32,
    algorithm: 'aes-256-gcm',
  },

  // Audit logging
  audit: {
    logAllRequests: process.env.NODE_ENV === 'production',
    logAuthEvents: true,
    logApiKeyUsage: true,
    logErrors: true,
    logDataAccess: true,
    retentionDays: 365,
  },
};

// Environment-specific overrides
if (process.env.NODE_ENV === 'development') {
  // Relax CSP for development
  SECURITY_CONFIG.csp['script-src'].push("'unsafe-eval'");
  SECURITY_CONFIG.csp['connect-src'].push('http://localhost:*', 'ws://localhost:*');

  // Disable HSTS in development
  delete SECURITY_CONFIG.headers['Strict-Transport-Security'];

  // More lenient rate limits
  SECURITY_CONFIG.rateLimit.api.max = 1000;
  SECURITY_CONFIG.rateLimit.auth.max = 50;
  SECURITY_CONFIG.rateLimit.ai.max = 100;
}

export default SECURITY_CONFIG;