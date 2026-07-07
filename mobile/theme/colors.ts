import { Platform } from 'react-native';
import { Color } from 'expo-router';

// SupportCard brand palette — extracted from design screenshots
export const brand = {
  blue: '#2B74D6',          // primary CTA, logo, links
  lightBg: '#EBF4FF',       // app background
  card: '#FFFFFF',           // card / surface
  dark: '#0D1C2E',           // primary headings
  body: '#6B7A8D',           // secondary / body text
  teal: '#0EA968',           // Plus tier highlight
  separator: '#E4ECF5',      // thin dividers
  pillBg: '#EBF4FF',         // tagline pill background
  pillBorder: '#C3DAFB',     // tagline pill border
  success: '#22C55E',        // check icons
  warning: '#F59E0B',        // warnings
  error: '#EF4444',          // errors / destructive
  badgeBg: '#2B74D6',        // MOST POPULAR badge
  badgeText: '#FFFFFF',
};

// System semantic colors — resolves with light/dark mode automatically on device
export const colors = {
  label: Platform.select({
    ios: Color.ios.label,
    android: Color.android.dynamic.onSurface,
    default: brand.dark,
  })!,
  secondaryLabel: Platform.select({
    ios: Color.ios.secondaryLabel,
    android: Color.android.dynamic.onSurfaceVariant,
    default: brand.body,
  })!,
  background: Platform.select({
    ios: Color.ios.systemGroupedBackground,
    android: Color.android.dynamic.surfaceVariant,
    default: brand.lightBg,
  })!,
  surface: Platform.select({
    ios: Color.ios.secondarySystemGroupedBackground,
    android: Color.android.dynamic.surface,
    default: brand.card,
  })!,
  separator: Platform.select({
    ios: Color.ios.separator,
    android: Color.android.dynamic.outlineVariant,
    default: brand.separator,
  })!,
  primary: brand.blue,
  teal: brand.teal,
  error: brand.error,
  success: brand.success,
};
