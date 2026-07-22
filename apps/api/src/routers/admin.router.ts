import { z } from 'zod';
import { ALL_MODULE_KEYS } from '@bin-tracker/types';
import type { ModuleKey } from '@bin-tracker/types';
import { router, protectedProcedure, platformAdminProcedure } from '../trpc/trpc.js';
import { adminService } from '../services/admin.service.js';

const moduleKeyEnum = z.enum(ALL_MODULE_KEYS as [ModuleKey, ...ModuleKey[]]);

export const adminRouter = router({
    /**
     * Any authenticated user can call this — it only ever reports on the
     * caller's own account. Used by the frontend (Task 16 Step 6) as a
     * client-side, defense-in-depth gate before rendering the admin panel;
     * the real enforcement is platformAdminProcedure on the routes below.
     */
    whoAmI: protectedProcedure.query(({ ctx }) => ({ isPlatformAdmin: ctx.user?.isPlatformAdmin ?? false })),

    listOrganizations: platformAdminProcedure.query(() => adminService.listOrganizations()),

    toggleModule: platformAdminProcedure
        .input(z.object({ orgId: z.string(), module: moduleKeyEnum, enabled: z.boolean() }))
        .mutation(({ ctx, input }) => adminService.toggleModule(input, ctx.user!.id)),

    // ─── Payroll monitoring (read-only) ────────────────────────────────────
    payrollOverview: platformAdminProcedure.query(() => adminService.getPayrollOverview()),

    payrollOrgRuns: platformAdminProcedure
        .input(z.object({ orgId: z.string() }))
        .query(({ input }) => adminService.getPayrollOrgRuns(input.orgId)),

    payrollRunDetail: platformAdminProcedure
        .input(z.object({ runId: z.string() }))
        .query(({ input }) => adminService.getPayrollRunDetail(input.runId)),
});
