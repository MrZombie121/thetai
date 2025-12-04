import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error: Error | null; needsVerification: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null; needsVerification: boolean }>;
  verifyOtp: (email: string, token: string, type: 'signup' | 'email') => Promise<{ error: Error | null }>;
  resendOtp: (email: string, type: 'signup' | 'email_change') => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, displayName?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName || email.split('@')[0]
        }
      }
    });
    
    // If user exists but email not confirmed, they need verification
    const needsVerification = !error && data.user && !data.session;
    
    return { error, needsVerification };
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    // Check if email is not confirmed
    if (error?.message?.includes('Email not confirmed')) {
      // Resend OTP for login
      await supabase.auth.resend({
        type: 'signup',
        email,
      });
      return { error: null, needsVerification: true };
    }
    
    return { error, needsVerification: false };
  };

  const verifyOtp = async (email: string, token: string, type: 'signup' | 'email') => {
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type,
    });
    return { error };
  };

  const resendOtp = async (email: string, type: 'signup' | 'email_change') => {
    const { error } = await supabase.auth.resend({
      type,
      email,
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, verifyOtp, resendOtp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}