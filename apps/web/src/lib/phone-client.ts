import { createTRPCClient, httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import type { AppRouter } from '../../../api/src/routers/index.ts';

/**
 * Vanilla tRPC client for the PUBLIC phone pages (/app/tap, /app/register).
 *
 * Pinned to the RELATIVE path /trpc on purpose — it ignores VITE_API_URL. The
 * device cookie only reaches the API when the request is same-origin: Vite's
 * proxy in dev, and the /trpc/* rewrite in netlify.toml in production. Pointing
 * this at the API host directly would send no cookie. No Authorization header:
 * these pages have no signed-in user.
 *
 * A vanilla client (not the React hooks) also matches the other public pages,
 * where the hook form was observed not to settle (see BankDetailsPage).
 */
export const phoneClient = createTRPCClient<AppRouter>({
    links: [httpBatchLink({ url: '/trpc', transformer: superjson })],
});
