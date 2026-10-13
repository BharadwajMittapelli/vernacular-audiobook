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
        const { data } = await supabase.auth.getSession();
        setSession(data?.session ?? null);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Auth initialization failed');
      } finally {
        setLoading(false);
      }
    };
    void initialize();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (event === 'SIGNED_OUT') {
          setSession(null);
          setError(null);
        } else if (event === 'TOKEN_REFRESHED' && newSession) {
          setSession(newSession);
          setError(null);
        } else if (event === 'INITIAL_SESSION' && newSession) {
          setSession(newSession);
          setError(null);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
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
      await supabase.auth.signOut();
    } finally {
      setSession(null);
      setError(null);
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
