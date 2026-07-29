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

    /** List employees (optionally filtered by status / search), including
     * each employee's badge (qrCode) — the same code attendance.scan accepts
     * as a bearer credential. ADMIN/OPS_MANAGER only: any org member could
     * otherwise view (and reproduce) another employee's check-in badge. Rates
     * are additionally stripped unless the PAYROLL module is on. */
    list: orgOpsProcedure
        .use(requireModule('WORKFORCE'))
        .input(employeeListSchema)
        .query(async ({ input, ctx }) => {
            return employeeService.list(ctx.orgId, input, ctx.orgRole);
        }),

    /** Fetch a single employee by id — same badge-exposure reasoning as
     * `list`, so ADMIN/OPS_MANAGER only. */
    getById: orgOpsProcedure
        .use(requireModule('WORKFORCE'))
        .input(employeeGetByIdSchema)
        .query(async ({ input, ctx }) => {
            return employeeService.getById(ctx.orgId, input.id, ctx.orgRole);
        }),

    /** Minimal active-employee picker (id/name/code, no badge) for non-admin
     * flows like animal-intake's "employee received" field. Open to any org
     * member — see employeeService.listForPicker for why it's safe. */
    listForPicker: orgProcedure
        .use(requireModule('WORKFORCE'))
        .query(async ({ ctx }) => {
            return employeeService.listForPicker(ctx.orgId);
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
