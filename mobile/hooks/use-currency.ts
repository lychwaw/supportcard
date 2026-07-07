import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { type Currency } from '@/lib/currency';

// Default to ZAR — most users are South African.
// If the user hasn't picked yet (pre-signup), we use this fallback.
const DEFAULT_CURRENCY: Currency = 'ZAR';

export function useCurrency() {
  const [currency, setCurrencyState] = useState<Currency>(DEFAULT_CURRENCY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }

        const { data: profile } = await supabase
          .from('profiles' as any)
          .select('preferred_currency')
          .eq('id', user.id)
          .maybeSingle();

        const pref = (profile as any)?.preferred_currency;
        if (pref === 'ZAR' || pref === 'USD') {
          setCurrencyState(pref as Currency);
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Persists the choice to the profiles table immediately
  const setCurrency = useCallback(async (next: Currency) => {
    setCurrencyState(next);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase
        .from('profiles' as any)
        .update({ preferred_currency: next })
        .eq('id', user.id);
    } catch {
      // Non-fatal — preference will reset on next load but UX continues
    }
  }, []);

  return { currency, setCurrency, loading };
}
