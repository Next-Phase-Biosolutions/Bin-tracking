import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserRole } from '@prisma/client';
import { appRouter } from './index.js';

// Role enforcement for every ADMIN / OPS_MANAGER procedure added for NFC attendance.
// No database: the role gate runs before any service, and an allowed role is proven by
// reaching the WORKFORCE module check (answered "disabled" by a fake) instead of a service.

type Api = ReturnType<typeof appRouter.createCaller>;

function caller(orgRole: UserRole | null, orgId: string | null = 'org-1'): Api {
    return appRouter.createCaller({
        prisma: { organizationModule: { findUnique: () => Promise.resolve({ enabled: false }) } },
        user: orgRole ? { id: 'u1', role: orgRole } : null,
        orgId,
        orgRole,
        jwtPayload: null,
        req: { cookies: {}, headers: {}, ip: '10.1.1.1', log: { warn: () => undefined } },
    } as never);
}

const adminProcedures: Record<string, (api: Api) => Promise<unknown>> = {
    'nfcCard.list': (api) => api.nfcCard.list(),
    'nfcCard.tagBaseUrl': (api) => api.nfcCard.tagBaseUrl(),
    'nfcCard.create': (api) => api.nfcCard.create({ label: 'Door', direction: 'IN', chipUid: '04AA' }),
    'nfcCard.update': (api) => api.nfcCard.update({ id: 'c1', label: 'x' }),
    'nfcCard.setActive': (api) => api.nfcCard.setActive({ id: 'c1', active: false }),
    'nfcCard.remove': (api) => api.nfcCard.remove({ id: 'c1' }),
    'deviceRegistration.sendLink': (api) => api.deviceRegistration.sendLink({ employeeId: 'e1' }),
    'deviceRegistration.emailLink': (api) => api.deviceRegistration.emailLink({ employeeId: 'e1', token: 't1' }),
    'deviceRegistration.listDevices': (api) => api.deviceRegistration.listDevices(),
    'deviceRegistration.revokeDevice': (api) => api.deviceRegistration.revokeDevice({ id: 'd1' }),
    'attendance.facilityStatus': (api) => api.attendance.facilityStatus(),
    'attendance.listPendingApprovals': (api) => api.attendance.listPendingApprovals(),
    'attendance.approveWorkSession': (api) => api.attendance.approveWorkSession({ id: 's1' }),
};

describe('NFC admin procedures: role enforcement', () => {
    // CI sets DISABLE_AUTH=true, which skips requireOrgRole entirely. Force real auth here,
    // otherwise these tests would pass or fail for the wrong reason.
    beforeEach(() => vi.stubEnv('DISABLE_AUTH', 'false'));
    afterEach(() => vi.unstubAllEnvs());

    describe.each(Object.entries(adminProcedures))('%s', (_name, call) => {
        it.each<UserRole>(['WORKER', 'DRIVER'])('is FORBIDDEN for a %s', async (role) => {
            await expect(call(caller(role))).rejects.toMatchObject({ code: 'FORBIDDEN' });
        });

        it('is FORBIDDEN for a caller with no role in any organization', async () => {
            await expect(call(caller(null, null))).rejects.toMatchObject({ code: 'FORBIDDEN' });
        });

        it('is FORBIDDEN for an admin who resolved to no organization', async () => {
            await expect(call(caller('ADMIN', null))).rejects.toMatchObject({ code: 'FORBIDDEN', message: expect.stringContaining('No organization') });
        });

        it.each<UserRole>(['ADMIN', 'OPS_MANAGER'])('lets a %s through the role gate (stopped by the module check)', async (role) => {
            await expect(call(caller(role))).rejects.toMatchObject({ code: 'FORBIDDEN', message: expect.stringContaining('WORKFORCE') });
        });
    });

    it('covers every procedure the NFC routers add for managers', () => {
        // If a manager procedure is added without a role test, this count changes and flags it.
        const managerProcedures = [
            ...Object.keys(appRouter._def.procedures).filter((p) => p.startsWith('nfcCard.')),
            ...['deviceRegistration.sendLink', 'deviceRegistration.emailLink', 'deviceRegistration.listDevices', 'deviceRegistration.revokeDevice'],
            ...['attendance.facilityStatus', 'attendance.listPendingApprovals', 'attendance.approveWorkSession'],
        ];
        expect(managerProcedures.sort()).toEqual(Object.keys(adminProcedures).sort());
    });
});
