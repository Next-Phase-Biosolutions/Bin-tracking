import { z } from 'zod';

// ─── Reusable Pagination Schema ───────────────────────────────

export const paginationSchema = z.object({
    cursor: z.string().optional(),
    limit: z.number().int().min(1).max(100).default(20),
});

export type PaginationInput = z.infer<typeof paginationSchema>;
