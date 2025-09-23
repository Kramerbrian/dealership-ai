import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN;
const ENVIRONMENT = process.env.NODE_ENV || 'development';
const RELEASE = process.env.VERCEL_GIT_COMMIT_SHA || 'dev';

Sentry.init({
  dsn: SENTRY_DSN,
  environment: ENVIRONMENT,
  release: `dealershipai@${RELEASE}`,

  // Performance monitoring
  tracesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,

  // Configure the scope
  beforeSend(event, hint) {
    // Add server-specific context
    event.contexts = {
      ...event.contexts,
      dealershipai: {
        component: 'web-server',
        nodeVersion: process.version,
        platform: process.platform,
        feature: event.tags?.feature || 'unknown'
      },
      runtime: {
        name: 'node',
        version: process.version,
      }
    };

    // Filter out sensitive information from database errors
    if (event.exception?.values) {
      event.exception.values = event.exception.values.map(exception => {
        if (exception.value) {
          // Remove database connection strings and API keys from error messages
          exception.value = exception.value
            .replace(/postgresql:\/\/[^@]+@[^/]+/g, 'postgresql://***@***')
            .replace(/sk-[A-Za-z0-9]{48}/g, 'sk-***')
            .replace(/Bearer [A-Za-z0-9-._~+\/]+=*/g, 'Bearer ***');
        }
        return exception;
      });
    }

    return event;
  },

  // Configure integrations for server-side
  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
    new Sentry.Integrations.OnUncaughtException({
      exitEvenIfOtherHandlersAreRegistered: false,
    }),
    new Sentry.Integrations.OnUnhandledRejection({
      mode: 'warn',
    }),
  ],

  // Configure tags
  initialScope: {
    tags: {
      component: 'web-server',
      platform: 'nextjs',
      runtime: 'nodejs'
    },
  },

  // Debug mode for development
  debug: ENVIRONMENT === 'development',
});