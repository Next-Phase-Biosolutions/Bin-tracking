import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Fake prisma + reconcileModulesForPlan (mocked at the @bin-tracker/db
// boundary — module.service.ts re-exports reconcileModulesForPlan from here,
// so this one mock covers both import paths) ──────────────────────────
const upsertCalls: unknown[] = [];
const reconcileCalls: Array<{ orgId: string; plan: string }> = [];
const moduleUpdateManyCalls: unknown[] = [];

const fakeSubscription = { stripeCustomerId: 'cus_existing' as string | null };

vi.mock('@bin-tracker/db', () => ({
    prisma: {
        subscription: {
            upsert: vi.fn().mockImplementation((args: unknown) => {
                upsertCalls.push(args);
                return Promise.resolve({});
            }),
            findUnique: vi.fn().mockImplementation(() => Promise.resolve(fakeSubscription)),
        },
        organizationModule: {
            updateMany: vi.fn().mockImplementation((args: unknown) => {
                moduleUpdateManyCalls.push(args);
                return Promise.resolve({ count: 0 });
            }),
        },
    },
    reconcileModulesForPlan: vi.fn().mockImplementation((_prisma: unknown, orgId: string, plan: string) => {
        reconcileCalls.push({ orgId, plan });
        return Promise.resolve();
    }),
}));

// ─── Fake Stripe client — deterministic price<->plan map, no network ──
const { retrieveSubscriptionMock, checkoutCreateMock, portalCreateMock, customersCreateMock, subscriptionsCreateMock } = vi.hoisted(() => ({
    retrieveSubscriptionMock: vi.fn(),
    checkoutCreateMock: vi.fn(),
    portalCreateMock: vi.fn(),
    customersCreateMock: vi.fn(),
    subscriptionsCreateMock: vi.fn(),
}));

vi.mock('../lib/stripe.js', () => ({
    getStripe: vi.fn().mockReturnValue({
        subscriptions: { retrieve: retrieveSubscriptionMock, create: subscriptionsCreateMock },
        customers: { create: customersCreateMock },
        checkout: { sessions: { create: checkoutCreateMock } },
        billingPortal: { sessions: { create: portalCreateMock } },
    }),
    PRICE_BY_PLAN: { STARTER: 'price_starter', PRO: 'price_pro', ENTERPRISE: 'price_enterprise' },
    PLAN_BY_PRICE: { price_starter: 'STARTER', price_pro: 'PRO', price_enterprise: 'ENTERPRISE' },
}));

import {
    syncSubscriptionFromStripe,
    handleStripeEvent,
    createCheckoutSession,
    createPortalSession,
    createTrialSubscription,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
} from './billing.service.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fakeStripeSub(overrides: Record<string, any> = {}): any {
    return {
        id: 'sub_1',
        status: 'active',
        customer: 'cus_1',
        metadata: { orgId: 'org_1' },
        items: { data: [{ price: { id: 'price_pro' }, current_period_end: 1_700_000_000 }] },
        ...overrides,
    };
}

beforeEach(() => {
    upsertCalls.length = 0;
    reconcileCalls.length = 0;
    moduleUpdateManyCalls.length = 0;
    retrieveSubscriptionMock.mockReset();
    checkoutCreateMock.mockReset();
    portalCreateMock.mockReset();
    customersCreateMock.mockReset();
    subscriptionsCreateMock.mockReset();
    delete process.env['BILLING_ENABLED'];
});

