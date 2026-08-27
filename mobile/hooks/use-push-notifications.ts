import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';

// How notifications are presented while the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  if (!Device.isDevice) {
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  // Android needs a notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'SupportCard',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2B74D6',
    });
  }

  const tokenData = await Notifications.getDevicePushTokenAsync();
  return tokenData.data;
}

async function saveDeviceToken(token: string) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/api/apns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        action: 'register',
        device_token: token,
        platform: Platform.OS,
        environment: __DEV__ ? 'development' : 'production',
      }),
    });
  } catch {
    // Non-fatal — push is nice-to-have, not blocking
  }
}

export function usePushNotifications() {
  const notificationListener = useRef<Notifications.EventSubscription>();
  const responseListener = useRef<Notifications.EventSubscription>();

  useEffect(() => {
    registerForPushNotifications().then(token => {
      if (token) saveDeviceToken(token);
    });

    // Notification received while app is in foreground
    notificationListener.current = Notifications.addNotificationReceivedListener(_notification => {
      // Badge/sound handled by setNotificationHandler above
    });

    // User tapped a notification — route to the relevant screen
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as Record<string, string> | undefined;
      const type = data?.type;
      if (type === 'expense' || type === 'notify-expense') {
        router.push('/(tabs)/expenses');
      } else if (type === 'message') {
        router.push('/(tabs)/messages');
      } else if (type === 'calendar' || type === 'event') {
        router.push('/(tabs)/calendar');
      } else if (type === 'document') {
        router.push('/(tabs)/documents');
      } else if (type === 'school') {
        router.push('/school-hub');
      } else if (type === 'emergency') {
        router.push('/emergency-child-profile');
      } else {
        router.push('/(tabs)/');
      }
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);
}
