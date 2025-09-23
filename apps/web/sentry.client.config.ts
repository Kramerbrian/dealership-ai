import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
const ENVIRONMENT = process.env.NODE_ENV || 'development';
const RELEASE = process.env.VERCEL_GIT_COMMIT_SHA || 'dev';

Sentry.init({
  dsn: SENTRY_DSN,
  environment: ENVIRONMENT,
  release: `dealershipai@${RELEASE}`,

  // Performance monitoring
  tracesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,

  // Session replay
  replaysSessionSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,
  replaysOnErrorSampleRate: 1.0,

  // Configure the scope
  beforeSend(event, hint) {
    // Filter out common non-critical errors
    const error = hint.originalException;

    if (error && typeof error === 'object' && 'message' in error) {
      const message = error.message as string;

      // Filter out network errors that are not actionable
      if (
        message.includes('Network Error') ||
        message.includes('fetch') ||
        message.includes('AbortError') ||
        message.includes('timeout')
      ) {
        return null;
      }

      // Filter out authentication errors (these are expected)
      if (
        message.includes('Unauthorized') ||
        message.includes('Authentication') ||
        message.includes('Invalid token')
      ) {
        return null;
      }
    }

    // Add custom context for DealershipAI
    event.contexts = {
      ...event.contexts,
      dealershipai: {
        component: 'web-client',
        feature: event.tags?.feature || 'unknown',
        dealerId: event.user?.dealerId || null,
        userRole: event.user?.role || null
      }
    };

    return event;
  },

  // Configure integrations
  integrations: [
    new Sentry.Replay({
      // Mask sensitive data
      maskAllText: true,
      maskAllInputs: true,
      blockAllMedia: true,
    }),
    new Sentry.BrowserTracing({
      // Set up automatic route change tracking for Next.js Router
      routingInstrumentation: Sentry.nextRouterInstrumentation,
    }),
  ],

  // Configure tags
  initialScope: {
    tags: {
      component: 'web-client',
      platform: 'nextjs'
    },
  },

  // Debug mode for development
  debug: ENVIRONMENT === 'development',
});