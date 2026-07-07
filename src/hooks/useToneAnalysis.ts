import { useCallback, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

type ToneAnalysis = {
  isHostile: boolean;
  isAggressive: boolean;
  suggestedTone: 'positive' | 'neutral' | 'negative' | 'hostile';
  confidence: number;
  warningMessage?: string;
  rewrite?: string | null;
};

const HOSTILE_KEYWORDS = ['hate', 'stupid', 'idiot', 'threat', 'kill', 'harm'];
const AGGRESSIVE_KEYWORDS = ['angry', 'furious', 'shut up', 'never', 'always'];

// Instant, zero-latency first pass — shown immediately while the AI call is
// in flight, and used as the only signal when AI Tone-Check isn't available
// (Free tier, or the API call fails).
const localHeuristic = (message: string): ToneAnalysis => {
  const lower = message.toLowerCase();
  const hasHostile = HOSTILE_KEYWORDS.some((word) => lower.includes(word));
  const hasAggressive = AGGRESSIVE_KEYWORDS.some((word) => lower.includes(word));
  const suggestedTone: ToneAnalysis['suggestedTone'] = hasHostile ? 'hostile' : hasAggressive ? 'negative' : 'positive';

  return {
    isHostile: hasHostile,
    isAggressive: hasAggressive,
    suggestedTone,
    confidence: hasHostile || hasAggressive ? 60 : 35,
    warningMessage: hasHostile || hasAggressive
      ? 'This message may be perceived as hostile or aggressive.'
      : undefined,
    rewrite: null,
  };
};

export const useToneAnalysis = () => {
  const [analysis, setAnalysis] = useState<ToneAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const requestId = useRef(0);

  const analyze = useCallback(async (message: string, useAI: boolean = false) => {
    const id = ++requestId.current;
    setIsAnalyzing(true);

    // Show the instant heuristic right away so the UI never feels stuck.
    setAnalysis(localHeuristic(message));

    if (!useAI) {
      setIsAnalyzing(false);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ action: 'tone-check', message }),
      });

      if (id !== requestId.current) return; // a newer call superseded this one

      if (!response.ok) {
        // Graceful degradation — keep the local heuristic result.
        setIsAnalyzing(false);
        return;
      }

      const data = await response.json();
      const tone = data.tone as ToneAnalysis['suggestedTone'];

      setAnalysis({
        isHostile: tone === 'hostile',
        isAggressive: tone === 'negative' || tone === 'hostile',
        suggestedTone: tone,
        confidence: tone === 'hostile' ? 95 : tone === 'negative' ? 70 : tone === 'positive' ? 90 : 50,
        warningMessage: data.reason || (tone === 'hostile' || tone === 'negative'
          ? 'This message may be perceived as hostile or aggressive.'
          : undefined),
        rewrite: data.rewrite ?? null,
      });
    } catch {
      // Network/API failure — local heuristic result already set above.
    } finally {
      if (id === requestId.current) setIsAnalyzing(false);
    }
  }, []);

  const reset = useCallback(() => {
    requestId.current++;
    setAnalysis(null);
    setIsAnalyzing(false);
  }, []);

  return useMemo(() => ({
    analysis,
    isAnalyzing,
    analyze,
    reset,
  }), [analysis, isAnalyzing, analyze, reset]);
};
