import { describe, it, expect, vi, beforeEach } from 'vitest';

// Action Item 5: sensor.listDevices/getReadings must (1) gate on
// ENVIRONMENT_MONITORING like every other module-gated router, (2) intersect
// a client-supplied facilityId with the caller's own access list rather than
// replacing it — the tenant-isolation-one-level-down bug this workstream
// exists to close — and (3) null-check ctx.user/ctx.orgRole instead of
// force-asserting, since DISABLE_AUTH=true legitimately leaves ctx.user null.

const sensorServiceMock = {
    listDevicesForOrg: vi.fn(),
    getDeviceHistory: vi.fn(),
};

vi.mock('../services/sensor.service.js', () => ({
    sensorService: sensorServiceMock,
}));

const { sensorRouter } = await import('./sensor.router.js');

const ORG_A = 'org-a';

function makeCtx(opts: {
    orgRole: string | null;
    moduleEnabled: boolean;
    userFacilities?: string[];
    allFacilities?: string[];
    user?: { id: string } | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
}): any {
    return {
        orgId: ORG_A,
        user: opts.user === undefined ? { id: 'user-1' } : opts.user,
        orgRole: opts.orgRole,
        prisma: {
            organizationModule: {
                findUnique: vi.fn().mockResolvedValue(opts.moduleEnabled ? { enabled: true } : null),
            },
            facility: {
                findMany: vi.fn().mockResolvedValue((opts.allFacilities ?? []).map((id) => ({ id }))),
            },
            userFacility: {
                findMany: vi.fn().mockResolvedValue((opts.userFacilities ?? []).map((facilityId) => ({ facilityId }))),
            },
        },
    };
}

beforeEach(() => {
    delete process.env['DISABLE_AUTH'];
    vi.clearAllMocks();
});

