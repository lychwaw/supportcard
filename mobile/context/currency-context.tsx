import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { type Currency } from '@/lib/currency';

interface CurrencyContextValue {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  loading: boolean;
}

const CurrencyContext = createContext<CurrencyContextValue>({
  currency: 'ZAR',
  setCurrency: () => {},
  loading: true,
});

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>('ZAR');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: profile } = await supabase
          .from('profiles' as any)
          .select('preferred_currency')
          .eq('id', user.id)
          .maybeSingle();
        const pref = (profile as any)?.preferred_currency;
        if (pref === 'ZAR' || pref === 'USD') setCurrencyState(pref as Currency);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const setCurrency = useCallback(async (next: Currency) => {
    setCurrencyState(next);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('profiles' as any).update({ preferred_currency: next }).eq('id', user.id);
    } catch { /* non-fatal */ }
  }, []);

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, loading }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
