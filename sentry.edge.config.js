// This file configures the initialization of Sentry for edge runtimes.
// The config you add here will be used whenever your application gets used in an edge runtime.
// Note that edge runtimes use a different environment, so your DSN and other config may differ.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 1.0,
  
  // For Edge environments where traditional console output may not be available
  debug: false,
  
  environment: process.env.NODE_ENV,
}); 