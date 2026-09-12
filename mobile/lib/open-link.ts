import { Alert, Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

/**
 * Opening links without losing the failure.
 *
 * Linking.openURL returns a promise, and every call site here used to ignore
 * it. When it rejected, nothing happened on screen and the rejection surfaced
 * only as an unhandled promise rejection in Sentry. That is the worst shape a
 * failure can take: invisible to the user, and invisible to us until someone
 * reads a crash report.
 *
 * It matters most for Terms and Privacy, which Apple requires to work for an
 * app selling subscriptions. A dead legal link is a rejection.
 *
 * Web pages go through an in-app browser rather than handing off to Safari.
 * It is more reliable, it keeps the user inside the app, and returning is one
 * tap instead of an app switch. Everything else (tel:, mailto:, itms-apps:)
 * has to leave the app, so it still goes through Linking, just with the
 * failure actually handled.
 */

const FAILED_TITLE = 'Could not open link';

// Some web addresses are really doorways into another app. iOS only hands them
// over when they leave the app through Linking. Opened in the in-app browser,
// apps.apple.com/account/subscriptions becomes a sign-in wall and a web page
// instead of the native subscription sheet, and a Maps link stays a web map.
const HANDOFF_HOSTS = ['apps.apple.com', 'maps.google.com', 'maps.apple.com'];

function isWebUrl(url: string): boolean {
  if (!/^https?:\/\//i.test(url)) return false;
  const host = url.replace(/^https?:\/\//i, '').split(/[/?#]/)[0].toLowerCase();
  return !HANDOFF_HOSTS.includes(host);
}

/**
 * Open a URL, telling the user if it fails instead of failing silently.
 * Never throws, so callers do not need their own catch.
 */
export async function openExternalUrl(url: string, whatItIs?: string): Promise<void> {
  const noun = whatItIs ? `the ${whatItIs}` : 'that link';
  try {
    if (isWebUrl(url)) {
      await WebBrowser.openBrowserAsync(url);
      return;
    }
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert(FAILED_TITLE, `This device cannot open ${noun}.`);
      return;
    }
    await Linking.openURL(url);
  } catch {
    Alert.alert(
      FAILED_TITLE,
      `Something went wrong opening ${noun}. Please check your connection and try again.`,
    );
  }
}
