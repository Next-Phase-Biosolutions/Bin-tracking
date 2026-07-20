import { createTRPCReact } from '@trpc/react-query';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import type { AppRouter } from '../../../api/src/routers/index.ts';
import type { inferRouterOutputs } from '@trpc/server';

export type RouterOutputs = inferRouterOutputs<AppRouter>;

export const trpc = createTRPCReact<AppRouter>();

// ─── Auth token store ──────────────────────────────────────────────────────
// Written by AuthContext on login/logout, read by httpBatchLink on every request
let _authToken: string | null = null;

export function setAuthToken(token: string | null): void {
    _authToken = token;
}

// ─── Selected-org store (multi-org users) ──────────────────────────────────
// Persisted so the choice survives reloads. Sent as the `x-org-id` header,
// which the API validates against the caller's own memberships and FAILS
// CLOSED (org-context.ts) — a stale/foreign value resolves to no org, never
// someone else's. Single-org users never set this, so no header is sent and
// the backend uses their only membership as before.
const SELECTED_ORG_KEY = 'selected-org-id';

export function getSelectedOrgId(): string | null {
    try {
        return localStorage.getItem(SELECTED_ORG_KEY);
    } catch {
        return null;
    }
}

export function setSelectedOrgId(orgId: string | null): void {
    try {
        if (orgId) localStorage.setItem(SELECTED_ORG_KEY, orgId);
        else localStorage.removeItem(SELECTED_ORG_KEY);
    } catch {
        // localStorage unavailable (private mode / SSR) — non-fatal; the
        // backend just falls back to the caller's default org.
    }
}

function authHeaders(): Record<string, string> {
    if (import.meta.env.VITE_DISABLE_AUTH === 'true') return {};
    const headers: Record<string, string> = {};
    if (_authToken) headers['Authorization'] = `Bearer ${_authToken}`;
    const orgId = getSelectedOrgId();
    if (orgId) headers['x-org-id'] = orgId;
    return headers;
}

// ─── User tRPC client (JWT auth) ───────────────────────────────────────────
export function createUserTRPCClient() {
    return trpc.createClient({
        links: [
            httpBatchLink({
                url: import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/trpc` : '/trpc',
                transformer: superjson,
                // When auth is disabled, send no header — backend injects admin
                // user automatically. Otherwise: bearer token + optional x-org-id.
                headers: authHeaders,
            }),
        ],
    });
}

// ─── Vanilla tRPC client (same JWT auth as the React client) ───────────────
// For pages that need one-off imperative calls outside the React hooks tree
// (scanner mutations, voice transcription, etc.). authHeaders() reads the
// token and selected org at call time, so a module-level instance stays valid
// across login/logout and org switches.
export const apiClient = createTRPCClient<AppRouter>({
    links: [
        httpBatchLink({
            url: import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/trpc` : '/trpc',
            transformer: superjson,
            headers: authHeaders,
        }),
    ],
});
