import { describe, it, expect, vi, beforeEach } from 'vitest';

// Regression test for the badge/fake-check-in fix: `list` and `getById` must
// reject non-ADMIN/OPS_MANAGER callers with FORBIDDEN (they return qrCode,
// the same credential attendance.scan accepts as a bearer token), while
// `listForPicker` must stay open to any org member with WORKFORCE enabled
// (the animal-intake "employee received" dropdown depends on it). This drives
// the router through createCaller — the actual orgOpsProcedure/orgProcedure +
// requireOrgRole middleware chain — rather than calling employeeService
// directly, so a future revert of the procedure type would fail this test.
const employeeServiceMock = {
    register: vi.fn(),
    list: vi.fn(),
    getById: vi.fn(),
    listForPicker: vi.fn(),
    setHourlyRate: vi.fn(),
    requestBankDetails: vi.fn(),
    getBankLinkContext: vi.fn(),
    submitBankDetails: vi.fn(),
};

vi.mock('../services/employee.service.js', () => ({
    employeeService: employeeServiceMock,
}));

const { employeeRouter } = await import('./employee.router.js');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeCtx(orgRole: string | null): any {
    return {
        orgId: 'org-1',
        orgRole,
        user: { id: 'user-1' },
        prisma: {
            organizationModule: {
                // WORKFORCE always enabled — these tests are about the role
                // gate, not the module gate.
                findUnique: vi.fn().mockResolvedValue({ enabled: true }),
            },
        },
    };
}

beforeEach(() => {
    delete process.env['DISABLE_AUTH'];
    vi.clearAllMocks();
});

describe('employee.list — badge exposure gate', () => {
    it('rejects WORKER with FORBIDDEN', async () => {
        const caller = employeeRouter.createCaller(makeCtx('WORKER'));
        await expect(caller.list({ limit: 100 })).rejects.toMatchObject({ code: 'FORBIDDEN' });
        expect(employeeServiceMock.list).not.toHaveBeenCalled();
    });

    it('rejects DRIVER with FORBIDDEN', async () => {
        const caller = employeeRouter.createCaller(makeCtx('DRIVER'));
        await expect(caller.list({ limit: 100 })).rejects.toMatchObject({ code: 'FORBIDDEN' });
        expect(employeeServiceMock.list).not.toHaveBeenCalled();
    });

    it('allows ADMIN', async () => {
        employeeServiceMock.list.mockResolvedValue([{ id: 'e1', qrCode: 'ATT-1' }]);
        const caller = employeeRouter.createCaller(makeCtx('ADMIN'));
        const result = await caller.list({ limit: 100 });
        expect(result).toEqual([{ id: 'e1', qrCode: 'ATT-1' }]);
        expect(employeeServiceMock.list).toHaveBeenCalledWith('org-1', { limit: 100 }, 'ADMIN');
    });

    it('allows OPS_MANAGER', async () => {
        employeeServiceMock.list.mockResolvedValue([]);
        const caller = employeeRouter.createCaller(makeCtx('OPS_MANAGER'));
        await expect(caller.list({ limit: 100 })).resolves.toEqual([]);
    });
});

describe('employee.getById — badge exposure gate', () => {
    it('rejects WORKER with FORBIDDEN', async () => {
        const caller = employeeRouter.createCaller(makeCtx('WORKER'));
        await expect(caller.getById({ id: 'e1' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
        expect(employeeServiceMock.getById).not.toHaveBeenCalled();
    });

    it('allows OPS_MANAGER', async () => {
        employeeServiceMock.getById.mockResolvedValue({ id: 'e1', qrCode: 'ATT-1' });
        const caller = employeeRouter.createCaller(makeCtx('OPS_MANAGER'));
        const result = await caller.getById({ id: 'e1' });
        expect(result).toEqual({ id: 'e1', qrCode: 'ATT-1' });
    });
});

describe('employee.listForPicker — stays open (no badge data returned)', () => {
    it('allows WORKER', async () => {
        employeeServiceMock.listForPicker.mockResolvedValue([
            { id: 'e1', fullName: 'Jane Doe', employeeCode: 'EMP-000001' },
        ]);
        const caller = employeeRouter.createCaller(makeCtx('WORKER'));
        const result = await caller.listForPicker();
        expect(result).toEqual([{ id: 'e1', fullName: 'Jane Doe', employeeCode: 'EMP-000001' }]);
        expect(employeeServiceMock.listForPicker).toHaveBeenCalledWith('org-1');
    });

    it('allows DRIVER', async () => {
        employeeServiceMock.listForPicker.mockResolvedValue([]);
        const caller = employeeRouter.createCaller(makeCtx('DRIVER'));
        await expect(caller.listForPicker()).resolves.toEqual([]);
    });

    it('never returns qrCode/hourlyRateCents — service contract, not just router pass-through', async () => {
        const row = { id: 'e1', fullName: 'Jane Doe', employeeCode: 'EMP-000001' };
        employeeServiceMock.listForPicker.mockResolvedValue([row]);
        const caller = employeeRouter.createCaller(makeCtx('WORKER'));
        const [result] = await caller.listForPicker();
        expect(result).not.toHaveProperty('qrCode');
        expect(result).not.toHaveProperty('hourlyRateCents');
    });
});
