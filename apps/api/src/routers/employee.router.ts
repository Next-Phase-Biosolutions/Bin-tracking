import { router, orgProcedure, orgOpsProcedure, requireModule } from '../trpc/trpc.js';
import {
    employeeRegisterSchema,
    employeeGetByIdSchema,
    employeeListSchema,
} from '@bin-tracker/validators';
import { employeeService } from '../services/employee.service.js';

export const employeeRouter = router({
    /** Register a new employee and mint their permanent QR token */
    register: orgOpsProcedure
        .use(requireModule('WORKFORCE'))
        .input(employeeRegisterSchema)
        .mutation(async ({ input, ctx }) => {
            return employeeService.register(input, ctx.orgId);
        }),

    /** List employees (optionally filtered by status) */
    list: orgProcedure
        .use(requireModule('WORKFORCE'))
        .input(employeeListSchema)
        .query(async ({ input, ctx }) => {
            return employeeService.list(ctx.orgId, input);
        }),

    /** Fetch a single employee by id */
    getById: orgProcedure
        .use(requireModule('WORKFORCE'))
        .input(employeeGetByIdSchema)
        .query(async ({ input, ctx }) => {
            return employeeService.getById(ctx.orgId, input.id);
        }),
});
