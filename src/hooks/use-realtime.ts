import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

interface RealtimeSubscriptionOptions {
  table: string;
  filter?: string;
  onInsert?: (payload: any) => void;
  onUpdate?: (payload: any) => void;
  onDelete?: (payload: any) => void;
  enabled?: boolean;
}

export function useRealtimeSubscription({
  table,
  filter,
  onInsert,
  onUpdate,
  onDelete,
  enabled = true
}: RealtimeSubscriptionOptions) {
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subscribe = useCallback(() => {
    if (!enabled) return;

    const newChannel = supabase
      .channel(`${table}_changes`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter: filter || undefined,
        },
        (payload) => {
          console.log('Realtime update received:', payload);
          
          switch (payload.eventType) {
            case 'INSERT':
              onInsert?.(payload);
              break;
            case 'UPDATE':
              onUpdate?.(payload);
              break;
            case 'DELETE':
              onDelete?.(payload);
              break;
          }
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
        setIsConnected(status === 'SUBSCRIBED');
        if (status === 'CHANNEL_ERROR') {
          setError('Failed to connect to real-time updates');
        } else {
          setError(null);
        }
      });

    setChannel(newChannel);
  }, [table, filter, onInsert, onUpdate, onDelete, enabled]);

  const unsubscribe = useCallback(() => {
    if (channel) {
      supabase.removeChannel(channel);
      setChannel(null);
      setIsConnected(false);
    }
  }, [channel]);

  useEffect(() => {
    if (enabled) {
      subscribe();
    } else {
      unsubscribe();
    }

    return () => {
      unsubscribe();
    };
  }, [enabled, subscribe, unsubscribe]);

  return {
    isConnected,
    error,
    subscribe,
    unsubscribe,
  };
}

// Specific hooks for common use cases
export function useTransactionsRealtime(onUpdate: (payload: any) => void) {
  return useRealtimeSubscription({
    table: 'transactions',
    onUpdate,
    onInsert: onUpdate,
  });
}

export function useExpensesRealtime(onUpdate: (payload: any) => void) {
  return useRealtimeSubscription({
    table: 'expenses',
    onUpdate,
    onInsert: onUpdate,
  });
}

export function useChildrenRealtime(onUpdate: (payload: any) => void) {
  return useRealtimeSubscription({
    table: 'children',
    onUpdate,
    onInsert: onUpdate,
    onDelete: onUpdate,
  });
}

export function useMessagesRealtime(onUpdate: (payload: any) => void) {
  return useRealtimeSubscription({
    table: 'messages',
    onUpdate,
    onInsert: onUpdate,
  });
}
