import { router } from '../trpc/trpc.js';
import { binRouter } from './bin.router.js';
import { cycleRouter } from './cycle.router.js';
import { facilityRouter } from './facility.router.js';
import { dashboardRouter } from './dashboard.router.js';
import { blockchainRouter } from './blockchain.router.js';
import { farmerRouter } from './farmer.router.js';
import { formRouter } from './form.router.js';
import { employeeRouter } from './employee.router.js';
import { attendanceRouter } from './attendance.router.js';
import { shipmentRouter } from './shipment.router.js';
import { payrollRouter } from './payroll.router.js';
import { billingRouter } from './billing.router.js';

export const appRouter = router({
    bin: binRouter,
    cycle: cycleRouter,
    facility: facilityRouter,
    dashboard: dashboardRouter,
    blockchain: blockchainRouter,
    farmer: farmerRouter,
    form: formRouter,
    employee: employeeRouter,
    attendance: attendanceRouter,
    shipment: shipmentRouter,
    payroll: payrollRouter,
    billing: billingRouter,
});

export type AppRouter = typeof appRouter;
