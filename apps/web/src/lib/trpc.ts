import { createTRPCReact } from '@trpc/react-query';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import type { AppRouter } from '../../../api/src/routers/index.ts';

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
                headers: () =>
                    _authToken ? { Authorization: `Bearer ${_authToken}` } : {},
            }),
        ],
    });
}

// ─── Station tRPC client (station token auth) ──────────────────────────────
// Used for bin.start which requires "Authorization: Station <token>"
// Returns a vanilla (non-React) client for one-off mutation calls
export function createStationTRPCClient(stationToken: string) {
    return createTRPCClient<AppRouter>({
        links: [
            httpBatchLink({
                url: import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/trpc` : '/trpc',
                transformer: superjson,
                headers: () => ({ Authorization: `Station ${stationToken}` }),
            }),
        ],
    });
}