describe('sensor router — module gating', () => {
    it('denies listDevices when ENVIRONMENT_MONITORING is not enabled for the org', async () => {
        const ctx = makeCtx({ orgRole: 'ADMIN', moduleEnabled: false, allFacilities: ['f-1'] });
        const caller = sensorRouter.createCaller(ctx);

        await expect(caller.listDevices({})).rejects.toMatchObject({ code: 'FORBIDDEN' });
        expect(sensorServiceMock.listDevicesForOrg).not.toHaveBeenCalled();
    });

    it('denies getReadings when ENVIRONMENT_MONITORING is not enabled for the org', async () => {
        const ctx = makeCtx({ orgRole: 'ADMIN', moduleEnabled: false });
        const caller = sensorRouter.createCaller(ctx);

        await expect(caller.getReadings({ deviceId: 'dev-1', range: '24h' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
        expect(sensorServiceMock.getDeviceHistory).not.toHaveBeenCalled();
    });
});

describe('sensor.getReadings — happy path', () => {
    it('returns readings for a valid device in an org with the module enabled', async () => {
        const readings = [{ id: 'r-1', deviceId: 'dev-1', tempC: 5 }];
        sensorServiceMock.getDeviceHistory.mockResolvedValue(readings);
        const ctx = makeCtx({ orgRole: 'ADMIN', moduleEnabled: true });
        const caller = sensorRouter.createCaller(ctx);

        const result = await caller.getReadings({ deviceId: 'dev-1', range: '24h' });

        expect(result).toEqual(readings);
        expect(sensorServiceMock.getDeviceHistory).toHaveBeenCalledWith(ORG_A, 'dev-1', '24h', 'user-1', 'ADMIN');
    });

    it('propagates NOT_FOUND from the service for a foreign-org deviceId', async () => {
        const { TRPCError } = await import('@trpc/server');
        sensorServiceMock.getDeviceHistory.mockRejectedValue(new TRPCError({ code: 'NOT_FOUND', message: 'Device not found' }));
        const ctx = makeCtx({ orgRole: 'ADMIN', moduleEnabled: true });
        const caller = sensorRouter.createCaller(ctx);

        await expect(caller.getReadings({ deviceId: 'foreign-dev', range: '24h' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
});

describe('sensor.listDevices — facilityId intersects the caller\'s own access, never replaces it', () => {
    it('a WORKER assigned only to Facility A supplying Facility B\'s id gets an empty facility list, not Facility B\'s devices', async () => {
        sensorServiceMock.listDevicesForOrg.mockResolvedValue({ companyTimezone: 'America/Toronto', devices: [] });
        const ctx = makeCtx({
            orgRole: 'WORKER',
            moduleEnabled: true,
            userFacilities: ['facility-a'],
        });
        const caller = sensorRouter.createCaller(ctx);

        await caller.listDevices({ facilityId: 'facility-b' });

        expect(sensorServiceMock.listDevicesForOrg).toHaveBeenCalledWith(ORG_A, []);
    });

    it('a WORKER supplying their own assigned facilityId gets that facility, not the full org list', async () => {
        sensorServiceMock.listDevicesForOrg.mockResolvedValue({ companyTimezone: 'America/Toronto', devices: [] });
        const ctx = makeCtx({
            orgRole: 'WORKER',
            moduleEnabled: true,
            userFacilities: ['facility-a'],
        });
        const caller = sensorRouter.createCaller(ctx);

        await caller.listDevices({ facilityId: 'facility-a' });

        expect(sensorServiceMock.listDevicesForOrg).toHaveBeenCalledWith(ORG_A, ['facility-a']);
    });

    it('an ADMIN with no facilityId filter gets every facility in the org', async () => {
        sensorServiceMock.listDevicesForOrg.mockResolvedValue({ companyTimezone: 'America/Toronto', devices: [] });
        const ctx = makeCtx({
            orgRole: 'ADMIN',
            moduleEnabled: true,
            allFacilities: ['f-1', 'f-2'],
        });
        const caller = sensorRouter.createCaller(ctx);

        await caller.listDevices({});

        expect(sensorServiceMock.listDevicesForOrg).toHaveBeenCalledWith(ORG_A, ['f-1', 'f-2']);
    });
});

describe('sensor.listDevices — DISABLE_AUTH null-context', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    it('returns UNAUTHORIZED cleanly rather than throwing when ctx.user is null under DISABLE_AUTH=true', async () => {
        vi.doMock('../lib/auth-flags.js', () => ({ isAuthDisabled: () => true }));
        vi.doMock('../services/sensor.service.js', () => ({ sensorService: sensorServiceMock }));
        await import('../trpc/trpc.js'); // establish module init order, matching middleware.test.ts's DISABLE_AUTH pattern
        const { sensorRouter: sensorRouterBypassed } = await import('./sensor.router.js');

        const ctx = makeCtx({ orgRole: null, moduleEnabled: true, user: null });
        const caller = sensorRouterBypassed.createCaller(ctx);

        await expect(caller.listDevices({})).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
        expect(sensorServiceMock.listDevicesForOrg).not.toHaveBeenCalled();
    });

    it('returns UNAUTHORIZED cleanly for getReadings too, rather than throwing when ctx.user is null under DISABLE_AUTH=true', async () => {
        vi.doMock('../lib/auth-flags.js', () => ({ isAuthDisabled: () => true }));
        vi.doMock('../services/sensor.service.js', () => ({ sensorService: sensorServiceMock }));
        await import('../trpc/trpc.js');
        const { sensorRouter: sensorRouterBypassed } = await import('./sensor.router.js');

        const ctx = makeCtx({ orgRole: null, moduleEnabled: true, user: null });
        const caller = sensorRouterBypassed.createCaller(ctx);

        await expect(caller.getReadings({ deviceId: 'dev-1', range: '24h' })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
        expect(sensorServiceMock.getDeviceHistory).not.toHaveBeenCalled();
    });
});
