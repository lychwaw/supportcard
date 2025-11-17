import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

type CallbackState = 'processing' | 'error';

const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<CallbackState>('processing');
  const [message, setMessage] = useState('Finishing sign in...');

  useEffect(() => {
    let active = true;

    const processCallback = async () => {
      const type = searchParams.get('type');
      const hash = window.location.hash.startsWith('#')
        ? window.location.hash.slice(1)
        : '';
      const hashParams = new URLSearchParams(hash);

      if (hashParams.get('error')) {
        const description =
          hashParams.get('error_description') ?? 'Authentication failed.';
        if (!active) return;
        setStatus('error');
        setMessage(description);
        toast.error(description);
        return;
      }

      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');

      try {
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
        } else {
          const { data, error } = await supabase.auth.getSession();
          if (error || !data.session) {
            throw error ?? new Error('No active session found.');
          }
        }

        window.history.replaceState(
          null,
          '',
          window.location.pathname + window.location.search,
        );

        if (!active) return;

        if (type === 'recovery') {
          setMessage('Redirecting you to reset your password…');
          navigate('/auth/reset-password', { replace: true });
          return;
        }

        if (type === 'email_change') {
          toast.success('Email address confirmed');
          setMessage('Email updated. Taking you back to Settings…');
          navigate('/settings', { replace: true });
          return;
        }

        navigate('/', { replace: true });
      } catch (error) {
        console.error('Auth callback error:', error);
        if (!active) return;
        setStatus('error');
        setMessage(
          error instanceof Error ? error.message : 'Unable to complete sign in.',
        );
        toast.error(
          error instanceof Error ? error.message : 'Unable to complete sign in.',
        );
      }
    };

    processCallback();

    return () => {
      active = false;
    };
  }, [navigate, searchParams]);

  const handleBackToAuth = () => {
    navigate('/auth', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="flex justify-center">
          <div className="h-12 w-12 rounded-full border-b-2 border-primary animate-spin" />
        </div>
        <div>
          <h1 className="text-xl font-semibold mb-2">
            {status === 'processing' ? 'Completing sign in' : 'Something went wrong'}
          </h1>
          <p className="text-muted-foreground">{message}</p>
        </div>
        {status === 'error' && (
          <Button variant="default" onClick={handleBackToAuth}>
            Back to login
          </Button>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;

