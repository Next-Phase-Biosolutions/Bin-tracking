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

// Written by kiosk-style pages (guard scanner, shipment intake, farmer
// registration, tablet form-fill) whose endpoints require stationProcedure.
// Takes precedence over the bearer token when set — mirrors the backend's
// own Station-vs-Bearer discrimination in trpc/context.ts.
let _stationToken: string | null = null;

export function setStationToken(token: string | null): void {
    _stationToken = token;
}

// ─── User tRPC client (JWT auth, station-token aware) ──────────────────────
export function createUserTRPCClient() {
    return trpc.createClient({
        links: [
            httpBatchLink({
                url: import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/trpc` : '/trpc',
                transformer: superjson,
                headers: () => {
                    // When auth is disabled, send no header — backend injects admin user automatically
                    if (import.meta.env.VITE_DISABLE_AUTH === 'true') return {};
                    if (_stationToken) return { Authorization: `Station ${_stationToken}` };
                    return _authToken ? { Authorization: `Bearer ${_authToken}` } : {};
                },
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
                // When auth is disabled, send no header — backend injects the station automatically
                headers: () =>
                    import.meta.env.VITE_DISABLE_AUTH === 'true'
                        ? {}
                        : { Authorization: `Station ${stationToken}` },
            }),
        ],
    });
}
