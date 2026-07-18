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

// ─── User tRPC client (JWT auth) ───────────────────────────────────────────
export function createUserTRPCClient() {
    return trpc.createClient({
        links: [
            httpBatchLink({
                url: import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/trpc` : '/trpc',
                transformer: superjson,
                headers: () => {
                    // When auth is disabled, send no header — backend injects admin user automatically
                    if (import.meta.env.VITE_DISABLE_AUTH === 'true') return {};
                    return _authToken ? { Authorization: `Bearer ${_authToken}` } : {};
                },
            }),
        ],
    });
}

// ─── Vanilla tRPC client (same JWT auth as the React client) ───────────────
// For pages that need one-off imperative calls outside the React hooks tree
// (scanner mutations, voice transcription, etc.). The headers() closure reads
// the token at call time, so a module-level instance stays valid across
// login/logout.
export const apiClient = createTRPCClient<AppRouter>({
    links: [
        httpBatchLink({
            url: import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/trpc` : '/trpc',
            transformer: superjson,
            headers: () => {
                if (import.meta.env.VITE_DISABLE_AUTH === 'true') return {};
                return _authToken ? { Authorization: `Bearer ${_authToken}` } : {};
            },
        }),
    ],
});
