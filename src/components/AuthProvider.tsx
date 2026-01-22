import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useLocation } from 'react-router-dom';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let mounted = true;

    // Set up auth state listener FIRST (before checking session)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        
        if (import.meta.env.DEV) {
          console.log('Auth state changed:', event);
        }
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (import.meta.env.DEV) {
            console.log('User signed in');
          }
          // Clean up hash fragments after successful sign-in
          if (window.location.hash) {
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
          }
          
          if (location.pathname === '/auth') {
            if (import.meta.env.DEV) {
              console.log('Redirecting from /auth to / after sign-in');
            }
            navigate('/', { replace: true });
          }
        }

        if (event === 'SIGNED_OUT') {
          navigate('/auth', { replace: true });
        }
      }
    );

    // Check for OAuth callback hash fragments and process them
    const handleOAuthCallback = async () => {
      if (location.pathname === '/auth/callback') {
        // Dedicated callback route handles session exchange
        setLoading(false);
        return;
      }
      const hash = window.location.hash;
      if (hash && (hash.includes('access_token') || hash.includes('error'))) {
        if (import.meta.env.DEV) {
          console.log('OAuth callback detected, processing hash fragments...');
        }
        
        // Check for error in hash
        if (hash.includes('error=')) {
          const hashParams = new URLSearchParams(hash.substring(1));
          const error = hashParams.get('error');
          const errorDescription = hashParams.get('error_description');
          if (import.meta.env.DEV) {
            console.error('OAuth error in callback:', error, errorDescription);
          }
          setLoading(false);
          return;
        }
        
        // Parse hash fragments manually and set session
        const hashParams = new URLSearchParams(hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        
        if (accessToken && refreshToken) {
          // Exchange the tokens for a session
          const { data: { session }, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          
          if (error) {
            if (import.meta.env.DEV) {
              console.error('Error setting session from OAuth:', error.message);
            }
            setLoading(false);
          } else if (session) {
            if (import.meta.env.DEV) {
              console.log('✅ Session set successfully from OAuth');
            }
            // Force update state immediately
            setSession(session);
            setUser(session.user);
            setLoading(false);
            // The onAuthStateChange will also be triggered
          } else {
            if (import.meta.env.DEV) {
              console.warn('No session returned after setSession');
            }
            setLoading(false);
          }
        } else {
          if (import.meta.env.DEV) {
            console.warn('Missing tokens in hash, trying automatic processing...');
          }
          // Let Supabase handle it automatically
          setTimeout(async () => {
            if (!mounted) return;
            const { data: { session }, error } = await supabase.auth.getSession();
            if (error) {
              if (import.meta.env.DEV) {
                console.error('Error getting session after OAuth:', error.message);
              }
            } else if (session) {
              if (import.meta.env.DEV) {
                console.log('✅ Session retrieved after OAuth callback');
              }
              setSession(session);
              setUser(session.user);
            } else {
              if (import.meta.env.DEV) {
                console.warn('No session found after OAuth callback');
              }
            }
            setLoading(false);
          }, 1000);
        }
      } else {
        // No OAuth callback, check for existing session from localStorage
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          if (import.meta.env.DEV) {
            console.error('Error getting session:', error.message);
          }
        } else if (session) {
          if (import.meta.env.DEV) {
            console.log('✅ Existing session found');
          }
          setSession(session);
          setUser(session.user);
        } else {
          if (import.meta.env.DEV) {
            console.log('No existing session found');
          }
        }
        setLoading(false);
      }
    };

    // Call the async function
    handleOAuthCallback();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate, location.pathname]);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
