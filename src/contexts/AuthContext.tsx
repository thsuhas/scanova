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
  loading: boolean;
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
      const { data } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', id)
        .maybeSingle();
      
      if (data?.username) {
        setCurrentUser(prev => prev ? { ...prev, username: data.username } : { id, email, username: data.username });
      }
    } catch {
      // Background profile fetch failure is non-blocking
    }
  };

  useEffect(() => {
    let isMounted = true;

    const resolveAuth = (user: any | null) => {
      if (!isMounted) return;
      if (user) {
        const fallbackUsername = user.user_metadata?.username || user.email?.split('@')[0] || 'shopper';
        setCurrentUser({
          id: user.id,
          email: user.email || '',
          username: fallbackUsername,
        });
        setLoading(false);
        // Enrich profile in background
        fetchProfile(user.id, user.email || '');
      } else {
        setCurrentUser(null);
        setLoading(false);
      }
    };

    // Initial session retrieval
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        resolveAuth(session?.user ?? null);
      })
      .catch(() => {
        resolveAuth(null);
      });

    // Fallback safety watchdog to guarantee loading is never stuck
    const safetyWatchdog = setTimeout(() => {
      if (isMounted) {
        setLoading(false);
      }
    }, 2500);

    // Auth state listener for sign in, sign out, token refresh
    let subscription: { unsubscribe: () => void } | null = null;
    try {
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        resolveAuth(session?.user ?? null);
      });
      subscription = data?.subscription ?? null;
    } catch (err) {
      console.warn('[AuthContext] onAuthStateChange setup error:', err);
      resolveAuth(null);
    }

    return () => {
      isMounted = false;
      clearTimeout(safetyWatchdog);
      subscription?.unsubscribe();
    };
  }, []);


  const login = async (emailOrUsername: string, password: string) => {
    let targetEmail = emailOrUsername.trim();
    
    if (!targetEmail.includes('@')) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('email')
          .eq('username', targetEmail)
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
      const { data, error } = await supabase.auth.signInWithPassword({
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

      // Immediately resolve user profile and set currentUser state before returning
      if (data?.user) {
        let username = data.user.email?.split('@')[0] || 'shopper';
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', data.user.id)
            .maybeSingle();
          if (profile?.username) {
            username = profile.username;
          }
        } catch (e) {
          // ignore profile lookup fallback
        }

        setCurrentUser({
          id: data.user.id,
          email: data.user.email || targetEmail,
          username,
        });
        setLoading(false);
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
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('[AuthContext] logout error:', err);
    } finally {
      setCurrentUser(null);
      setLoading(false);
    }
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
    <AuthContext.Provider value={{ isAuthenticated, currentUser, loading, login, signup, logout, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
