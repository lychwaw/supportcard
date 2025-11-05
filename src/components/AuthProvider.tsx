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
    // Handle OAuth callback - check for hash fragments first
    const handleOAuthCallback = async () => {
      // Check if we have hash fragments from OAuth redirect
      const hash = window.location.hash;
      if (hash && hash.includes('access_token')) {
        console.log('OAuth callback detected, processing...');
        // Supabase will automatically process the hash and trigger onAuthStateChange
        // But we need to wait a bit for it to process
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    };

    // Set up auth state listener FIRST (before checking session)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email);
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          // Clean up hash fragments after successful sign-in
          if (window.location.hash) {
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
          }
          
          if (location.pathname === '/auth') {
            navigate('/', { replace: true });
          }
        }

        if (event === 'SIGNED_OUT') {
          navigate('/auth', { replace: true });
        }
      }
    );

    // Handle OAuth callback if present
    handleOAuthCallback().then(() => {
      // Then check for existing session
      supabase.auth.getSession().then(({ data: { session }, error }) => {
        if (error) {
          console.error('Error getting session:', error);
        }
        
        if (session) {
          setSession(session);
          setUser(session.user);
        }
        setLoading(false);
      });
    });

    return () => subscription.unsubscribe();
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
