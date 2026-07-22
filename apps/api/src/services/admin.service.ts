import { TRPCError } from '@trpc/server';
import type {
    ModuleKey,
    Plan,
    SubscriptionStatus,
    PayrollOrgOverview,
    PayrollAdminRunDetail,
    PayrollRunSummary,
} from '@bin-tracker/types';
import { prisma, setModuleOverride } from '@bin-tracker/db';
import { payrollService } from './payroll.service.js';

export interface OrgModuleView {
    module: ModuleKey;
    enabled: boolean;
    source: string; // 'plan' | 'manual'
}

export interface OrgListView {
    id: string;
    name: string;
    plan: Plan;
    status: SubscriptionStatus;
    modules: OrgModuleView[];
}

/**
 * Every org, with its current plan/status and its full module bundle — the
 * platform-admin panel's (Task 16) single data source. Orgs are provisioned
 * with a Subscription row at signup (see org-provision.ts), so a missing
 * subscription falls back to the schema's own defaults rather than crashing
 * on a null.
 */
export async function listOrganizations(): Promise<OrgListView[]> {
    const orgs = await prisma.organization.findMany({
        include: { subscription: true, modules: true },
        orderBy: { name: 'asc' },
    });

    return orgs.map((org) => ({
        id: org.id,
        name: org.name,
        plan: org.subscription?.plan ?? 'STARTER',
        status: org.subscription?.status ?? 'TRIALING',
        modules: org.modules.map((m) => ({ module: m.module, enabled: m.enabled, source: m.source })),
    }));
}

/**
 * Flips a single org's module on/off. Always routes through setModuleOverride
 * (Task 12), which always writes source: 'manual' — this is precisely the
 * override path that survives future plan changes (reconcileModulesForPlan
 * never touches manual rows). Scoped to input.orgId only, so it can never
 * touch another org's OrganizationModule row.
 */
export async function toggleModule(
    input: { orgId: string; module: ModuleKey; enabled: boolean },
    updatedBy: string,
): Promise<void> {
    const existing = await prisma.organizationModule.findUnique({
        where: { orgId_module: { orgId: input.orgId, module: input.module } },
    });

    await setModuleOverride(prisma, {
        orgId: input.orgId,
        module: input.module,
        enabled: input.enabled,
        updatedBy,
    });

    // Module toggles gate money movement (PAYROLL is a payout kill switch), so
    // they're audited alongside settings/rate changes. Best-effort ordering:
    // the toggle itself is the safety-critical write and stands even if this
    // insert were ever to fail.
    await prisma.payrollAuditLog.create({
        data: {
            orgId: input.orgId,
            actorId: updatedBy,
            action: 'module.toggle',
            targetId: input.module,
            oldValue: { enabled: existing?.enabled ?? null },
            newValue: { enabled: input.enabled },
        },
    });
}

/**
 * Every org's PAYROLL enablement plus its most recent run and how many line
 * items are stuck (HELD/FAILED) — the platform-admin dashboard's landing view.
 * Deliberately bypasses requireModule/orgOpsProcedure: a platform admin must
 * see orgs with PAYROLL OFF too, otherwise a frozen org (Decision 019,
 * payout-agent repo) would be invisible here.
 *
 * Stuck counts span ALL non-cancelled runs, not just the latest — a payment
 * stuck in an older run is exactly what this page exists to surface — and are
 * aggregated in SQL rather than materializing every line item (at 100 orgs x
 * hundreds of employees the old include loaded tens of thousands of rows to
 * render one table).
 */
export async function getPayrollOverview(): Promise<PayrollOrgOverview[]> {
    const [orgs, stuckRows] = await Promise.all([
        prisma.organization.findMany({
            include: {
                modules: { where: { module: 'PAYROLL' } },
                payrollRuns: { orderBy: { period: 'desc' }, take: 1 },
            },
            orderBy: { name: 'asc' },
        }),
        prisma.$queryRaw<Array<{ organizationId: string; payoutStatus: string; count: number }>>`
            SELECT pr."organizationId", pli."payoutStatus", COUNT(*)::int AS count
            FROM "payroll_line_items" pli
            JOIN "payroll_runs" pr ON pr."id" = pli."runId"
            WHERE pli."payoutStatus" IN ('HELD', 'FAILED')
              AND pr."status" <> 'CANCELLED'
            GROUP BY pr."organizationId", pli."payoutStatus"
        `,
    ]);

    const stuck = new Map<string, { held: number; failed: number }>();
    for (const row of stuckRows) {
        const entry = stuck.get(row.organizationId) ?? { held: 0, failed: 0 };
        if (row.payoutStatus === 'HELD') entry.held = row.count;
        else entry.failed = row.count;
        stuck.set(row.organizationId, entry);
    }

    return orgs.map((org) => {
        const latest = org.payrollRuns[0];
        return {
            orgId: org.id,
            orgName: org.name,
            payrollEnabled: org.modules[0]?.enabled ?? false,
            latestRun: latest
                ? {
                      id: latest.id,
                      period: latest.period,
                      status: latest.status,
                      totalEmployees: latest.totalEmployees,
                      totalGrossCents: latest.totalGrossCents,
                      currency: latest.currency,
                      computedAt: latest.computedAt,
                      createdAt: latest.createdAt,
                  }
                : null,
            heldCount: stuck.get(org.id)?.held ?? 0,
            failedCount: stuck.get(org.id)?.failed ?? 0,
        };
    });
}

/** One org's run history, newest period first. Reuses payrollService.listRuns directly — it already takes orgId as a plain parameter, no org-role coupling. */
export async function getPayrollOrgRuns(orgId: string): Promise<PayrollRunSummary[]> {
    return payrollService.listRuns(orgId, { limit: 60 });
}

/**
 * One run's line items and exceptions for the platform-admin drill-down.
 * Selects bankAccountLast4 (a display mask, not the encrypted account
 * number) alongside fullName — never a decrypted bank field.
 */
export async function getPayrollRunDetail(runId: string): Promise<PayrollAdminRunDetail> {
    const run = await prisma.payrollRun.findUnique({
        where: { id: runId },
        include: {
            organization: { select: { id: true, name: true } },
            lineItems: {
                include: { employee: { select: { fullName: true, bankAccountLast4: true } } },
                orderBy: { employee: { fullName: 'asc' } },
            },
            exceptions: {
                include: { employee: { select: { fullName: true } } },
                orderBy: { employee: { fullName: 'asc' } },
            },
        },
    });

    if (!run) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Payroll run not found.' });
    }

    return {
        id: run.id,
        orgId: run.organization.id,
        orgName: run.organization.name,
        period: run.period,
        status: run.status,
        currency: run.currency,
        totalEmployees: run.totalEmployees,
        totalGrossCents: run.totalGrossCents,
        computedAt: run.computedAt,
        createdAt: run.createdAt,
        lineItems: run.lineItems.map((li) => ({
            id: li.id,
            employeeId: li.employeeId,
            fullName: li.employee.fullName,
            bankAccountLast4: li.employee.bankAccountLast4,
            grossCents: li.grossCents,
            payoutStatus: li.payoutStatus,
        })),
        exceptions: run.exceptions.map((ex) => ({
            id: ex.id,
            employeeId: ex.employeeId,
            fullName: ex.employee.fullName,
            type: ex.type,
            resolved: ex.resolved,
            note: ex.note,
        })),
    };
}

export const adminService = {
    listOrganizations,
    toggleModule,
    getPayrollOverview,
    getPayrollOrgRuns,
    getPayrollRunDetail,
};
