import { View } from 'react-native';
import { brand } from '@/theme/colors';

/**
 * The screen the app opens on, before anyone knows who is using it.
 *
 * Without this file nothing matched "/" except the index routes inside the
 * groups, so the router opened on (auth)/index — the sign-in screen. AuthGate
 * then replaced it. That is why a signed-in person saw sign-in flash past on
 * every launch: it was not a glimpse of a slow redirect, it was the first
 * screen the app actually mounted.
 *
 * So "/" is now a screen of its own that says nothing. It is painted the
 * splash's blue, so the handoff from splash to app is invisible, and AuthGate
 * routes away from it the moment the session and the onboarding answer are
 * known. Nobody sees a screen that might be wrong for them.
 */
export default function Index() {
  return <View style={{ flex: 1, backgroundColor: brand.blue }} />;
}
