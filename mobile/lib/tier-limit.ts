import { Alert } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';

/**
 * Plan limits, as the user experiences them.
 *
 * The limits themselves are enforced by a database trigger, so they hold no
 * matter which path created the row. The trigger refuses with a message shaped
 * TIER_LIMIT:<resource>:<limit>:<tier> and a hint of monthly or total. This file
 * turns that into an upgrade prompt instead of a raw database error.
 */

export type LimitedResource = 'children' | 'calendar_events' | 'expense_requests' | 'legal_documents';

const NOUN: Record<LimitedResource, [one: string, many: string]> = {
  children: ['child profile', 'child profiles'],
  calendar_events: ['calendar event', 'calendar events'],
  expense_requests: ['expense request', 'expense requests'],
  legal_documents: ['stored document', 'stored documents'],
};

const PLAN_NAME: Record<string, string> = {
  preview: 'Preview', free: 'Preview',
  essential: 'Essential',
  plus: 'Plus', family_plus: 'Plus',
  premium: 'Premium', legal: 'Premium',
};

export interface TierLimit {
  resource: LimitedResource;
  limit: number;
  plan: string;
  monthly: boolean;
}

interface PromptOptions {
  /** Runs before navigating to plans. Close any open sheet here, or it covers the pricing screen. */
  onUpgrade?: () => void;
}

const planName = (tier: string) => PLAN_NAME[tier.toLowerCase()] ?? tier;

export function parseTierLimit(error: unknown): TierLimit | null {
  const e = error as { message?: string; hint?: string } | null;
  const match = e?.message?.match(/TIER_LIMIT:([a-z_]+):(\d+):(\S+)/i);
  if (!match || !(match[1] in NOUN)) return null;
  return {
    resource: match[1] as LimitedResource,
    limit: Number(match[2]),
    plan: planName(match[3]),
    monthly: e?.hint === 'monthly',
  };
}

export function showTierLimit(limit: TierLimit, options: PromptOptions = {}): void {
  const [one, many] = NOUN[limit.resource];
  const noun = limit.limit === 1 ? one : many;
  const period = limit.monthly ? ' a month' : '';
  const reset = limit.monthly ? ' Your allowance resets on the 1st.' : '';
  Alert.alert(
    "You've reached your plan's limit",
    `Your ${limit.plan} plan includes ${limit.limit} ${noun}${period}. Upgrade to add more.${reset}`,
    [
      { text: 'Not now', style: 'cancel' },
      {
        text: 'See plans',
        onPress: () => {
          options.onUpgrade?.();
          router.push('/pricing');
        },
      },
    ],
  );
}

/** Shows the upgrade prompt when this error is a plan limit. Returns true if it was. */
export function handleTierLimit(error: unknown, options: PromptOptions = {}): boolean {
  const limit = parseTierLimit(error);
  if (!limit) return false;
  showTierLimit(limit, options);
  return true;
}

/**
 * Check before doing something costly, like uploading a file, instead of
 * discovering the limit after the upload.
 *
 * Fails open. If the check cannot run (offline, or the database function not
 * deployed yet), it allows the action, and the trigger still enforces the limit
 * on insert. Returns false only when the user is definitely at their limit.
 */
export async function checkTierLimitBefore(
  resource: LimitedResource,
  options: PromptOptions = {},
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('my_tier_usage' as any, { p_resource: resource });
    const row = (data as any[] | null)?.[0];
    if (error || !row) return true;
    if (Number(row.used) < Number(row.max_count)) return true;
    showTierLimit(
      { resource, limit: Number(row.max_count), plan: planName(String(row.tier)), monthly: !!row.monthly },
      options,
    );
    return false;
  } catch {
    return true;
  }
}
