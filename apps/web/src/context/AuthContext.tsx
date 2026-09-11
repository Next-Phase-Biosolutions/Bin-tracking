import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase.ts';
import { setAuthToken, setSelectedOrgId } from '../lib/trpc.ts';
import { clearCachedModules } from '../lib/moduleCache.ts';

interface AuthUser {
    id: string;
    email: string;
}

interface AuthContextValue {
    user: AuthUser | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    /**
     * Returns { needsEmailConfirmation: true } when the Supabase project
     * requires confirming the email before a session is issued — signUp()
     * still succeeds but data.session is null until the caller verifies the
     * 6-digit code via verifySignupOtp.
     */
    signup: (email: string, password: string) => Promise<{ needsEmailConfirmation: boolean }>;
    /** Verifies the signup OTP and establishes the session — no separate login step needed. */
    verifySignupOtp: (email: string, code: string) => Promise<void>;
    resendSignupOtp: (email: string) => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Local dev bypass. The API has honoured DISABLE_AUTH for a while (it picks
 * the first ADMIN user and skips token checks) and trpc.ts already drops the
 * Authorization header for it, but this provider still required a real
 * Supabase session — so RootRedirect/AppShellLayout bounced every route to
 * the marketing site's login, which is a separate app on another port. That
 * made the flag unusable on its own. Standing in a placeholder user here
 * completes the bypass; DEV-gated so a production build can never take it.
 */
const AUTH_DISABLED = import.meta.env.DEV && import.meta.env.VITE_DISABLE_AUTH === 'true';
const DEV_USER: AuthUser = { id: 'dev-bypass', email: 'dev@localhost' };

export function AuthProvider({ children }: { children: ReactNode }) {
    const queryClient = useQueryClient();
    const [user, setUser] = useState<AuthUser | null>(AUTH_DISABLED ? DEV_USER : null);
    const [loading, setLoading] = useState(!AUTH_DISABLED);

    // Restore session on mount
    useEffect(() => {
        if (AUTH_DISABLED) return;
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                setUser({ id: session.user.id, email: session.user.email ?? '' });
                setAuthToken(session.access_token);
            }
            setLoading(false);
        });

        // Listen for auth state changes (token refresh, sign out)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session) {
                setUser({ id: session.user.id, email: session.user.email ?? '' });
                setAuthToken(session.access_token);
            } else {
                setUser(null);
                setAuthToken(null);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const login = useCallback(async (email: string, password: string) => {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error(error.message);
        if (!data.session) throw new Error('No session returned');
        setUser({ id: data.user.id, email: data.user.email ?? '' });
        setAuthToken(data.session.access_token);
    }, []);

    const signup = useCallback(async (email: string, password: string) => {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw new Error(error.message);
        if (!data.session || !data.user) {
            return { needsEmailConfirmation: true };
        }
        setUser({ id: data.user.id, email: data.user.email ?? '' });
        setAuthToken(data.session.access_token);
        return { needsEmailConfirmation: false };
    }, []);

    const verifySignupOtp = useCallback(async (email: string, code: string) => {
        const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: 'signup' });
        if (error) throw new Error(error.message);
        if (!data.session || !data.user) throw new Error('No session returned');
        // onAuthStateChange also fires from this call, but setting here avoids
        // a render where `user` is still null right after verification.
        setUser({ id: data.user.id, email: data.user.email ?? '' });
        setAuthToken(data.session.access_token);
    }, []);

    const resendSignupOtp = useCallback(async (email: string) => {
        const { error } = await supabase.auth.resend({ type: 'signup', email });
        if (error) throw new Error(error.message);
    }, []);

    const logout = useCallback(async () => {
        await supabase.auth.signOut();
        setUser(null);
        setAuthToken(null);
        // Org-scoped data must not survive into the next session — without
        // this, signing into a different account/org in the same tab briefly
        // shows the previous org's dashboard, members, and billing data.
        setSelectedOrgId(null); // stale org selection must not leak into the next login
        queryClient.clear();
        clearCachedModules();
    }, [queryClient]);

    return (
        <AuthContext.Provider value={{ user, loading, login, signup, verifySignupOtp, resendSignupOtp, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
    return ctx;
}
