import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// SecureStore is native-only — guard against SSR/web rendering where the
// native module is unavailable. process.env.EXPO_OS is set by Metro at
// bundle time; on web/SSR it is 'web', on device it is 'ios' or 'android'.
const isNative = process.env.EXPO_OS === 'ios' || process.env.EXPO_OS === 'android';

const getStorage = () => {
  if (!isNative) return undefined; // web/SSR: use default in-memory storage

  // Lazy require so the native module is only loaded on device
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const SecureStore = require('expo-secure-store');
  return {
    getItem:    (key: string)              => SecureStore.getItemAsync(key),
    setItem:    (key: string, val: string) => SecureStore.setItemAsync(key, val),
    removeItem: (key: string)              => SecureStore.deleteItemAsync(key),
  };
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: getStorage(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: !isNative,
  },
});
