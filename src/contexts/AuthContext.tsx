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

    // Direct initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;
      if (session?.user) {
        fetchProfile(session.user.id, session.user.email || '');
      } else {
        setCurrentUser(null);
        setLoading(false);
      }
    }).catch(() => {
      if (active) {
        setCurrentUser(null);
        setLoading(false);
      }
    });

    try {
      const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (!active) return;
        if (session?.user) {
          await fetchProfile(session.user.id, session.user.email || '');
        } else {
          setCurrentUser(null);
          setLoading(false);
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
