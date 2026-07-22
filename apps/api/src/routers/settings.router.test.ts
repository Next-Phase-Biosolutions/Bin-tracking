import { describe, it, expect, vi } from 'vitest';
import { updatePayrollSettingsSchema } from '@bin-tracker/validators';

// settingsRouter is admin-only both ways (orgAdminProcedure). Mock the service
// and drive the router through createCaller — same harness as
// payroll.router.test.ts — to prove the role gate, then exercise the validator
// directly for the timezone/currency guards.

vi.mock('../services/settings.service.js', () => ({
    settingsService: { get: vi.fn().mockResolvedValue(null), update: vi.fn().mockResolvedValue({ ok: true }) },
}));

const { settingsRouter } = await import('./settings.router.js');
const { settingsService } = await import('../services/settings.service.js');

const VALID_INPUT = {
    flatHourlyRateCents: 1500,
    currency: 'CAD' as const,
    companyTimezone: 'America/Toronto',
    managerEmail: 'boss@example.test',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeCtx(orgRole: string | null): any {
    return { orgId: 'org-a', user: { id: 'u1' }, orgRole };
}

describe('settings.update — role gate', () => {
    it('lets an org ADMIN update', async () => {
        const caller = settingsRouter.createCaller(makeCtx('ADMIN'));
        await caller.update(VALID_INPUT);
        expect(settingsService.update).toHaveBeenCalledWith('org-a', VALID_INPUT, 'u1');
    });

    it('rejects an OPS_MANAGER with FORBIDDEN', async () => {
        const caller = settingsRouter.createCaller(makeCtx('OPS_MANAGER'));
        await expect(caller.update(VALID_INPUT)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('rejects a caller with no org role', async () => {
        const caller = settingsRouter.createCaller(makeCtx(null));
        await expect(caller.get()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });
});

describe('updatePayrollSettingsSchema — guards', () => {
    it('rejects an unknown timezone', () => {
        const r = updatePayrollSettingsSchema.safeParse({ ...VALID_INPUT, companyTimezone: 'Mars/Olympus' });
        expect(r.success).toBe(false);
    });

    it('rejects a non-CAD currency', () => {
        const r = updatePayrollSettingsSchema.safeParse({ ...VALID_INPUT, currency: 'USD' });
        expect(r.success).toBe(false);
    });

    it('rejects a zero or negative rate', () => {
        expect(updatePayrollSettingsSchema.safeParse({ ...VALID_INPUT, flatHourlyRateCents: 0 }).success).toBe(false);
    });

    it('accepts null managerEmail but rejects an empty string', () => {
        expect(updatePayrollSettingsSchema.safeParse({ ...VALID_INPUT, managerEmail: null }).success).toBe(true);
        expect(updatePayrollSettingsSchema.safeParse({ ...VALID_INPUT, managerEmail: '' }).success).toBe(false);
    });
});
