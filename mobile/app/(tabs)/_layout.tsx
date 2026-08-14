import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Pressable, Alert } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { brand, colors } from '@/theme/colors';

type IoniconName = keyof typeof Ionicons.glyphMap;

function tabIcon(inactive: IoniconName, active: IoniconName) {
  return ({ color, focused }: { color: string; focused: boolean }) => (
    <Ionicons name={focused ? active : inactive} size={24} color={color} />
  );
}

function QuickAddFab() {
  const handlePress = () => {
    Alert.alert('Quick Add', 'What would you like to do?', [
      { text: 'Add Calendar Event', onPress: () => router.push('/(tabs)/calendar') },
      { text: 'New Expense Request', onPress: () => router.push('/(tabs)/expenses') },
      { text: 'Custody Check-in', onPress: () => router.push('/custody-clock') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <Pressable
      onPress={handlePress}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-start' }}
    >
      <View style={{
        width: 58, height: 58, borderRadius: 29,
        backgroundColor: brand.blue,
        alignItems: 'center', justifyContent: 'center',
        marginTop: -22,
        boxShadow: '0 4px 20px rgba(43,116,214,0.45)',
      }}>
        <Ionicons name="add" size={32} color="#fff" />
      </View>
    </Pressable>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: brand.blue,
        tabBarInactiveTintColor: brand.body,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.separator,
          borderTopWidth: 0.5,
          elevation: 0,
          shadowOpacity: 0,
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom + 4,
          paddingTop: 8,
          overflow: 'visible',
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', tabBarIcon: tabIcon('home-outline', 'home') }}
      />
      <Tabs.Screen
        name="calendar"
        options={{ title: 'Calendar', tabBarIcon: tabIcon('calendar-outline', 'calendar') }}
      />
      <Tabs.Screen
        name="quick-add"
        options={{
          title: '',
          tabBarLabel: () => null,
          tabBarButton: () => <QuickAddFab />,
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{ title: 'Expenses', tabBarIcon: tabIcon('receipt-outline', 'receipt') }}
      />
      <Tabs.Screen
        name="more"
        options={{ title: 'More', tabBarIcon: tabIcon('menu-outline', 'menu') }}
      />
      {/* Hidden — accessible via router.push but not shown in tab bar */}
      <Tabs.Screen name="documents" options={{ href: null }} />
      <Tabs.Screen name="messages" options={{ href: null }} />
      <Tabs.Screen name="my-scai" options={{ href: null }} />
    </Tabs>
  );
}
