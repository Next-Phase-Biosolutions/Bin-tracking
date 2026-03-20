import { z } from 'zod';
import { router, adminProcedure } from '../trpc/trpc.js';
import { blockchainService } from '../services/blockchain.service.js';

export const blockchainRouter = router({
    /**
     * Fetch daily summary for blockchain anchoring.
     * Returns Merkle root, stats, and the CIP-25 metadata payload.
     * Admin-only — built using adminProcedure which enforces ADMIN role at middleware level.
     */
    getDailySummary: adminProcedure
        .input(
            z.object({
                fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
                toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
            }),
        )
        .query(({ input }) => blockchainService.getDailySummary(input.fromDate, input.toDate)),

    /**
     * Confirm that the NFT transaction was successfully submitted to Cardano.
     * Marks all provided cycle IDs as anchored with the given TX hash.
     * Idempotent — safe to retry on network error.
     * Admin-only.
     */
    confirmAnchor: adminProcedure
        .input(
            z.object({
                cycleIds: z.array(z.string().cuid()).min(1, 'At least one cycle ID is required'),
                txHash: z
                    .string()
                    .length(64, 'TX hash must be exactly 64 characters')
                    .regex(/^[0-9a-f]+$/i, 'TX hash must be a hex string'),
            }),
        )
        .mutation(({ input }) => blockchainService.confirmAnchor(input.cycleIds, input.txHash)),
});
