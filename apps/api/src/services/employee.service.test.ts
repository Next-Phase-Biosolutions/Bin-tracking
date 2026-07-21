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
    email: string | null;
    status: 'ACTIVE' | 'INACTIVE';
    createdAt: Date;
    bankInstitution?: string | null;
    bankTransit?: string | null;
    bankAccount?: string | null;
    accountHolderName?: string | null;
    accountType?: string | null;
    bankAccountLast4?: string | null;
    bankDetailsAt?: Date | null;
    bankLinkToken?: string | null;
    bankLinkExpiresAt?: Date | null;
}

const store = vi.hoisted(() => {
    return {
        employees: [] as FakeEmployee[],
        subscription: null as { plan: 'STARTER' | 'PRO' | 'ENTERPRISE' } | null,
        organization: { name: 'Acme Farms' } as { name: string } | null,
    };
});

const sentEmails = vi.hoisted(() => [] as Array<{ to: string; url: string; orgName: string }>);

vi.mock('../lib/email.js', () => ({
    sendBankDetailsRequestEmail: (to: string, url: string, orgName: string) => {
        sentEmails.push({ to, url, orgName });
        return Promise.resolve();
    },
}));

vi.mock('@bin-tracker/db', () => {
    const employee = {
        findMany: ({ where }: { where: { organizationId: string; status?: string } }) =>
            Promise.resolve(
                store.employees
                    .filter((e) => e.organizationId === where.organizationId && (!where.status || e.status === where.status))
                    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
            ),
        findUnique: ({ where }: { where: { id?: string; bankLinkToken?: string } }) =>
            Promise.resolve(
                store.employees.find((e) =>
                    where.bankLinkToken !== undefined ? e.bankLinkToken === where.bankLinkToken : e.id === where.id,
                ) ?? null,
            ),
        count: ({ where }: { where: { organizationId: string; status?: string } }) =>
            Promise.resolve(
                store.employees.filter(
                    (e) => e.organizationId === where.organizationId && (!where.status || e.status === where.status),
                ).length,
            ),
        create: ({ data }: { data: Omit<FakeEmployee, 'createdAt'> }) => {
            const created = makeEmployee(data);
            store.employees.push(created);
            return Promise.resolve(created);
        },
        update: ({ where, data }: { where: { id: string }; data: Partial<FakeEmployee> }) => {
            const index = store.employees.findIndex((e) => e.id === where.id);
            if (index === -1) return Promise.reject(new Error('not found'));
            const updated = { ...store.employees[index]!, ...data };
            store.employees[index] = updated;
            return Promise.resolve(updated);
        },
    };
    const subscription = {
        findUnique: () => Promise.resolve(store.subscription),
    };
    const organization = {
        findUnique: () => Promise.resolve(store.organization),
    };

    return { prisma: { employee, subscription, organization } };
});

const { employeeService } = await import('./employee.service.js');
const { resetBankKeyCache } = await import('../lib/bank-crypto.js');

function makeEmployee(overrides: Partial<FakeEmployee>): FakeEmployee {
    return {
        id: overrides.id ?? 'emp-1',
        organizationId: overrides.organizationId ?? 'org-a',
        employeeCode: overrides.employeeCode ?? 'EMP-1',
        fullName: overrides.fullName ?? 'Jane Doe',
        email: overrides.email ?? null,
        status: overrides.status ?? 'ACTIVE',
        createdAt: overrides.createdAt ?? new Date('2026-07-01T00:00:00.000Z'),
        ...overrides,
    };
}

/** Pulls the raw token out of the emailed link — the only place it exists. */
function tokenFromLastEmail(): string {
    const last = sentEmails.at(-1);
    if (!last) throw new Error('no email was sent');
    return last.url.split('/').pop()!;
}

const VALID_DETAILS = {
    bankInstitution: '004',
    bankTransit: '12345',
    bankAccount: '7001234',
    accountHolderName: 'Jane Doe',
    accountType: 'CHEQUING' as const,
    email: 'jane@acme.com',
};

