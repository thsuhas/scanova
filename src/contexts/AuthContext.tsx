import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  username: string;
  email: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  currentUser: User | null;
  login: (user: User) => void;
  signup: (user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('isAuthenticated') === 'true';
  });
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('currentUser');
    if (stored) {
      try { return JSON.parse(stored); } catch { return null; }
    }
    return null;
  });

  useEffect(() => {
    if (isAuthenticated && currentUser) {
      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
    }
  }, [isAuthenticated, currentUser]);

  const login = (user: User) => {
    setIsAuthenticated(true);
    setCurrentUser(user);
  };

  const signup = (user: User) => {
    setIsAuthenticated(true);
    setCurrentUser(user);
  };

  const logout = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('currentUser');
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, currentUser, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
