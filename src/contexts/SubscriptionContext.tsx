import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { SubscriptionTierId } from '@/lib/subscriptions';

interface SubscriptionContextType {
  tier: SubscriptionTierId;
  status: 'active' | 'expired' | null;
  expiryDate: string | null;
  isActive: boolean;
  loading: boolean;
  refreshSubscription: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within SubscriptionProvider');
  }
  return context;
};

export const SubscriptionProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [tier, setTier] = useState<SubscriptionTierId>('free');
  const [status, setStatus] = useState<'active' | 'expired' | null>(null);
  const [expiryDate, setExpiryDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSubscription = async () => {
    if (!user) {
      setTier('free');
      setStatus(null);
      setExpiryDate(null);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('subscription_tier, subscription_status, expiry_date')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      const nextTier = (data?.subscription_tier || 'free') as SubscriptionTierId;
      const nextStatus = (data?.subscription_status || null) as 'active' | 'expired' | null;
      const nextExpiry = data?.expiry_date ? String(data.expiry_date) : null;

      setTier(nextTier);
      setStatus(nextStatus);
      setExpiryDate(nextExpiry);
    } catch (error) {
      console.error('Error fetching subscription:', error);
      setTier('free');
      setStatus(null);
      setExpiryDate(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshSubscription();
  }, [user]);

  const isActive = status === 'active' && (!expiryDate || new Date(expiryDate) > new Date());

  return (
    <SubscriptionContext.Provider
      value={{
        tier,
        status,
        expiryDate,
        isActive,
        loading,
        refreshSubscription,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};

