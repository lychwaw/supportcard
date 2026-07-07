import { useEffect, useRef, useState } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { useMyScai } from '@/hooks/useMyScai';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import SubscriptionGate from '@/components/SubscriptionGate';
import { Bot, Send, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

const SUGGESTIONS = [
  'Log a R450 school expense for Mia',
  'Add a custody day next Friday',
  'Log that I dropped the kids off at 5pm, on time',
];

const MyScai = () => {
  const { canUseMyScai } = usePermissions();
  const { messages, isSending, error, sendMessage } = useMyScai();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isSending]);

  if (!canUseMyScai) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Bot className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">My SCAI</h1>
            <p className="text-muted-foreground">Your co-parenting assistant</p>
          </div>
        </div>
        <SubscriptionGate
          title="My SCAI is a Plus feature"
          description="Upgrade to Plus to get an assistant that can log expenses, add calendar events, and record custody check-ins for you."
          ctaText="Upgrade to Plus"
        />
      </div>
    );
  }

  const handleSend = () => {
    if (!input.trim() || isSending) return;
    sendMessage(input);
    setInput('');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Bot className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">My SCAI</h1>
          <p className="text-muted-foreground">Ask it to log an expense, add a calendar event, or record a check-in</p>
        </div>
      </div>

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>Chat</CardTitle>
          <CardDescription>
            My SCAI only sees and acts on your own family — it never moves money.
            Messages are processed by the Claude API (Anthropic) and PII is redacted before transmission.
            Do not share passwords, SA ID numbers, or bank details in chat.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            ref={scrollRef}
            className="space-y-3 min-h-[400px] max-h-[400px] overflow-y-auto p-4 border rounded-lg scroll-smooth"
          >
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <Sparkles className="w-12 h-12 text-muted-foreground" />
                <p className="text-muted-foreground">Try asking My SCAI to do something</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {SUGGESTIONS.map((s) => (
                    <Button key={s} variant="outline" size="sm" onClick={() => sendMessage(s)}>
                      {s}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((message, i) => (
                <div
                  key={i}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-3 shadow-sm ${
                      message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                    }`}
                  >
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                    {message.actions && message.actions.length > 0 && (
                      <div className="flex flex-col gap-1 mt-2">
                        {message.actions.map((action, j) => (
                          <Badge key={j} variant="secondary" className="flex items-center gap-1 w-fit text-xs">
                            <CheckCircle2 className="w-3 h-3" />
                            {action.summary}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            {isSending && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg p-3 shadow-sm flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Thinking...</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask My SCAI to log an expense, add an event, or record a check-in..."
              className="min-h-[44px] max-h-[120px] resize-none"
              disabled={isSending}
            />
            <Button onClick={handleSend} disabled={isSending || !input.trim()} size="icon" className="shrink-0">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MyScai;
