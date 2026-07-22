import { describe, it, expect, vi } from 'vitest';

// ─── adminService payroll monitoring ───────────────────────────────────────
// Hoisted in-memory fake for @bin-tracker/db (same pattern as
// admin.router.test.ts / tenancy-isolation.test.ts) covering just the shapes
// getPayrollOverview / getPayrollOrgRuns / getPayrollRunDetail actually query:
// organization.findMany (with nested modules + latest payrollRun), and
// payrollRun.findUnique / findMany (used directly and via payrollService).

interface FakeOrg {
    id: string;
    name: string;
}
interface FakeModule {
    orgId: string;
    module: string;
    enabled: boolean;
}
interface FakeRun {
    id: string;
    organizationId: string;
    period: string;
    status: string;
    rateCents: number;
    currency: string;
    totalEmployees: number;
    totalMinutes: number;
    totalGrossCents: number;
    computedAt: Date | null;
    createdAt: Date;
}
interface FakeEmployee {
    id: string;
    fullName: string;
    bankAccountLast4: string | null;
}
interface FakeLineItem {
    id: string;
    runId: string;
    employeeId: string;
    grossCents: number;
    payoutStatus: string;
}
interface FakeException {
    id: string;
    runId: string;
    employeeId: string;
    type: string;
    resolved: boolean;
    note: string | null;
}

const store = vi.hoisted(() => ({
    organizations: [] as FakeOrg[],
    modules: [] as FakeModule[],
    runs: [] as FakeRun[],
    employees: [] as FakeEmployee[],
    lineItems: [] as FakeLineItem[],
    exceptions: [] as FakeException[],
}));

vi.mock('@bin-tracker/db', () => {
    const organization = {
        findMany: () => {
            const sorted = [...store.organizations].sort((a, b) => a.name.localeCompare(b.name));
            return Promise.resolve(
                sorted.map((org) => {
                    const latestRun = [...store.runs]
                        .filter((r) => r.organizationId === org.id)
                        .sort((a, b) => b.period.localeCompare(a.period))[0];
                    return {
                        ...org,
                        modules: store.modules.filter((m) => m.orgId === org.id && m.module === 'PAYROLL'),
                        payrollRuns: latestRun ? [{ ...latestRun }] : [],
                    };
                }),
            );
        },
    };

    // Mirrors the overview's raw stuck-count aggregation: HELD/FAILED line
    // items across every non-cancelled run, grouped by org and status.
    const $queryRaw = () => {
        const grouped = new Map<string, number>();
        for (const li of store.lineItems) {
            if (li.payoutStatus !== 'HELD' && li.payoutStatus !== 'FAILED') continue;
            const run = store.runs.find((r) => r.id === li.runId);
            if (!run || run.status === 'CANCELLED') continue;
            const key = `${run.organizationId}\t${li.payoutStatus}`;
            grouped.set(key, (grouped.get(key) ?? 0) + 1);
        }
        return Promise.resolve(
            [...grouped.entries()].map(([key, count]) => {
                const [organizationId, payoutStatus] = key.split('\t');
                return { organizationId, payoutStatus, count };
            }),
        );
    };

    const payrollRun = {
        findUnique: ({ where }: { where: { id: string } }) => {
            const run = store.runs.find((r) => r.id === where.id);
            if (!run) return Promise.resolve(null);
            const org = store.organizations.find((o) => o.id === run.organizationId)!;
            const employeeOf = (employeeId: string) => store.employees.find((e) => e.id === employeeId)!;
            return Promise.resolve({
                ...run,
                organization: { id: org.id, name: org.name },
                lineItems: store.lineItems
                    .filter((li) => li.runId === run.id)
                    .map((li) => ({ ...li, employee: employeeOf(li.employeeId) })),
                exceptions: store.exceptions
                    .filter((ex) => ex.runId === run.id)
                    .map((ex) => ({ ...ex, employee: employeeOf(ex.employeeId) })),
            });
        },
        findMany: ({ where, take }: { where: { organizationId: string }; take?: number }) => {
            const rows = store.runs
                .filter((r) => r.organizationId === where.organizationId)
                .sort((a, b) => b.period.localeCompare(a.period));
            return Promise.resolve(take ? rows.slice(0, take) : rows);
        },
    };

    return { prisma: { organization, payrollRun, $queryRaw }, setModuleOverride: vi.fn() };
});

const { adminService } = await import('./admin.service.js');

const ORG_A = 'org-a';
const ORG_B = 'org-b';
const RUN_A1 = 'run-a1';
const EMP_1 = 'emp-1';
const EMP_2 = 'emp-2';

function resetStore(): void {
    store.organizations.length = 0;
    store.modules.length = 0;
    store.runs.length = 0;
    store.employees.length = 0;
    store.lineItems.length = 0;
    store.exceptions.length = 0;
}

