import { z } from 'zod';

/**
 * Wraps a string schema so it rejects NUL (\u0000). Postgres cannot store a
 * NUL in a text column, and the failure surfaces as a 500 from the driver
 * rather than a 400 — so it is rejected at the boundary instead.
 */
export function text<T extends z.ZodString>(schema: T) {
    return schema.refine((value) => !value.includes('\u0000'), 'must not contain NUL characters');
}
