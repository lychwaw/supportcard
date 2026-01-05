import { useState, useCallback } from 'react';
import { z } from 'zod';

// Zod schema for message validation
const MessageSchema = z.object({
  content: z.string().min(1).max(5000),
});

interface ToneAnalysisResult {
  isHostile: boolean;
  isAggressive: boolean;
  confidence: number;
  warningMessage: string | null;
  suggestedTone: 'neutral' | 'positive' | 'negative' | 'hostile';
}

// Simple sentiment analysis (in production, use AI service like OpenAI, AWS Comprehend, etc.)
const analyzeTone = (text: string): ToneAnalysisResult => {
  const lowerText = text.toLowerCase();
  
  // Hostile/aggressive keywords (expand this list in production)
  const hostileKeywords = [
    'stupid', 'idiot', 'moron', 'fool', 'loser', 'pathetic',
    'hate', 'despise', 'disgusting', 'worthless', 'useless',
    'never', 'always', 'you always', 'you never',
    'fuck', 'damn', 'hell', 'shit', // Profanity
    'sue', 'lawyer', 'court', 'custody', 'alimony', // Legal threats
    'you\'re wrong', 'you don\'t understand', 'you\'re lying',
  ];

  // Aggressive patterns
  const aggressivePatterns = [
    /!{2,}/g, // Multiple exclamation marks
    /[A-Z]{5,}/g, // ALL CAPS words
    /\b(why|how)\s+(do|did|are|is)\s+you\s+(always|never)/gi,
  ];

  let hostileScore = 0;
  let aggressiveScore = 0;

  // Check for hostile keywords
  hostileKeywords.forEach(keyword => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
    const matches = text.match(regex);
    if (matches) {
      hostileScore += matches.length;
    }
  });

  // Check for aggressive patterns
  aggressivePatterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      aggressiveScore += matches.length;
    }
  });

  // Calculate confidence (0-100)
  const totalScore = hostileScore + aggressiveScore;
  const confidence = Math.min(100, (totalScore / 5) * 100); // Normalize to 100

  const isHostile = hostileScore >= 2 || totalScore >= 3;
  const isAggressive = aggressiveScore >= 2 || totalScore >= 3;

  let warningMessage: string | null = null;
  let suggestedTone: 'neutral' | 'positive' | 'negative' | 'hostile' = 'neutral';

  if (isHostile || isAggressive) {
    warningMessage = 'High Conflict Detected. This message may be used against you in court. Consider revising to a more neutral tone.';
    suggestedTone = 'hostile';
  } else if (hostileScore > 0 || aggressiveScore > 0) {
    warningMessage = 'Moderate conflict detected. Consider using more neutral language.';
    suggestedTone = 'negative';
  } else if (lowerText.includes('thank') || lowerText.includes('appreciate') || lowerText.includes('please')) {
    suggestedTone = 'positive';
  }

  return {
    isHostile,
    isAggressive,
    confidence,
    warningMessage,
    suggestedTone,
  };
};

export const useToneAnalysis = () => {
  const [analysis, setAnalysis] = useState<ToneAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const analyze = useCallback(async (message: string): Promise<ToneAnalysisResult> => {
    setIsAnalyzing(true);
    
    try {
      // Validate input with Zod
      const validated = MessageSchema.parse({ content: message });
      
      // Simulate API delay (in production, call actual AI service)
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const result = analyzeTone(validated.content);
      setAnalysis(result);
      return result;
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error('Invalid message format');
      }
      throw error;
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const reset = useCallback(() => {
    setAnalysis(null);
  }, []);

  return {
    analysis,
    isAnalyzing,
    analyze,
    reset,
  };
};






