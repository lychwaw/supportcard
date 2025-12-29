import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, User, Users } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import TonePolice from '@/components/TonePolice';

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  read: boolean;
  sender?: {
    full_name: string | null;
    email: string | null;
  };
}

interface CoParent {
  id: string;
  full_name: string | null;
  email: string | null;
}

const Messages = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [coParent, setCoParent] = useState<CoParent | null>(null);

  useEffect(() => {
    if (user) {
      findCoParent();
      
      // Set up real-time subscription
      const channel = supabase
        .channel('messages-changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
          },
          () => {
            if (coParent) {
              fetchMessages();
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const findCoParent = async () => {
    if (!user) return;

    try {
      // Find co-parent through shared children
      const { data: sharedChildrenData, error: childrenError } = await supabase
        .from('children')
        .select('parent_id, co_parent_id')
        .or(`parent_id.eq.${user.id},co_parent_id.eq.${user.id}`)
        .limit(1)
        .maybeSingle();

      if (childrenError) {
        console.error('Error fetching children:', childrenError);
        setLoading(false);
        return;
      }

      if (sharedChildrenData) {
        const sharedChildren = sharedChildrenData as any;
        const coParentId = sharedChildren.parent_id === user.id 
          ? sharedChildren.co_parent_id 
          : sharedChildren.parent_id;

        if (coParentId) {
          const { data: coParentData, error: profileError } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .eq('id', coParentId)
            .single();

          if (profileError) {
            console.error('Error fetching co-parent profile:', profileError);
          } else if (coParentData) {
            setCoParent({
              id: coParentData.id,
              full_name: coParentData.full_name,
              email: coParentData.email,
            });
          }
        }
      } else {
        // No co-parent found - that's okay
        setCoParent(null);
      }
    } catch (error) {
      console.error('Error finding co-parent:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
    if (!user || !coParent) return;

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*, profiles!sender_id(full_name, email)')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${coParent.id}),and(sender_id.eq.${coParent.id},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true });

      if (error) throw error;
      if (data) {
        const messagesWithSender = data.map(msg => ({
          ...msg,
          sender: msg.profiles as any,
        }));
        setMessages(messagesWithSender);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (messageContent: string) => {
    if (!user || !messageContent.trim()) {
      toast.error('Please enter a message');
      return;
    }

    if (!coParent) {
      toast.error('No co-parent found. Please invite a co-parent first.');
      return;
    }

    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          sender_id: user.id,
          receiver_id: coParent.id,
          content: messageContent.trim(),
          read: false,
        });

      if (error) throw error;

      fetchMessages();
    } catch (error) {
      toast.error('Failed to send message');
      console.error(error);
    }
  };

  useEffect(() => {
    if (coParent) {
      fetchMessages();
    }
  }, [coParent]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    const messagesContainer = document.querySelector('.scroll-smooth');
    if (messagesContainer && messages.length > 0) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }, [messages]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <MessageSquare className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Private Messages</h1>
          <p className="text-muted-foreground">Communicate with your co-parent</p>
        </div>
      </div>

      <Card className="shadow-soft">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Message Center</CardTitle>
              <CardDescription>
                {coParent 
                  ? `Private chat with ${coParent.full_name || coParent.email || 'co-parent'}`
                  : 'No co-parent connected yet'}
              </CardDescription>
            </div>
            {coParent && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <User className="w-3 h-3" />
                Co-Parent
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!coParent ? (
            <div className="flex flex-col items-center justify-center h-[400px] p-4 border rounded-lg">
              <MessageSquare className="w-12 h-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground mb-2">No co-parent connected</p>
              <p className="text-xs text-muted-foreground text-center mb-4">
                Invite a co-parent from the Family Management page to start messaging
              </p>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => window.location.href = '/family'}
                className="gap-2 hover:scale-105 transition-transform"
              >
                <Users className="w-4 h-4" />
                Go to Family Management
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-3 min-h-[400px] max-h-[400px] overflow-y-auto p-4 border rounded-lg scroll-smooth">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full">
                    <MessageSquare className="w-12 h-12 text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">No messages yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Start the conversation!</p>
                  </div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${
                        message.sender_id === user?.id ? 'justify-end' : 'justify-start'
                      } animate-in fade-in slide-in-from-bottom-2 duration-300`}
                    >
                      <div
                        className={`max-w-[70%] rounded-lg p-3 transition-all duration-200 ${
                          message.sender_id === user?.id
                            ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm'
                            : 'bg-muted hover:bg-muted/80 shadow-sm'
                        }`}
                      >
                        {message.sender_id !== user?.id && message.sender && (
                          <p className="text-xs font-medium mb-1 opacity-80">
                            {message.sender.full_name || message.sender.email || 'Co-Parent'}
                          </p>
                        )}
                        <p className="text-sm leading-relaxed">{message.content}</p>
                        <p className="text-xs opacity-70 mt-1">
                          {format(new Date(message.created_at), 'h:mm a')}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <TonePolice
                onSend={handleSendMessage}
                placeholder="Type your message..."
                disabled={!coParent}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Messages;
