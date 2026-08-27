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
    // 1. Check current session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchProfile(session.user.id, session.user.email || '');
      } else {
        setLoading(false);
      }
    });

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        await fetchProfile(session.user.id, session.user.email || '');
      } else {
        setCurrentUser(null);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    // Check if email format is inputted; if it's just a username, append a mock domain
    let formattedEmail = email;
    if (!email.includes('@')) {
      formattedEmail = `${email}@scanova.com`;
    }
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: formattedEmail,
        password,
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

  const signup = async (username: string, email: string, password: string) => {
    let formattedEmail = email;
    if (!email.includes('@')) {
      formattedEmail = `${email}@scanova.com`;
    }
    try {
      const { data, error } = await supabase.auth.signUp({
        email: formattedEmail,
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

  const isAuthenticated = currentUser !== null;

  return (
    <AuthContext.Provider value={{ isAuthenticated, currentUser, login, signup, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
