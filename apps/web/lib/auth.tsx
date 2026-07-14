"use client";

/**
 * Auth backed by Supabase (JWT). Keeps the exact useAuth() shape the UI already uses,
 * so no screen changes are needed. In DEMO_MODE (auth disabled or Supabase not yet
 * configured) it shows a stand-in user and the API injects an admin — so the app is
 * fully usable before real login is wired.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase, supabaseConfigured } from "./supabase";
import { setAuthToken } from "./trpc";

const DISABLE_AUTH = process.env.NEXT_PUBLIC_DISABLE_AUTH === "true";
const DEMO_MODE = DISABLE_AUTH || !supabaseConfigured;

export interface User {
  name: string;
  email: string;
  role: string;
}
interface AuthCtx {
  user: User | null;
  ready: boolean;
  login: (email: string, password?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  user: null,
  ready: false,
  login: async () => {},
  logout: async () => {},
});

function nameFromEmail(email: string): string {
  return (
    email
      .split("@")[0]
      .replace(/[._-]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase()) || "Operator"
  );
}

function userFromSession(session: { user?: { email?: string; user_metadata?: Record<string, unknown>; app_metadata?: Record<string, unknown> } } | null): User {
  const u = session?.user;
  const email = u?.email ?? "operator@nextphase.com";
  const role =
    (u?.app_metadata?.role as string) || (u?.user_metadata?.role as string) || "Plant Manager";
  const name = (u?.user_metadata?.name as string) || nameFromEmail(email);
  return { name, email, role };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (DEMO_MODE) {
      setUser({ name: "Operator", email: "operator@nextphase.com", role: "Plant Manager" });
      setAuthToken(null);
      setReady(true);
      return;
    }
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const s = data.session;
      setAuthToken(s?.access_token ?? null);
      setUser(s ? userFromSession(s) : null);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setAuthToken(s?.access_token ?? null);
      setUser(s ? userFromSession(s) : null);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password = "") => {
    if (DEMO_MODE) {
      setUser({ name: nameFromEmail(email), email, role: "Plant Manager" });
      setAuthToken(null);
      return;
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    setAuthToken(data.session?.access_token ?? null);
    setUser(data.session ? userFromSession(data.session) : null);
  };

  const logout = async () => {
    if (!DEMO_MODE && supabaseConfigured) await supabase.auth.signOut();
    setAuthToken(null);
    setUser(null);
  };

  return <Ctx.Provider value={{ user, ready, login, logout }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
