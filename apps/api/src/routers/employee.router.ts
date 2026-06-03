import { router, publicProcedure } from '../trpc/trpc.js';
import {
    employeeRegisterSchema,
    employeeGetByIdSchema,
    employeeListSchema,
} from '@bin-tracker/validators';
import { employeeService } from '../services/employee.service.js';

export const employeeRouter = router({
    /** Register a new employee and mint their permanent QR token */
    register: publicProcedure
        .input(employeeRegisterSchema)
        .mutation(async ({ input }) => {
            return employeeService.register(input);
        }),

    /** List employees (optionally filtered by status) */
    list: publicProcedure
        .input(employeeListSchema)
        .query(async ({ input }) => {
            return employeeService.list(input);
        }),

    /** Fetch a single employee by id */
    getById: publicProcedure
        .input(employeeGetByIdSchema)
        .query(async ({ input }) => {
            return employeeService.getById(input.id);
        }),
});
