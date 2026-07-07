import { useCallback, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ScaiAction {
  tool: string;
  summary: string;
}

export interface ScaiMessage {
  role: 'user' | 'assistant';
  content: string;
  actions?: ScaiAction[];
}

export const useMyScai = () => {
  const [messages, setMessages] = useState<ScaiMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    setError(null);
    const nextHistory: ScaiMessage[] = [...messages, { role: 'user', content: trimmed }];
    setMessages(nextHistory);
    setIsSending(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({
          action: 'scai-chat',
          messages: nextHistory.map(({ role, content }) => ({ role, content })),
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || 'My SCAI is unavailable right now');
      }

      const data = await response.json();
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.reply, actions: data.actions || [] },
      ]);
    } catch (err: any) {
      setError(err?.message || 'Something went wrong talking to My SCAI');
    } finally {
      setIsSending(false);
    }
  }, [messages]);

  const reset = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return useMemo(() => ({
    messages,
    isSending,
    error,
    sendMessage,
    reset,
  }), [messages, isSending, error, sendMessage, reset]);
};
