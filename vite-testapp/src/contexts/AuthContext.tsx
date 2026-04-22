// ============================================================
// contexts/AuthContext.tsx — Global authentication state
//
// Provides:
//  • parent     — logged-in parent object (or null)
//  • token      — JWT stored in localStorage
//  • selectedChild — the child profile currently in focus
//  • login / register / logout / selectChild helpers
// ============================================================

import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Parent, Child } from '../types';
import { authService } from '../services/api';

// ── Context shape ──────────────────────────────────────────

interface AuthContextType {
  parent: Parent | null;
  token: string | null;
  selectedChild: Child | null;
  isLoading: boolean;

  login(email: string, password: string): Promise<void>;
  register(name: string, email: string, password: string): Promise<void>;
  logout(): void;
  selectChild(child: Child | null): void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ── Provider ───────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [parent, setParent]             = useState<Parent | null>(null);
  const [token, setToken]               = useState<string | null>(null);
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  const [isLoading, setIsLoading]       = useState(true);

  // Rehydrate from localStorage on first mount
  useEffect(() => {
    const storedToken  = localStorage.getItem('kidssafe_token');
    const storedParent = localStorage.getItem('kidssafe_parent');
    const storedChild  = localStorage.getItem('kidssafe_selected_child');

    if (storedToken && storedParent) {
      setToken(storedToken);
      setParent(JSON.parse(storedParent));
    }
    if (storedChild) {
      setSelectedChild(JSON.parse(storedChild));
    }
    setIsLoading(false);
  }, []);

  // ── Helpers ──────────────────────────────────────────────

  function persist(t: string, p: Parent) {
    localStorage.setItem('kidssafe_token', t);
    localStorage.setItem('kidssafe_parent', JSON.stringify(p));
    setToken(t);
    setParent(p);
  }

  async function login(email: string, password: string) {
    const { token: t, parent: p } = await authService.login(email, password);
    persist(t, p);
  }

  async function register(name: string, email: string, password: string) {
    const { token: t, parent: p } = await authService.register(name, email, password);
    persist(t, p);
  }

  function logout() {
    localStorage.removeItem('kidssafe_token');
    localStorage.removeItem('kidssafe_parent');
    localStorage.removeItem('kidssafe_selected_child');
    setToken(null);
    setParent(null);
    setSelectedChild(null);
  }

  function selectChild(child: Child | null) {
    setSelectedChild(child);
    if (child) {
      localStorage.setItem('kidssafe_selected_child', JSON.stringify(child));
    } else {
      localStorage.removeItem('kidssafe_selected_child');
    }
  }

  return (
    <AuthContext.Provider
      value={{ parent, token, selectedChild, isLoading, login, register, logout, selectChild }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────────

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