describe('syncSubscriptionFromStripe', () => {
    it('maps active status + price id to plan, and upserts by orgId', async () => {
        await syncSubscriptionFromStripe('org_1', fakeStripeSub());

        expect(upsertCalls).toHaveLength(1);
        expect(upsertCalls[0]).toMatchObject({
            where: { orgId: 'org_1' },
            update: { plan: 'PRO', status: 'ACTIVE', stripeCustomerId: 'cus_1', stripeSubscriptionId: 'sub_1' },
        });
    });

    it('maps trialing -> TRIALING and past_due -> PAST_DUE', async () => {
        await syncSubscriptionFromStripe('org_1', fakeStripeSub({ status: 'trialing' }));
        expect(upsertCalls[0]).toMatchObject({ update: { status: 'TRIALING' } });

        await syncSubscriptionFromStripe('org_1', fakeStripeSub({ status: 'past_due' }));
        expect(upsertCalls[1]).toMatchObject({ update: { status: 'PAST_DUE' } });
    });

    it('fails closed: unpaid/canceled/incomplete all map to CANCELED', async () => {
        for (const status of ['unpaid', 'canceled', 'incomplete', 'incomplete_expired', 'paused']) {
            await syncSubscriptionFromStripe('org_1', fakeStripeSub({ status }));
        }
        for (const call of upsertCalls) {
            expect(call).toMatchObject({ update: { status: 'CANCELED' } });
        }
    });

    it('calls reconcileModulesForPlan with the mapped plan after upserting', async () => {
        await syncSubscriptionFromStripe('org_1', fakeStripeSub());
        expect(reconcileCalls).toEqual([{ orgId: 'org_1', plan: 'PRO' }]);
    });

    it('throws on an unrecognized price id rather than silently defaulting a plan', async () => {
        await expect(
            syncSubscriptionFromStripe('org_1', fakeStripeSub({ items: { data: [{ price: { id: 'price_unknown' }, current_period_end: 1 }] } })),
        ).rejects.toThrow(/unrecognized price/i);
    });

    it('a canceled subscription disables plan-sourced modules instead of re-granting the stale plan bundle', async () => {
        await syncSubscriptionFromStripe('org_1', fakeStripeSub({ status: 'canceled' }));

        // Must NOT re-grant the (still-present-on-the-Stripe-object) plan bundle.
        expect(reconcileCalls).toEqual([]);
        // Must disable plan-sourced modules, leaving manual overrides alone.
        expect(moduleUpdateManyCalls).toEqual([
            { where: { orgId: 'org_1', source: 'plan' }, data: { enabled: false } },
        ]);
    });

    it('a past_due subscription also disables plan-sourced modules rather than reconciling', async () => {
        await syncSubscriptionFromStripe('org_1', fakeStripeSub({ status: 'past_due' }));

        expect(reconcileCalls).toEqual([]);
        expect(moduleUpdateManyCalls).toEqual([
            { where: { orgId: 'org_1', source: 'plan' }, data: { enabled: false } },
        ]);
    });

    it('an active/trialing subscription still reconciles modules for the plan (unchanged behavior)', async () => {
        await syncSubscriptionFromStripe('org_1', fakeStripeSub({ status: 'active' }));

        expect(moduleUpdateManyCalls).toEqual([]);
        expect(reconcileCalls).toEqual([{ orgId: 'org_1', plan: 'PRO' }]);
    });
});

