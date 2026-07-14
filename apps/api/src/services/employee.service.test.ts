import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── In-memory Prisma fake ────────────────────────────────────
// Mirrors only the employee.findMany/findUnique queries employee.service.ts
// actually uses.
//
// Regression focus: before this batch, list() had no organizationId filter
// at all and getById() didn't check organizationId on the fetched row — an
// authenticated user from any org could list or fetch another org's
// employees by ID.

interface FakeEmployee {
    id: string;
    organizationId: string;
    employeeCode: string;
    fullName: string;
    status: 'ACTIVE' | 'INACTIVE';
    createdAt: Date;
}

const store = vi.hoisted(() => {
    return { employees: [] as FakeEmployee[] };
});

vi.mock('@bin-tracker/db', () => {
    const employee = {
        findMany: ({ where }: { where: { organizationId: string; status?: string } }) =>
            Promise.resolve(
                store.employees
                    .filter((e) => e.organizationId === where.organizationId && (!where.status || e.status === where.status))
                    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
            ),
        findUnique: ({ where }: { where: { id: string } }) =>
            Promise.resolve(store.employees.find((e) => e.id === where.id) ?? null),
    };

    return { prisma: { employee } };
});

const { employeeService } = await import('./employee.service.js');

function makeEmployee(overrides: Partial<FakeEmployee>): FakeEmployee {
    return {
        id: overrides.id ?? 'emp-1',
        organizationId: overrides.organizationId ?? 'org-a',
        employeeCode: overrides.employeeCode ?? 'EMP-1',
        fullName: overrides.fullName ?? 'Jane Doe',
        status: overrides.status ?? 'ACTIVE',
        createdAt: overrides.createdAt ?? new Date('2026-07-01T00:00:00.000Z'),
        ...overrides,
    };
}

beforeEach(() => {
    store.employees = [];
});

describe('employeeService.list', () => {
    it('only returns employees belonging to the requesting org', async () => {
        store.employees.push(
            makeEmployee({ id: 'emp-a', organizationId: 'org-a' }),
            makeEmployee({ id: 'emp-b', organizationId: 'org-b' }),
        );

        const result = await employeeService.list('org-a', {});

        expect(result.map((e) => e.id)).toEqual(['emp-a']);
    });
});

describe('employeeService.getById', () => {
    it('rejects with NOT_FOUND (not FORBIDDEN) for an employee in another org', async () => {
        store.employees.push(makeEmployee({ id: 'emp-b', organizationId: 'org-b' }));

        await expect(employeeService.getById('org-a', 'emp-b')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('returns the employee when it belongs to the requesting org', async () => {
        store.employees.push(makeEmployee({ id: 'emp-a', organizationId: 'org-a' }));

        const result = await employeeService.getById('org-a', 'emp-a');

        expect(result.id).toBe('emp-a');
    });
});
