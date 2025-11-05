import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';

interface CurrencyContextType {
  currency: string;
  isLoading: boolean;
  refreshCurrency: () => Promise<void>;
}

const CurrencyContext = createContext<CurrencyContextType>({
  currency: 'USD',
  isLoading: true,
  refreshCurrency: async () => {},
});

export const useCurrency = () => useContext(CurrencyContext);

export const CurrencyProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [currency, setCurrency] = useState('USD');
  const [isLoading, setIsLoading] = useState(true);

  const refreshCurrency = async () => {
    if (!user) {
      setCurrency('USD');
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('preferred_currency')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      if (data?.preferred_currency) {
        setCurrency(data.preferred_currency);
      } else {
        setCurrency('USD'); // Default fallback
      }
    } catch (error) {
      console.error('Error fetching currency:', error);
      setCurrency('USD'); // Default fallback
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshCurrency();
  }, [user]);

  return (
    <CurrencyContext.Provider value={{ currency, isLoading, refreshCurrency }}>
      {children}
    </CurrencyContext.Provider>
  );
};