describe('handleStripeEvent', () => {
    it('customer.subscription.updated syncs directly from event.data.object', async () => {
        await handleStripeEvent({
            type: 'customer.subscription.updated',
            data: { object: fakeStripeSub() },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);

        expect(upsertCalls).toHaveLength(1);
        expect(retrieveSubscriptionMock).not.toHaveBeenCalled();
    });

    it('checkout.session.completed retrieves the full subscription before syncing (session only carries an ID)', async () => {
        retrieveSubscriptionMock.mockResolvedValue(fakeStripeSub());

        await handleStripeEvent({
            type: 'checkout.session.completed',
            data: { object: { subscription: 'sub_1' } },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);

        expect(retrieveSubscriptionMock).toHaveBeenCalledWith('sub_1');
        expect(upsertCalls).toHaveLength(1);
    });

    it('checkout.session.completed with no subscription on the session is a no-op', async () => {
        await handleStripeEvent({
            type: 'checkout.session.completed',
            data: { object: { subscription: null } },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);

        expect(retrieveSubscriptionMock).not.toHaveBeenCalled();
        expect(upsertCalls).toHaveLength(0);
    });

    it('throws when the subscription is missing orgId metadata (never trust client input)', async () => {
        await expect(
            handleStripeEvent({
                type: 'customer.subscription.updated',
                data: { object: fakeStripeSub({ metadata: {} }) },
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any),
        ).rejects.toThrow(/orgId metadata/i);
    });

    it('ignores unhandled event types', async () => {
        await handleStripeEvent({ type: 'invoice.paid', data: { object: {} } } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
        expect(upsertCalls).toHaveLength(0);
    });
});

describe('createCheckoutSession / createPortalSession — BILLING_ENABLED gate', () => {
    it('createCheckoutSession throws NOT_IMPLEMENTED while billing is disabled', async () => {
        await expect(createCheckoutSession('org_1', 'PRO')).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' });
        expect(checkoutCreateMock).not.toHaveBeenCalled();
    });

    it('createPortalSession throws NOT_IMPLEMENTED while billing is disabled', async () => {
        await expect(createPortalSession('org_1')).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' });
        expect(portalCreateMock).not.toHaveBeenCalled();
    });

    it('createCheckoutSession calls Stripe once billing is enabled', async () => {
        process.env['BILLING_ENABLED'] = 'true';
        checkoutCreateMock.mockResolvedValue({ url: 'https://checkout.stripe.com/session_1' });

        const result = await createCheckoutSession('org_1', 'PRO');

        expect(result).toEqual({ url: 'https://checkout.stripe.com/session_1' });
        expect(checkoutCreateMock).toHaveBeenCalledWith(
            expect.objectContaining({
                mode: 'subscription',
                line_items: [{ price: 'price_pro', quantity: 1 }],
                metadata: { orgId: 'org_1' },
            }),
        );
    });
});

describe('createTrialSubscription — self-serve signup trial (Task 18)', () => {
    it('throws NOT_IMPLEMENTED while billing is disabled, without touching Stripe', async () => {
        await expect(createTrialSubscription('org_1', 'owner@example.com')).rejects.toMatchObject({
            code: 'NOT_IMPLEMENTED',
        });
        expect(customersCreateMock).not.toHaveBeenCalled();
        expect(subscriptionsCreateMock).not.toHaveBeenCalled();
    });

    it('creates a Stripe customer + 14-day-trial STARTER subscription, then syncs it locally', async () => {
        process.env['BILLING_ENABLED'] = 'true';
        customersCreateMock.mockResolvedValue({ id: 'cus_new' });
        subscriptionsCreateMock.mockResolvedValue(
            fakeStripeSub({
                id: 'sub_trial',
                status: 'trialing',
                customer: 'cus_new',
                metadata: { orgId: 'org_1' },
                items: { data: [{ price: { id: 'price_starter' }, current_period_end: 1_700_000_000 }] },
            }),
        );

        await createTrialSubscription('org_1', 'owner@example.com');

        expect(customersCreateMock).toHaveBeenCalledWith(
            expect.objectContaining({ email: 'owner@example.com', metadata: { orgId: 'org_1' } }),
        );
        expect(subscriptionsCreateMock).toHaveBeenCalledWith(
            expect.objectContaining({
                customer: 'cus_new',
                items: [{ price: 'price_starter' }],
                trial_period_days: 14,
                metadata: { orgId: 'org_1' },
            }),
        );
        // Reuses syncSubscriptionFromStripe's own upsert path — proves the
        // local Subscription row ends up with the real Stripe ids/status.
        expect(upsertCalls).toHaveLength(1);
        expect(upsertCalls[0]).toMatchObject({
            where: { orgId: 'org_1' },
            update: { plan: 'STARTER', status: 'TRIALING', stripeCustomerId: 'cus_new', stripeSubscriptionId: 'sub_trial' },
        });
    });
});
