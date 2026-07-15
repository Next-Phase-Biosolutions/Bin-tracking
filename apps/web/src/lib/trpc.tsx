import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink, createTRPCClient } from "@trpc/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import superjson from "superjson";
import { useState, type ReactNode } from "react";
import type { AppRouter } from "../../../api/src/routers/index.ts";

export const trpc = createTRPCReact<AppRouter>();

const API_URL = (import.meta.env.VITE_API_URL as string) || "";
const DISABLE_AUTH = import.meta.env.VITE_DISABLE_AUTH === "true";

/** True once VITE_API_URL points at the API (else the app falls back to mock data). */
export const apiConfigured = Boolean(API_URL);

const trpcUrl = API_URL ? `${API_URL}/trpc` : "/trpc";

// Supabase JWT, set by the auth provider; attached as Bearer on every request.
let _authToken: string | null = null;
export function setAuthToken(token: string | null): void {
  _authToken = token;
}

function authHeaders(): Record<string, string> {
  if (DISABLE_AUTH) return {}; // API injects an admin user in dev/integration
  return _authToken ? { Authorization: `Bearer ${_authToken}` } : {};
}

export function TRPCProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } }),
  );
  const [client] = useState(() =>
    trpc.createClient({
      links: [httpBatchLink({ url: trpcUrl, transformer: superjson, headers: authHeaders })],
    }),
  );
  return (
    <trpc.Provider client={client} queryClient={queryClient}>
      {/* cast: @trpc/react-query pulls @types/react 18 while app is on 19 */}
      <QueryClientProvider client={queryClient}>{children as never}</QueryClientProvider>
    </trpc.Provider>
  );
}

/** Vanilla (non-React) client for station-token calls, e.g. bin.start. */
export function createStationTRPCClient(stationToken: string) {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: trpcUrl,
        transformer: superjson,
        headers: () => (DISABLE_AUTH ? {} : { Authorization: `Station ${stationToken}` }),
      }),
    ],
  });
}
