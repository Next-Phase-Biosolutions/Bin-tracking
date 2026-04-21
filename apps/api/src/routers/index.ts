import { router } from '../trpc/trpc.js';
import { binRouter } from './bin.router.js';
import { cycleRouter } from './cycle.router.js';
import { facilityRouter } from './facility.router.js';
import { dashboardRouter } from './dashboard.router.js';
import { blockchainRouter } from './blockchain.router.js';
import { farmerRouter } from './farmer.router.js';

export const appRouter = router({
    bin: binRouter,
    cycle: cycleRouter,
    facility: facilityRouter,
    dashboard: dashboardRouter,
    blockchain: blockchainRouter,
    farmer: farmerRouter,
});

export type AppRouter = typeof appRouter;
