import { beforeEach, describe, expect, it, vi } from 'vitest';

// Task 25 point 2: the org founder's OrganizationMember row must get
// role: 'ADMIN' — the ONLY place a membership should ever get ADMIN without
// going through an explicit invitation. This is the real `provisionOrganization`
// implementation (re-exported from @bin-tracker/db, unmocked here — only
// @bin-tracker/db's underlying reconcileModulesForPlan-facing calls are
// stubbed via a fake PrismaClient/TransactionClient), NOT a mock, so this
// test would fail if `role: 'ADMIN'` were ever dropped from org-provision.ts.

interface FakeMember {
    orgId: string;
    userId: string;
    role: string;
}

const store = vi.hoisted(() => ({
    members: [] as FakeMember[],
    organizationModules: [] as { orgId: string; module: string; enabled: boolean; source: string }[],
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeFakePrisma(): any {
    const organizationModule = {
        upsert: ({ create }: { create: { orgId: string; module: string; enabled: boolean; source: string } }) => {
            store.organizationModules.push(create);
            return Promise.resolve(create);
        },
        updateMany: () => Promise.resolve({ count: 0 }),
    };

    const organizationMember = {
        create: ({ data }: { data: FakeMember }) => {
            store.members.push(data);
            return Promise.resolve(data);
        },
    };

    const fakePrisma = {
        organization: { create: ({ data }: { data: { name: string; slug: string } }) => Promise.resolve({ id: 'org-new', ...data }) },
        organizationMember,
        binType: { createMany: () => Promise.resolve({ count: 0 }) },
        settings: { create: () => Promise.resolve({}) },
        subscription: { create: () => Promise.resolve({}) },
        organizationModule,
        $transaction: (fn: (tx: unknown) => Promise<unknown>) => fn(fakePrisma),
    };
    return fakePrisma;
}

const { provisionOrganization } = await import('@bin-tracker/db');

beforeEach(() => {
    store.members = [];
    store.organizationModules = [];
    delete process.env['BILLING_ENABLED'];
});

describe('provisionOrganization — founder membership role', () => {
    it("creates the owner's OrganizationMember row with role: 'ADMIN'", async () => {
        const prisma = makeFakePrisma();

        const { orgId } = await provisionOrganization(prisma, {
            name: 'Acme Inc',
            slug: 'acme-inc',
            ownerUserId: 'user-1',
        });

        expect(orgId).toBe('org-new');
        expect(store.members).toHaveLength(1);
        expect(store.members[0]).toEqual({ orgId: 'org-new', userId: 'user-1', role: 'ADMIN' });
    });
});
