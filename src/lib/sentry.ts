/**
 * Utility functions for Sentry error reporting/monitoring
 * You can import and use these functions throughout the codebase
 */

import * as Sentry from '@sentry/nextjs';

/**
 * Captures an exception in Sentry
 * @param error The error object to report
 * @param context Additional context information (e.g., user info, request details)
 */
export function captureException(error: Error | unknown, context?: Record<string, any>) {
  // Add user info or other context
  if (context) {
    Sentry.configureScope((scope) => {
      if (context.user) {
        scope.setUser(context.user);
      }
      
      // Add extra info to the error
      Object.entries(context).forEach(([key, value]) => {
        if (key !== 'user') {
          scope.setExtra(key, value);
        }
      });
    });
  }

  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.error('[Sentry] Captured exception:', error);
    if (context) {
      console.error('[Sentry] Additional context:', context);
    }
  }

  return Sentry.captureException(error);
}

/**
 * Records a breadcrumb for the current user session
 * Useful for tracking user actions leading up to an error
 */
export function addBreadcrumb(
  message: string, 
  category?: string, 
  data?: Record<string, any>,
  level?: Sentry.Severity
) {
  Sentry.addBreadcrumb({
    message,
    category: category || 'custom',
    data,
    level: level || Sentry.Severity.Info,
  });
}

/**
 * Sets the current user information for error reports
 */
export function setUser(user: { id: string, email?: string, role?: string }) {
  Sentry.setUser(user);
}

/**
 * Removes the user information
 * Call this when a user logs out
 */
export function clearUser() {
  Sentry.setUser(null);
}

/**
 * Create a custom span for performance monitoring
 */
export function startSpan(operation: string, description?: string) {
  return Sentry.startTransaction({
    op: operation,
    name: description || operation,
  });
}

/**
 * Manually records a message in Sentry
 */
export function captureMessage(message: string, level?: Sentry.Severity) {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Sentry] ${level || 'info'}: ${message}`);
  }
  
  return Sentry.captureMessage(message, level);
} 