import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';

export interface User {
  id: string;
  username: string;
  email: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  currentUser: User | null;
  login: (email: string, password: string) => Promise<{ error: any }>;
  signup: (username: string, email: string, password: string) => Promise<{ error: any }>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (id: string, email: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', id)
        .maybeSingle();
      
      if (data) {
        setCurrentUser({ id, email, username: data.username });
      } else {
        // Fallback if profile trigger is delayed
        setCurrentUser({ id, email, username: email.split('@')[0] });
      }
    } catch (err) {
      setCurrentUser({ id, email, username: email.split('@')[0] });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;

    try {
      // Listen for auth changes (guaranteed to fire INITIAL_SESSION on register in Supabase v2)
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        if (session?.user) {
          if (active) {
            setTimeout(async () => {
              if (active) {
                await fetchProfile(session.user!.id, session.user!.email || '');
              }
            }, 0);
          }
        } else {
          if (active) {
            setCurrentUser(null);
            setLoading(false);
          }
        }
      });

      return () => {
        active = false;
        data?.subscription?.unsubscribe();
      };
    } catch (err) {
      console.warn('[AuthContext] Supabase auth listener error, falling back:', err);
      if (active) {
        setCurrentUser(null);
        setLoading(false);
      }
    }
  }, []);


  const login = async (emailOrUsername: string, password: string) => {
    let targetEmail = emailOrUsername;
    
    if (!emailOrUsername.includes('@')) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('email')
          .eq('username', emailOrUsername)
          .maybeSingle();

        if (error) {
          return { error };
        }
        if (!data) {
          return { error: { message: 'Username or password is incorrect' } };
        }
        targetEmail = data.email;
      } catch (err: any) {
        return { error: err };
      }
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: targetEmail,
        password,
      });
      if (error) {
        if (error.message === 'Failed to fetch') {
          return { error: { message: 'Database offline: The Supabase project is paused or deleted. Please restore it or check your .env configuration.' } };
        }
        if (error.message === 'Invalid login credentials') {
          return { error: { message: 'Username or password is incorrect' } };
        }
        return { error };
      }
      return { error: null };
    } catch (err: any) {
      if (err.message?.includes('Failed to fetch')) {
        return { error: { message: 'Database offline: The Supabase project is paused or deleted. Please restore it or check your .env configuration.' } };
      }
      return { error: err };
    }
  };

  const signup = async (username: string, email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
          },
        },
      });
      if (error) {
        if (error.message === 'Failed to fetch') {
          return { error: { message: 'Database offline: The Supabase project is paused or deleted. Please restore it or check your .env configuration.' } };
        }
        return { error };
      }
      return { error: null };
    } catch (err: any) {
      if (err.message?.includes('Failed to fetch')) {
        return { error: { message: 'Database offline: The Supabase project is paused or deleted. Please restore it or check your .env configuration.' } };
      }
      return { error: err };
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  const resetPassword = async (emailOrUsername: string) => {
    let targetEmail = emailOrUsername;
    
    if (!emailOrUsername.includes('@')) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('email')
          .eq('username', emailOrUsername)
          .maybeSingle();

        if (error) {
          return { error };
        }
        if (!data) {
          return { error: { message: 'Username not found' } };
        }
        targetEmail = data.email;
      } catch (err: any) {
        return { error: err };
      }
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(targetEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        if (error.message === 'Failed to fetch') {
          return { error: { message: 'Database offline: The Supabase project is paused or deleted. Please restore it or check your .env configuration.' } };
        }
        return { error };
      }
      return { error: null };
    } catch (err: any) {
      if (err.message?.includes('Failed to fetch')) {
        return { error: { message: 'Database offline: The Supabase project is paused or deleted. Please restore it or check your .env configuration.' } };
      }
      return { error: err };
    }
  };

  const isAuthenticated = currentUser !== null;

  return (
    <AuthContext.Provider value={{ isAuthenticated, currentUser, login, signup, logout, resetPassword }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
