import { useState, useEffect } from 'react';
import { useToneAnalysis } from '@/hooks/useToneAnalysis';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertCircle, Shield, CheckCircle, Sparkles } from 'lucide-react';
import { z } from 'zod';

const MessageSchema = z.object({
  content: z.string().min(1, 'Message cannot be empty').max(5000, 'Message too long'),
});

interface TonePoliceProps {
  onSend: (message: string) => void;
  initialValue?: string;
  placeholder?: string;
  disabled?: boolean;
  /** AI Tone-Check is a Basic+ feature — Free tier falls back to local heuristics only. */
  aiEnabled?: boolean;
}

const TonePolice = ({ onSend, initialValue = '', placeholder = 'Type your message...', disabled = false, aiEnabled = false }: TonePoliceProps) => {
  const [message, setMessage] = useState(initialValue);
  const [showHeatedModal, setShowHeatedModal] = useState(false);
  const { analysis, isAnalyzing, analyze, reset } = useToneAnalysis();

  useEffect(() => {
    if (message.length > 10) {
      const timeoutId = setTimeout(() => {
        analyze(message, aiEnabled);
      }, 500); // Debounce analysis

      return () => clearTimeout(timeoutId);
    } else {
      reset();
    }
  }, [message, aiEnabled, analyze, reset]);

  const validate = (): string | null => {
    try {
      MessageSchema.parse({ content: message });
      return null;
    } catch (error) {
      if (error instanceof z.ZodError) return error.errors[0].message;
      return 'Invalid message';
    }
  };

  const handleSendClick = () => {
    const validationError = validate();
    if (validationError) {
      console.error('Validation error:', validationError);
      return;
    }

    if (analysis?.isHostile) {
      setShowHeatedModal(true);
      return;
    }

    onSend(message);
    setMessage('');
    reset();
  };

  const handleSendAnyway = () => {
    onSend(message);
    setMessage('');
    reset();
    setShowHeatedModal(false);
  };

  const handleUseRewrite = () => {
    if (analysis?.rewrite) {
      setMessage(analysis.rewrite);
    }
    setShowHeatedModal(false);
    reset();
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
          className={getToneColor()}
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
          {analysis.warningMessage && !analysis.isHostile && (
            <Alert className="border-orange-500">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Conflict Detection</AlertTitle>
              <AlertDescription>{analysis.warningMessage}</AlertDescription>
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
              {aiEnabled ? 'AI Tone-Check' : 'Basic conflict detection'} | Tone: {analysis.suggestedTone}
            </span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {message.length}/5000 characters
        </p>
        <Button
          onClick={handleSendClick}
          disabled={message.length === 0 || isAnalyzing || disabled}
        >
          Send
        </Button>
      </div>

      {/* Brief's exact UX: "This seems heated. Want to rephrase?" with a
          non-editable suggested rewrite, or Send Anyway. */}
      <AlertDialog open={showHeatedModal} onOpenChange={setShowHeatedModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-destructive" />
              This seems heated. Want to rephrase?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {analysis?.warningMessage || 'This message may be perceived as hostile and could be used against you in a dispute.'}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {analysis?.rewrite && (
            <div className="rounded-lg border bg-muted/50 p-3 space-y-1">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Sparkles className="w-3 h-3" aria-hidden="true" />
                Suggested calmer rewrite
              </p>
              <p className="text-sm">{analysis.rewrite}</p>
            </div>
          )}

          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="sm:mr-auto">Let me edit it</AlertDialogCancel>
            {analysis?.rewrite && (
              <Button variant="outline" onClick={handleUseRewrite}>
                Use Suggested Rewrite
              </Button>
            )}
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleSendAnyway}
            >
              Send Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TonePolice;