describe('adminService.getPayrollOverview', () => {
    it('reports payrollEnabled false and no run for an org with no OrganizationModule row', async () => {
        resetStore();
        store.organizations.push({ id: ORG_B, name: 'Org B' });

        const rows = await adminService.getPayrollOverview();

        expect(rows).toEqual([
            { orgId: ORG_B, orgName: 'Org B', payrollEnabled: false, latestRun: null, heldCount: 0, failedCount: 0 },
        ]);
    });

    it('counts stuck (HELD/FAILED) line items across ALL runs, not just the latest', async () => {
        resetStore();
        store.organizations.push({ id: ORG_A, name: 'Org A' });
        store.modules.push({ orgId: ORG_A, module: 'PAYROLL', enabled: true });
        store.runs.push(
            {
                id: RUN_A1,
                organizationId: ORG_A,
                period: '2026-07',
                status: 'APPROVED',
                rateCents: 2500,
                currency: 'CAD',
                totalEmployees: 2,
                totalMinutes: 0,
                totalGrossCents: 5000,
                computedAt: new Date('2026-07-01'),
                createdAt: new Date('2026-07-01'),
            },
            {
                id: 'run-a0',
                organizationId: ORG_A,
                period: '2026-06',
                status: 'PAID',
                rateCents: 2500,
                currency: 'CAD',
                totalEmployees: 1,
                totalMinutes: 0,
                totalGrossCents: 2500,
                computedAt: new Date('2026-06-01'),
                createdAt: new Date('2026-06-01'),
            },
        );
        store.lineItems.push(
            { id: 'li-1', runId: RUN_A1, employeeId: EMP_1, grossCents: 2500, payoutStatus: 'HELD' },
            { id: 'li-2', runId: RUN_A1, employeeId: EMP_2, grossCents: 2500, payoutStatus: 'FAILED' },
            // Stuck payment in the OLDER run — the regression this test pins:
            // the overview must surface it, not just latest-run trouble.
            { id: 'li-0', runId: 'run-a0', employeeId: EMP_1, grossCents: 2500, payoutStatus: 'HELD' },
        );

        const rows = await adminService.getPayrollOverview();
        const row = rows[0]!;

        expect(row.payrollEnabled).toBe(true);
        expect(row.latestRun?.id).toBe(RUN_A1); // latest run still shown
        expect(row.heldCount).toBe(2); // 1 in July + 1 in June
        expect(row.failedCount).toBe(1);
    });
});

describe('adminService.getPayrollOrgRuns', () => {
    it('returns only the requested org\'s runs, newest period first', async () => {
        resetStore();
        store.runs.push(
            {
                id: 'run-old',
                organizationId: ORG_A,
                period: '2026-05',
                status: 'PAID',
                rateCents: 2000,
                currency: 'CAD',
                totalEmployees: 1,
                totalMinutes: 0,
                totalGrossCents: 2000,
                computedAt: new Date(),
                createdAt: new Date(),
            },
            {
                id: RUN_A1,
                organizationId: ORG_A,
                period: '2026-07',
                status: 'APPROVED',
                rateCents: 2000,
                currency: 'CAD',
                totalEmployees: 1,
                totalMinutes: 0,
                totalGrossCents: 2000,
                computedAt: new Date(),
                createdAt: new Date(),
            },
            {
                id: 'run-other-org',
                organizationId: ORG_B,
                period: '2026-07',
                status: 'PAID',
                rateCents: 2000,
                currency: 'CAD',
                totalEmployees: 1,
                totalMinutes: 0,
                totalGrossCents: 2000,
                computedAt: new Date(),
                createdAt: new Date(),
            },
        );

        const rows = await adminService.getPayrollOrgRuns(ORG_A);

        expect(rows.map((r) => r.id)).toEqual([RUN_A1, 'run-old']);
    });
});

describe('adminService.getPayrollRunDetail', () => {
    it('throws NOT_FOUND for an unknown runId', async () => {
        resetStore();
        await expect(adminService.getPayrollRunDetail('missing')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('returns fullName + bankAccountLast4 only, never a raw bank field', async () => {
        resetStore();
        store.organizations.push({ id: ORG_A, name: 'Org A' });
        store.runs.push({
            id: RUN_A1,
            organizationId: ORG_A,
            period: '2026-07',
            status: 'APPROVED',
            rateCents: 2000,
            currency: 'CAD',
            totalEmployees: 1,
            totalMinutes: 0,
            totalGrossCents: 2000,
            computedAt: new Date(),
            createdAt: new Date(),
        });
        store.employees.push({ id: EMP_1, fullName: 'Jordan Rivera', bankAccountLast4: '1234' });
        store.lineItems.push({ id: 'li-1', runId: RUN_A1, employeeId: EMP_1, grossCents: 2000, payoutStatus: 'PAID' });
        store.exceptions.push({
            id: 'ex-1',
            runId: RUN_A1,
            employeeId: EMP_1,
            type: 'NO_CHECKOUT',
            resolved: false,
            note: null,
        });

        const detail = await adminService.getPayrollRunDetail(RUN_A1);

        expect(detail.orgName).toBe('Org A');
        expect(detail.lineItems).toEqual([
            {
                id: 'li-1',
                employeeId: EMP_1,
                fullName: 'Jordan Rivera',
                bankAccountLast4: '1234',
                grossCents: 2000,
                payoutStatus: 'PAID',
            },
        ]);
        expect(detail.exceptions).toEqual([
            { id: 'ex-1', employeeId: EMP_1, fullName: 'Jordan Rivera', type: 'NO_CHECKOUT', resolved: false, note: null },
        ]);
        // The only bank-shaped field present anywhere in the detail is the last-4 mask.
        expect(JSON.stringify(detail)).not.toMatch(/v1\./);
    });
});
