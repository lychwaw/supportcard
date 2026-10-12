/**
 * The disclosure Google requires before asking for location.
 *
 * Play's User Data policy requires a prominent in-app disclosure BEFORE the
 * system permission prompt whenever an app collects location: what is
 * collected, what it is used for, and that it is collected even when that is
 * obvious from context. Calling requestForegroundPermissionsAsync() straight
 * away, which is what this app used to do, is one of the most common reasons
 * an app requesting ACCESS_FINE_LOCATION is rejected.
 *
 * It matters more here than for most apps. The coordinates are precise, and
 * the other parent can see them, so the person agreeing deserves to know that
 * before the prompt appears rather than after.
 *
 * Shown only when permission has not already been granted, so it appears once
 * rather than on every check-in.
 */

import { Alert } from 'react-native';
import * as Location from 'expo-location';

export async function requestLocationWithDisclosure(): Promise<Location.PermissionStatus> {
  const existing = await Location.getForegroundPermissionsAsync();
  if (existing.status === Location.PermissionStatus.GRANTED) return existing.status;

  // Permission already refused and not askable again: the system prompt will
  // not reappear, so a disclosure would just be a dead end.
  if (!existing.canAskAgain) return existing.status;

  const agreed = await new Promise<boolean>(resolve => {
    Alert.alert(
      'Care Clock uses your location',
      'When you log a check-in with GPS on, SupportCard records where you are at that moment and saves it to your family\'s record.\n\n' +
      'Your co-parent can see those locations, which is the point: it gives you both an objective record of where handovers happened.\n\n' +
      'Location is only read when you log a check-in. It is never tracked in the background.',
      [
        { text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Continue', onPress: () => resolve(true) },
      ],
      { cancelable: false },
    );
  });

  if (!agreed) return Location.PermissionStatus.DENIED;

  const { status } = await Location.requestForegroundPermissionsAsync();
  return status;
}
