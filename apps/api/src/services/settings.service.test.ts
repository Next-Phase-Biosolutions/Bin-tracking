import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── settingsService ───────────────────────────────────────────────────────
// In-memory fake for @bin-tracker/db (same vi.hoisted pattern as
// admin.service.payroll.test.ts) covering settings.findUnique/upsert plus the
// audit-log write and the manager-email change notice. Proves update() is
// org-scoped, audited, and notifies the PREVIOUS manager address.

interface FakeSettings {
    organizationId: string;
    flatHourlyRateCents: number;
    currency: string;
    companyTimezone: string;
    managerEmail: string | null;
}

interface FakeAudit {
    orgId: string;
    actorId: string;
    action: string;
    targetId?: string | null;
    oldValue?: unknown;
    newValue?: unknown;
}

const store = vi.hoisted(() => ({
    settings: [] as FakeSettings[],
    auditLogs: [] as FakeAudit[],
}));

const sentNotices = vi.hoisted(() => [] as Array<{ to: string; orgName: string; newEmail: string | null }>);

vi.mock('../lib/email.js', () => ({
    sendManagerEmailChangedNotice: (to: string, orgName: string, newEmail: string | null) => {
        sentNotices.push({ to, orgName, newEmail });
        return Promise.resolve();
    },
}));

vi.mock('@bin-tracker/db', () => {
    const settings = {
        // Copies, not live references — real Prisma rows are detached snapshots.
        findUnique: ({ where }: { where: { organizationId: string } }) => {
            const row = store.settings.find((s) => s.organizationId === where.organizationId);
            return Promise.resolve(row ? { ...row } : null);
        },
        upsert: ({
            where,
            create,
            update,
        }: {
            where: { organizationId: string };
            create: FakeSettings;
            update: Partial<FakeSettings>;
        }) => {
            const existing = store.settings.find((s) => s.organizationId === where.organizationId);
            if (existing) {
                Object.assign(existing, update);
                return Promise.resolve({ ...existing });
            }
            store.settings.push({ ...create });
            return Promise.resolve({ ...create });
        },
    };
    const payrollAuditLog = {
        create: ({ data }: { data: FakeAudit }) => {
            store.auditLogs.push(data);
            return Promise.resolve(data);
        },
    };
    const organization = {
        findUnique: () => Promise.resolve({ name: 'Acme Farms' }),
    };
    const prisma = {
        settings,
        payrollAuditLog,
        organization,
        $transaction: (ops: Promise<unknown>[]) => Promise.all(ops),
    };
    return { prisma };
});

const { settingsService } = await import('./settings.service.js');

const ORG_A = 'org-a';
const ORG_B = 'org-b';
const ACTOR = 'admin-1';
const INPUT = {
    flatHourlyRateCents: 2000,
    currency: 'CAD' as const,
    companyTimezone: 'America/Toronto',
    managerEmail: 'boss@example.test',
};

function seed(orgId: string, overrides: Partial<FakeSettings> = {}): void {
    store.settings.push({
        organizationId: orgId,
        flatHourlyRateCents: 1500,
        currency: 'CAD',
        companyTimezone: 'America/Toronto',
        managerEmail: null,
        ...overrides,
    });
}

beforeEach(() => {
    store.settings.length = 0;
    store.auditLogs.length = 0;
    sentNotices.length = 0;
});

describe('settingsService.update', () => {
    it('updates an existing org row in place', async () => {
        seed(ORG_A);

        const result = await settingsService.update(ORG_A, INPUT, ACTOR);

        expect(result.flatHourlyRateCents).toBe(2000);
        expect(result.managerEmail).toBe('boss@example.test');
        expect(store.settings).toHaveLength(1); // updated, not duplicated
    });

    it('creates a row when the org has none (defensive upsert path)', async () => {
        await settingsService.update(ORG_A, INPUT, ACTOR);
        expect(store.settings.find((s) => s.organizationId === ORG_A)?.flatHourlyRateCents).toBe(2000);
    });

    it('never touches another org’s row', async () => {
        seed(ORG_B);

        await settingsService.update(ORG_A, INPUT, ACTOR);

        const orgB = store.settings.find((s) => s.organizationId === ORG_B);
        expect(orgB?.flatHourlyRateCents).toBe(1500); // unchanged
        expect(orgB?.managerEmail).toBeNull();
    });

    it('writes an audit entry with who + old + new on every update', async () => {
        seed(ORG_A, { flatHourlyRateCents: 1500 });

        await settingsService.update(ORG_A, INPUT, ACTOR);

        expect(store.auditLogs).toHaveLength(1);
        const log = store.auditLogs[0]!;
        expect(log.orgId).toBe(ORG_A);
        expect(log.actorId).toBe(ACTOR);
        expect(log.action).toBe('settings.update');
        expect(log.oldValue).toMatchObject({ flatHourlyRateCents: 1500, managerEmail: null });
        expect(log.newValue).toMatchObject({ flatHourlyRateCents: 2000, managerEmail: 'boss@example.test' });
    });

    it('notifies the PREVIOUS manager address when the email changes', async () => {
        seed(ORG_A, { managerEmail: 'old-boss@example.test' });

        await settingsService.update(ORG_A, INPUT, ACTOR);

        expect(sentNotices).toEqual([
            { to: 'old-boss@example.test', orgName: 'Acme Farms', newEmail: 'boss@example.test' },
        ]);
    });

    it('notifies on clearing the manager email, but not when it is unchanged or was never set', async () => {
        seed(ORG_A, { managerEmail: 'boss@example.test' });

        // Unchanged — no notice.
        await settingsService.update(ORG_A, INPUT, ACTOR);
        expect(sentNotices).toHaveLength(0);

        // Cleared — the old holder is told approvals are paused.
        await settingsService.update(ORG_A, { ...INPUT, managerEmail: null }, ACTOR);
        expect(sentNotices).toEqual([{ to: 'boss@example.test', orgName: 'Acme Farms', newEmail: null }]);

        // Was never set (now null) — nothing to notify.
        sentNotices.length = 0;
        await settingsService.update(ORG_A, INPUT, ACTOR);
        expect(sentNotices).toHaveLength(0);
    });
});

describe('settingsService.get', () => {
    it('returns null for an org with no settings row', async () => {
        expect(await settingsService.get(ORG_A)).toBeNull();
    });
});
