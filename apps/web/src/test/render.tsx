import type { ReactElement } from 'react';
import { afterEach } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TRPCClientError } from '@trpc/client';

// Component tests opt in to jsdom with `// @vitest-environment jsdom` at the top of the file;
// the rest of the web suite stays in the fast node environment. Without vitest globals,
// testing-library cannot register its own cleanup, so importing this file does it.
afterEach(cleanup);

/** Renders under a MemoryRouter at `route`. */
export function renderAt(ui: ReactElement, route = '/') {
    return render(<MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>);
}

/** An error shaped like the API's: machine code in data.appCode, HTTP status in data.httpStatus. */
export function apiError(appCode: string, httpStatus = 409) {
    return TRPCClientError.from({ error: { message: appCode, code: -32000, data: { appCode, httpStatus } } } as never);
}

/** A gateway failure with no structured body (e.g. a proxy returning an HTML error page). */
export function gatewayError() {
    return new TRPCClientError('Unexpected token < in JSON');
}
