import { randomBytes, randomUUID } from 'node:crypto';
import { prisma } from '@bin-tracker/db';
import { hashToken } from '../lib/token.js';

/**
 * Real-Postgres test lane. These suites exercise what the in-memory fakes
 * cannot: the advisory lock, the one-open-shift unique index, the payroll SQL
 * and RLS. They run ONLY against a throwaway database on this machine (or in
 * CI's Postgres service) and are skipped everywhere else, so they can never
 * touch real data:
 *
 *   - the host must be localhost / 127.0.0.1 / ::1, and
 *   - the database name must end in `_test` or `_ci`.
 *
 * Every suite builds its own organization with unique ids and removes it
 * afterwards, so suites do not interfere and the CI seed data is untouched.
 */
export function dbTestsEnabled(url: string | undefined = process.env['DATABASE_URL']): boolean {
    if (!url) return false;
    try {
        const parsed = new URL(url);
        const database = parsed.pathname.replace(/^\//, '');
        const localHost = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(parsed.hostname);
        return localHost && /_(test|ci)$/.test(database);
    } catch {
        return false;
    }
}

const unique = () => randomUUID().replace(/-/g, '').slice(0, 12);

export async function seedOrg(tag: string, options: { workforce?: boolean; attendanceMethod?: 'NFC' | 'QR' } = {}) {
    const id = unique();
    const org = await prisma.organization.create({ data: { name: `NFC test ${tag}`, slug: `nfc-test-${tag}-${id}` } });
    await prisma.organizationModule.createMany({
        data: [
            { orgId: org.id, module: 'WORKFORCE', enabled: options.workforce ?? true },
            { orgId: org.id, module: 'PAYROLL', enabled: true },
        ],
    });
    await prisma.settings.create({
        data: { organizationId: org.id, flatHourlyRateCents: 2000, companyTimezone: 'America/Toronto', ...(options.attendanceMethod ? { attendanceMethod: options.attendanceMethod } : {}) },
    });
    return org;
}

export async function seedEmployee(orgId: string, overrides: { status?: 'ACTIVE' | 'INACTIVE'; hourlyRateCents?: number | null } = {}) {
    const id = unique();
    return prisma.employee.create({
        data: {
            organizationId: orgId,
            employeeCode: `T-${id}`,
            fullName: `Test ${id}`,
            qrCode: `ATT-${randomUUID()}`,
            status: overrides.status ?? 'ACTIVE',
            hourlyRateCents: overrides.hourlyRateCents ?? null,
        },
    });
}

export async function seedCard(orgId: string, direction: 'IN' | 'OUT' | 'BOTH', overrides: { active?: boolean } = {}) {
    return prisma.nfcCard.create({
        data: { organizationId: orgId, label: `Door ${direction}`, direction, chipUid: `04${unique()}`, active: overrides.active ?? true },
    });
}

/** A registered phone: the raw cookie value plus its hashed DeviceSession row. */
export async function seedDevice(orgId: string, employeeId: string, overrides: { revoked?: boolean } = {}) {
    const token = randomBytes(32).toString('base64url');
    const session = await prisma.deviceSession.create({
        data: {
            organizationId: orgId,
            employeeId,
            sessionTokenHash: hashToken(token),
            deviceLabel: 'Test phone',
            revokedAt: overrides.revoked ? new Date() : null,
        },
    });
    return { token, session };
}

/** Bulk version for the rush tests: one INSERT per table instead of 300. */
export async function seedCrowd(orgId: string, size: number) {
    const rows = Array.from({ length: size }, () => ({ id: unique(), token: randomBytes(32).toString('base64url') }));
    await prisma.employee.createMany({
        data: rows.map((r) => ({ id: `emp-${r.id}`, organizationId: orgId, employeeCode: `C-${r.id}`, fullName: `Crowd ${r.id}`, qrCode: `ATT-${randomUUID()}` })),
    });
    await prisma.deviceSession.createMany({
        data: rows.map((r) => ({ organizationId: orgId, employeeId: `emp-${r.id}`, sessionTokenHash: hashToken(r.token) })),
    });
    return rows.map((r) => ({ employeeId: `emp-${r.id}`, token: r.token }));
}

/** Removes everything a suite created for one organization, children first. */
export async function cleanupOrg(orgId: string): Promise<void> {
    const byEmployeeOrg = { employee: { organizationId: orgId } };
    await prisma.payrollException.deleteMany({ where: { run: { organizationId: orgId } } });
    await prisma.payrollLineItem.deleteMany({ where: { run: { organizationId: orgId } } });
    await prisma.payrollRun.deleteMany({ where: { organizationId: orgId } });
    await prisma.attendanceEvent.deleteMany({ where: byEmployeeOrg });
    await prisma.workSession.deleteMany({ where: byEmployeeOrg });
    await prisma.deviceSession.deleteMany({ where: { organizationId: orgId } });
    await prisma.registrationToken.deleteMany({ where: { organizationId: orgId } });
    await prisma.nfcCard.deleteMany({ where: { organizationId: orgId } });
    await prisma.payrollAuditLog.deleteMany({ where: { orgId } });
    await prisma.employee.deleteMany({ where: { organizationId: orgId } });
    await prisma.settings.deleteMany({ where: { organizationId: orgId } });
    await prisma.organizationModule.deleteMany({ where: { orgId } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
}
