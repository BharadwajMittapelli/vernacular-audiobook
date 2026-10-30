import React from 'react';
import { supabase } from '../lib/supabaseClient.js';
import type { Session, AuthError } from '@supabase/supabase-js';

interface AuthContextType {
  session: Session | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<{ data: any; error: AuthError | null | unknown }>;
  signUp: (email: string, password: string) => Promise<{ data: any; error: AuthError | null | unknown }>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextType | null>(null);

export const useAuth = () => React.useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = React.useState<Session | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const initialize = async () => {
      try {
        // ponytail: getSession() is now fast (local storage) + handles OAuth URL params
        const { data } = await supabase.auth.getSession();
        setSession(data?.session ?? null);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Auth initialization failed');
      } finally {
        setLoading(false);
      }
    };
    void initialize();

    // ponytail: subscribe to auth state changes with resilient return-shape handling
    const result = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === 'SIGNED_OUT') {
        setSession(null);
        setError(null);
      } else if ((event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') && newSession) {
        setSession(newSession);
        setError(null);
      }
    });

    // Resiliently extract subscription — handles { data: { subscription } }, { subscription }, or direct subscription
    let subscription: { unsubscribe: () => void } | null = null;
    if (result && typeof result === 'object') {
      subscription = (result as any)?.data?.subscription
        ?? (result as any)?.subscription
        ?? null;
    }

    return () => {
      // ponytail: guard against undefined/null subscription during cleanup
      if (subscription && typeof subscription.unsubscribe === 'function') {
        subscription.unsubscribe();
      }
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      setError(null);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) setError(error.message);
      return { data, error };
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Sign in failed');
      return { data: null, error: e };
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      setError(null);
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      return { data, error };
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Sign up failed');
      return { data: null, error: e };
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }
      setSession(null);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Sign out failed');
      throw e;
    }
  };

  const signInWithGoogle = async () => {
    try {
      setError(null);
      await supabase.auth.signInWithOAuth({ provider: 'google' });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Google sign in failed');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        loading,
        error,
        signIn,
        signUp,
        signOut,
        signInWithGoogle,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