beforeEach(() => {
    store.employees = [];
    store.subscription = null;
    store.organization = { name: 'Acme Farms' };
    sentEmails.length = 0;
    process.env['BANK_DETAILS_KEY'] = 'a'.repeat(64);
});

describe('employeeService.list', () => {
    it('only returns employees belonging to the requesting org', async () => {
        store.employees.push(
            makeEmployee({ id: 'emp-a', organizationId: 'org-a' }),
            makeEmployee({ id: 'emp-b', organizationId: 'org-b' }),
        );

        const result = await employeeService.list('org-a', { limit: 100 });

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

describe('employeeService.register — plan quantity limit', () => {
    it('rejects with FORBIDDEN once the org is at its plan maxEmployees', async () => {
        store.subscription = { plan: 'STARTER' }; // maxEmployees: 25
        for (let i = 0; i < 25; i += 1) {
            store.employees.push(makeEmployee({ id: `emp-${i}`, organizationId: 'org-a' }));
        }

        await expect(
            employeeService.register({ fullName: 'New Hire' }, 'org-a'),
        ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('allows registering under the limit', async () => {
        store.subscription = { plan: 'STARTER' };
        store.employees.push(makeEmployee({ id: 'emp-0', organizationId: 'org-a' }));

        const result = await employeeService.register({ fullName: 'New Hire' }, 'org-a');

        expect(result.organizationId).toBe('org-a');
    });

    it('treats maxEmployees: -1 (ENTERPRISE) as unlimited', async () => {
        store.subscription = { plan: 'ENTERPRISE' };
        for (let i = 0; i < 500; i += 1) {
            store.employees.push(makeEmployee({ id: `emp-${i}`, organizationId: 'org-a' }));
        }

        const result = await employeeService.register({ fullName: 'New Hire' }, 'org-a');

        expect(result.organizationId).toBe('org-a');
    });
});

// ─── Bank details (EFT payout) ────────────────────────────────
// This is money-movement data: the tests below cover the credential lifecycle
// (issue / expire / burn), org isolation, and the guarantee that nothing
// plaintext is ever written to a column.

describe('employeeService.requestBankDetails', () => {
    it('emails a link and stores only the HASHED token', async () => {
        store.employees.push(makeEmployee({ id: 'emp-a', email: 'jane@acme.com' }));

        const result = await employeeService.requestBankDetails('org-a', 'emp-a');

        expect(result.email).toBe('jane@acme.com');
        expect(sentEmails).toHaveLength(1);

        const rawToken = tokenFromLastEmail();
        const stored = store.employees[0]!.bankLinkToken;
        expect(stored).toBeTruthy();
        expect(stored).not.toBe(rawToken); // never the raw value at rest
        expect(stored).toMatch(/^[0-9a-f]{64}$/); // sha256 hex
    });

    it('refuses when the employee has no email, naming them so the admin can fix it', async () => {
        store.employees.push(makeEmployee({ id: 'emp-a', fullName: 'Ali Raza', email: null }));

        await expect(employeeService.requestBankDetails('org-a', 'emp-a')).rejects.toMatchObject({
            code: 'BAD_REQUEST',
            message: expect.stringContaining('Ali Raza'),
        });
        expect(sentEmails).toHaveLength(0);
    });

    it('reports NOT_FOUND for an employee in another org', async () => {
        store.employees.push(makeEmployee({ id: 'emp-b', organizationId: 'org-b', email: 'b@acme.com' }));

        await expect(employeeService.requestBankDetails('org-a', 'emp-b')).rejects.toMatchObject({
            code: 'NOT_FOUND',
        });
        expect(sentEmails).toHaveLength(0);
    });

    it('rotates the token on re-request, killing the previous link', async () => {
        store.employees.push(makeEmployee({ id: 'emp-a', email: 'jane@acme.com' }));

        await employeeService.requestBankDetails('org-a', 'emp-a');
        const firstToken = tokenFromLastEmail();
        await employeeService.requestBankDetails('org-a', 'emp-a');

        expect(tokenFromLastEmail()).not.toBe(firstToken);
        await expect(
            employeeService.submitBankDetails({ token: firstToken, ...VALID_DETAILS }),
        ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
});

describe('employeeService.submitBankDetails', () => {
    async function issueLink(): Promise<string> {
        store.employees.push(makeEmployee({ id: 'emp-a', email: 'jane@acme.com' }));
        await employeeService.requestBankDetails('org-a', 'emp-a');
        return tokenFromLastEmail();
    }

    it('stores every PII field encrypted — never the digits themselves', async () => {
        const token = await issueLink();

        await employeeService.submitBankDetails({ token, ...VALID_DETAILS });

        const saved = store.employees[0]!;
        for (const field of [
            saved.bankInstitution,
            saved.bankTransit,
            saved.bankAccount,
            saved.accountHolderName,
        ]) {
            expect(field).toMatch(/^v1\./);
        }
        expect(saved.bankAccount).not.toContain('7001234');
        expect(saved.bankInstitution).not.toBe('004');
    });

    it('keeps accountType, the last-4 mask and the timestamp readable for the UI', async () => {
        const token = await issueLink();

        await employeeService.submitBankDetails({ token, ...VALID_DETAILS });

        const saved = store.employees[0]!;
        expect(saved.accountType).toBe('CHEQUING');
        expect(saved.bankAccountLast4).toBe('1234');
        expect(saved.bankDetailsAt).toBeInstanceOf(Date);
    });

    it('burns the link — a second submission with the same token fails', async () => {
        const token = await issueLink();

        await employeeService.submitBankDetails({ token, ...VALID_DETAILS });

        expect(store.employees[0]!.bankLinkToken).toBeNull();
        await expect(
            employeeService.submitBankDetails({ token, ...VALID_DETAILS }),
        ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('rejects an expired link', async () => {
        const token = await issueLink();
        store.employees[0]!.bankLinkExpiresAt = new Date(Date.now() - 1000);

        await expect(
            employeeService.submitBankDetails({ token, ...VALID_DETAILS }),
        ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('surfaces a missing BANK_DETAILS_KEY as a config error, not "try again"', async () => {
        // A misconfigured key must NOT be swallowed into the generic failure
        // message: otherwise every employee fails forever and the only clue is
        // an admin wondering why. The message is a static string, so it cannot
        // leak the submitted values.
        const token = await issueLink();
        delete process.env['BANK_DETAILS_KEY'];
        resetBankKeyCache();

        await expect(employeeService.submitBankDetails({ token, ...VALID_DETAILS })).rejects.toThrow(
            /BANK_DETAILS_KEY not configured/,
        );
        // The link survives, so it still works once the key is set.
        expect(store.employees[0]!.bankLinkToken).toBeTruthy();
    });

    it('rejects an unknown token with the same error as an expired one', async () => {
        await issueLink();

        await expect(
            employeeService.submitBankDetails({ token: 'never-issued', ...VALID_DETAILS }),
        ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
});

describe('employeeService.getBankLinkContext', () => {
    it('returns only the employee and org name — no PII the holder lacks', async () => {
        store.employees.push(makeEmployee({ id: 'emp-a', email: 'jane@acme.com' }));
        await employeeService.requestBankDetails('org-a', 'emp-a');

        const context = await employeeService.getBankLinkContext(tokenFromLastEmail());

        expect(context).toEqual({
            employeeFullName: 'Jane Doe',
            organizationName: 'Acme Farms',
            // The address the link was delivered to — prefilled so a typo on a
            // blank field can't overwrite the employer's contact email.
            email: 'jane@acme.com',
        });
    });

    it('rejects a burned link', async () => {
        store.employees.push(makeEmployee({ id: 'emp-a', email: 'jane@acme.com' }));
        await employeeService.requestBankDetails('org-a', 'emp-a');
        const token = tokenFromLastEmail();
        await employeeService.submitBankDetails({ token, ...VALID_DETAILS });

        await expect(employeeService.getBankLinkContext(token)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
});
