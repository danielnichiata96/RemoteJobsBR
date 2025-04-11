// This file configures the initialization of Sentry on the client (browser).
// The config you add here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 1.0,
  
  // Setting this option to true will print useful information to the console while you're setting up Sentry
  debug: process.env.NODE_ENV === 'development',

  // Show performance metrics for 5% of users in production, 100% in development
  replaysSessionSampleRate: process.env.NODE_ENV === 'production' ? 0.05 : 1.0,
  
  // Sample replay events for all errors in production, 10% otherwise
  replaysOnErrorSampleRate: process.env.NODE_ENV === 'production' ? 1.0 : 0.1,
  
  environment: process.env.NODE_ENV,
}); 