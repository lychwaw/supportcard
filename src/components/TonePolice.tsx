import { useState, useEffect } from 'react';
import { useToneAnalysis } from '@/hooks/useToneAnalysis';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Shield, CheckCircle } from 'lucide-react';
import { z } from 'zod';

// Zod schema for message
const MessageSchema = z.object({
  content: z.string().min(1, 'Message cannot be empty').max(5000, 'Message too long'),
});

interface TonePoliceProps {
  onSend: (message: string) => void;
  initialValue?: string;
  placeholder?: string;
  disabled?: boolean;
}

const TonePolice = ({ onSend, initialValue = '', placeholder = 'Type your message...', disabled = false }: TonePoliceProps) => {
  const [message, setMessage] = useState(initialValue);
  const [isBlocked, setIsBlocked] = useState(false);
  const { analysis, isAnalyzing, analyze, reset } = useToneAnalysis();

  useEffect(() => {
    if (message.length > 10) {
      const timeoutId = setTimeout(() => {
        analyze(message);
      }, 500); // Debounce analysis

      return () => clearTimeout(timeoutId);
    } else {
      reset();
    }
  }, [message, analyze, reset]);

  useEffect(() => {
    setIsBlocked(analysis?.isHostile || analysis?.isAggressive || false);
  }, [analysis]);

  const handleSend = async () => {
    try {
      // Validate with Zod
      const validated = MessageSchema.parse({ content: message });
      
      if (isBlocked) {
        return; // Prevent sending
      }

      onSend(validated.content);
      setMessage('');
      reset();
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Handle validation error
        console.error('Validation error:', error.errors);
      }
    }
  };

  const getToneColor = () => {
    if (!analysis) return '';
    if (analysis.suggestedTone === 'hostile') return 'border-red-500 bg-red-50';
    if (analysis.suggestedTone === 'negative') return 'border-yellow-500 bg-yellow-50';
    if (analysis.suggestedTone === 'positive') return 'border-green-500 bg-green-50';
    return '';
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={placeholder}
          rows={4}
          className={`${getToneColor()} ${isBlocked ? 'border-red-500' : ''}`}
          disabled={isAnalyzing || disabled}
        />
        {isAnalyzing && (
          <div className="absolute top-2 right-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
          </div>
        )}
      </div>

      {analysis && (
        <div className="space-y-2">
          {analysis.warningMessage && (
            <Alert variant={isBlocked ? 'destructive' : 'default'} className="border-orange-500">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Conflict Detection</AlertTitle>
              <AlertDescription>
                {analysis.warningMessage}
                {isBlocked && (
                  <span className="block mt-2 font-semibold">
                    ⚠️ Send button blocked. This message may be used against you in court.
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )}

          {!analysis.warningMessage && analysis.suggestedTone === 'positive' && (
            <Alert className="border-green-500 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Tone looks good! Professional and respectful.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Shield className="w-3 h-3" />
            <span>
              Conflict Score: {analysis.confidence.toFixed(0)}% | 
              Tone: {analysis.suggestedTone}
            </span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {message.length}/5000 characters
        </p>
        <Button
          onClick={handleSend}
          disabled={isBlocked || message.length === 0 || isAnalyzing || disabled}
          variant={isBlocked ? 'destructive' : 'default'}
        >
          {isBlocked ? 'Blocked - Revise Message' : 'Send'}
        </Button>
      </div>
    </div>
  );
};

export default TonePolice;


