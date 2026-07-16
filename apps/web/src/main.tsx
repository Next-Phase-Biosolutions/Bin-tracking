import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Sentry from '@sentry/react';
import { AuthProvider } from './context/AuthContext.tsx';
import { SubscriptionProvider } from './context/SubscriptionContext.tsx';
import { trpc, createUserTRPCClient } from './lib/trpc.ts';
import { App } from './App.tsx';
import './index.css';

// No-ops when VITE_SENTRY_DSN is unset — mirrors the API's lazy, env-gated
// Sentry setup (apps/api/src/lib/sentry.ts). Must run once at startup,
// before the app renders.
const sentryDsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
if (sentryDsn) {
    Sentry.init({ dsn: sentryDsn, environment: import.meta.env.MODE });
}

function Root() {
    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                retry: 1,
                staleTime: 10_000,
            },
        },
    }));
    const [trpcClient] = useState(() => createUserTRPCClient());

    return (
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
            <QueryClientProvider client={queryClient}>
                <AuthProvider>
                    <SubscriptionProvider>
                        <BrowserRouter>
                            <App />
                        </BrowserRouter>
                    </SubscriptionProvider>
                </AuthProvider>
            </QueryClientProvider>
        </trpc.Provider>
    );
}

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');
createRoot(root).render(
    <StrictMode>
        <Root />
    </StrictMode>,
);
