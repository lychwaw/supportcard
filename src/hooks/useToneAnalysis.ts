import { useCallback, useMemo, useState } from 'react';

type ToneAnalysis = {
  isHostile: boolean;
  isAggressive: boolean;
  suggestedTone: 'positive' | 'neutral' | 'negative' | 'hostile';
  confidence: number;
  warningMessage?: string;
};

const HOSTILE_KEYWORDS = ['hate', 'stupid', 'idiot', 'threat', 'kill', 'harm'];
const AGGRESSIVE_KEYWORDS = ['angry', 'furious', 'shut up', 'never', 'always'];

const scoreMessage = (message: string) => {
  const lower = message.toLowerCase();
  const hasHostile = HOSTILE_KEYWORDS.some((word) => lower.includes(word));
  const hasAggressive = AGGRESSIVE_KEYWORDS.some((word) => lower.includes(word));
  return { hasHostile, hasAggressive };
};

export const useToneAnalysis = () => {
  const [analysis, setAnalysis] = useState<ToneAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const analyze = useCallback(async (message: string) => {
    setIsAnalyzing(true);
    const { hasHostile, hasAggressive } = scoreMessage(message);

    const suggestedTone: ToneAnalysis['suggestedTone'] = hasHostile
      ? 'hostile'
      : hasAggressive
      ? 'negative'
      : 'positive';

    const next: ToneAnalysis = {
      isHostile: hasHostile,
      isAggressive: hasAggressive,
      suggestedTone,
      confidence: hasHostile || hasAggressive ? 80 : 35,
      warningMessage: hasHostile || hasAggressive
        ? 'This message may be perceived as hostile or aggressive.'
        : undefined,
    };

    setAnalysis(next);
    setIsAnalyzing(false);
  }, []);

  const reset = useCallback(() => {
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
