import { router, orgProcedure, orgOpsProcedure, publicProcedure, requireModule } from '../trpc/trpc.js';
import { bankLinkRateLimit, bankTokenRateLimit } from '../trpc/rate-limit.js';
import {
    employeeRegisterSchema,
    employeeGetByIdSchema,
    employeeListSchema,
    setEmployeeRateSchema,
    employeeBankSubmitSchema,
    employeeBankLinkSchema,
    employeeRequestBankDetailsSchema,
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

    /** List employees (optionally filtered by status / search). Per-employee
     * rates are stripped for non-ADMIN/OPS callers (ctx.orgRole). */
    list: orgProcedure
        .use(requireModule('WORKFORCE'))
        .input(employeeListSchema)
        .query(async ({ input, ctx }) => {
            return employeeService.list(ctx.orgId, input, ctx.orgRole);
        }),

    /** Fetch a single employee by id (rate stripped for non-ADMIN/OPS callers) */
    getById: orgProcedure
        .use(requireModule('WORKFORCE'))
        .input(employeeGetByIdSchema)
        .query(async ({ input, ctx }) => {
            return employeeService.getById(ctx.orgId, input.id, ctx.orgRole);
        }),

    /** Set or clear (null) an employee's per-employee pay rate override.
     * Ops+admin only, and only while the org's PAYROLL module is enabled —
     * rates are a payroll feature, so OFF blocks writes as well as reads. */
    setHourlyRate: orgOpsProcedure
        .use(requireModule('WORKFORCE'))
        .use(requireModule('PAYROLL'))
        .input(setEmployeeRateSchema)
        .mutation(async ({ input, ctx }) => {
            return employeeService.setHourlyRate(ctx.orgId, input.employeeId, input.hourlyRateCents, ctx.user!.id);
        }),

    /** Email the employee a one-time link to submit their own bank details */
    requestBankDetails: orgOpsProcedure
        .use(requireModule('WORKFORCE'))
        .use(bankLinkRateLimit())
        .input(employeeRequestBankDetailsSchema)
        .mutation(async ({ input, ctx }) => {
            return employeeService.requestBankDetails(ctx.orgId, input.employeeId);
        }),

    /**
     * Public: resolve a bank-details link for the page header.
     *
     * A MUTATION, not a query, despite being a read. tRPC puts query input in
     * the URL query string, which Fastify's request log and any reverse proxy
     * would record — that would write a live credential into the access logs.
     * POST keeps the token in the body.
     */
    bankLinkContext: publicProcedure
        .use(bankTokenRateLimit())
        .input(employeeBankLinkSchema)
        .mutation(async ({ input }) => {
            return employeeService.getBankLinkContext(input.token);
        }),

    /**
     * Public: the employee submits their own bank details. No session — the
     * link token is the sole credential, and the organization is taken from
     * the row it resolves to, never from client input.
     */
    submitBankDetails: publicProcedure
        .use(bankTokenRateLimit())
        .input(employeeBankSubmitSchema)
        .mutation(async ({ input }) => {
            return employeeService.submitBankDetails(input);
        }),
});
