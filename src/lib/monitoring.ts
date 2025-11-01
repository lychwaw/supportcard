// Error monitoring and analytics setup
import * as Sentry from '@sentry/react';
import { Analytics } from '@vercel/analytics/react';

// Initialize Sentry for error tracking
export const initSentry = () => {
  // Only initialize if we have a DSN
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) {
    console.log('Sentry DSN not provided, skipping initialization');
    return;
  }

  try {
    Sentry.init({
      dsn: dsn,
      environment: import.meta.env.MODE || 'development',
      integrations: [
        new Sentry.BrowserTracing(),
        new Sentry.Replay({
          maskAllText: false,
          blockAllMedia: false,
        }),
      ],
      tracesSampleRate: 1.0,
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
    });
    console.log('Sentry initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Sentry:', error);
  }
};

// Error tracking utilities
export const trackError = (error: Error, context?: Record<string, any>) => {
  console.error('Error tracked:', error);
  Sentry.captureException(error, {
    tags: context,
  });
};

export const trackEvent = (eventName: string, properties?: Record<string, any>) => {
  console.log('Event tracked:', eventName, properties);
  Sentry.addBreadcrumb({
    message: eventName,
    level: 'info',
    data: properties,
  });
};

// Performance monitoring
export const trackPerformance = (name: string, startTime: number) => {
  const duration = performance.now() - startTime;
  console.log(`Performance: ${name} took ${duration}ms`);
  
  Sentry.addBreadcrumb({
    message: `Performance: ${name}`,
    level: 'info',
    data: { duration },
  });
};

// User analytics
export const trackUserAction = (action: string, properties?: Record<string, any>) => {
  trackEvent(`user_action_${action}`, {
    timestamp: new Date().toISOString(),
    ...properties,
  });
};

// Page view tracking
export const trackPageView = (page: string) => {
  trackEvent('page_view', {
    page,
    timestamp: new Date().toISOString(),
  });
};

// Business metrics
export const trackBusinessMetric = (metric: string, value: number, properties?: Record<string, any>) => {
  trackEvent('business_metric', {
    metric,
    value,
    ...properties,
  });
};

// Export Analytics component for Vercel
export { Analytics };
