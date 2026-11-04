import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TRPCClientError, type TRPCLink } from '@trpc/client';
import { observable } from '@trpc/server/observable';
import { MemoryRouter } from 'react-router-dom';
import { trpc } from '../lib/trpc';
import type { AppRouter } from '../../../api/src/routers/index';
import './render'; // registers testing-library cleanup

type Handler = (input: unknown, callNumber: number) => unknown | Promise<unknown>;
export type Handlers = Record<string, Handler>;

/**
 * Renders under a REAL tRPC client + react-query whose network layer is replaced by canned
 * handlers keyed by procedure path ('nfcCard.list'). A handler may return a value, a promise,
 * or throw/reject; it also receives how many times that path has been called (1-based).
 */
export function renderWithTrpc(ui: ReactElement, handlers: Handlers, { route = '/' } = {}) {
    const calls: Array<{ path: string; input: unknown }> = [];
    const link: TRPCLink<AppRouter> = () => ({ op }) =>
        observable((observer) => {
            calls.push({ path: op.path, input: op.input });
            const callNumber = calls.filter((c) => c.path === op.path).length;
            const handler = handlers[op.path];
            Promise.resolve()
                .then(() => {
                    if (!handler) throw new Error(`No mock handler for ${op.path}`);
                    return handler(op.input, callNumber);
                })
                .then((data) => {
                    observer.next({ result: { type: 'data', data } } as never);
                    observer.complete();
                })
                .catch((e: unknown) => observer.error(e instanceof TRPCClientError ? e : TRPCClientError.from(e as Error)));
        });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const client = trpc.createClient({ links: [link] });
    const utils = render(
        <trpc.Provider client={client} queryClient={queryClient}>
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
            </QueryClientProvider>
        </trpc.Provider>,
    );
    return { ...utils, calls, callsTo: (path: string) => calls.filter((c) => c.path === path) };
}
