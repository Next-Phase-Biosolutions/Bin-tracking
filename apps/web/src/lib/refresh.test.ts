import { describe, expect, it } from 'vitest';
import { refreshQuery } from './refresh';

describe('refreshQuery', () => {
    it('cancels the in-flight request BEFORE invalidating, so the refetch is never merged into a stale one', async () => {
        const order: string[] = [];
        await refreshQuery({
            cancel: async () => void order.push('cancel'),
            invalidate: async () => void order.push('invalidate'),
        });
        expect(order).toEqual(['cancel', 'invalidate']);
    });

    it('does not invalidate if cancelling fails', async () => {
        const order: string[] = [];
        await expect(
            refreshQuery({
                cancel: async () => {
                    throw new Error('cancel failed');
                },
                invalidate: async () => void order.push('invalidate'),
            }),
        ).rejects.toThrow('cancel failed');
        expect(order).toEqual([]);
    });
});
