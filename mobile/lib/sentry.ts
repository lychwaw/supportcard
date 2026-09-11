import * as Sentry from '@sentry/react-native';

/**
 * Crash and error reporting.
 *
 * Configured conservatively on purpose. This app holds custody arrangements,
 * legal documents, medical details and private messages between separated
 * parents — a crash report that leaks any of that is worse than the crash.
 * Sentry's defaults are tuned for ordinary consumer apps, so several of them
 * are turned off below.
 *
 * No-ops entirely unless EXPO_PUBLIC_SENTRY_DSN is set, so the app behaves
 * identically until you deliberately switch it on.
 */

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

export function initSentry() {
  if (!DSN) return;        // not configured — stay silent
  if (__DEV__) return;     // local crashes are already visible in the console

  Sentry.init({
    dsn: DSN,

    // Never attach IP addresses, device identifiers or request headers.
    sendDefaultPii: false,

    // Performance tracing bills against the same event quota and tells us
    // nothing we need. Crashes are the point.
    tracesSampleRate: 0,

    // Console output is the biggest leak risk — this codebase logs error
    // messages that can contain user content. Drop those breadcrumbs and keep
    // only navigation, which is just route names.
    beforeBreadcrumb(crumb) {
      if (crumb.category === 'console') return null;
      if (crumb.category === 'xhr' || crumb.category === 'fetch') {
        // Keep the fact a request happened and how it ended, drop everything
        // else — query strings and bodies can carry ids and free text.
        return {
          ...crumb,
          data: { url: typeof crumb.data?.url === 'string' ? crumb.data.url.split('?')[0] : undefined, status_code: crumb.data?.status_code },
        };
      }
      return crumb;
    },
  });
}

/**
 * Tag reports with the Supabase user id once known.
 *
 * The id only — never email or name. A UUID is enough to answer "is this one
 * person or everyone", which is the question that actually matters, without
 * putting a separated parent's identity in a third-party service.
 */
export function setSentryUser(userId: string | null) {
  if (!DSN) return;
  Sentry.setUser(userId ? { id: userId } : null);
}

/**
 * Report a handled failure — something that went wrong but didn't crash.
 *
 * Worth calling wherever a silent failure would otherwise go unnoticed. The
 * professional-notes save reported success while writing nothing for days
 * because nothing was watching that path.
 */
export function reportError(error: unknown, context?: Record<string, string>) {
  if (!DSN) return;
  Sentry.captureException(error, context ? { tags: context } : undefined);
}
