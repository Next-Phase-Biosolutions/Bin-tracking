import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext.tsx';
import { trpc, createUserTRPCClient } from './lib/trpc.ts';
import { App } from './App.tsx';
import './index.css';

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
                    <BrowserRouter>
                        <App />
                    </BrowserRouter>
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
