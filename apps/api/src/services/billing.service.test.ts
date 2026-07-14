import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Fake prisma + reconcileModulesForPlan (mocked at the @bin-tracker/db
// boundary — module.service.ts re-exports reconcileModulesForPlan from here,
// so this one mock covers both import paths) ──────────────────────────
const upsertCalls: unknown[] = [];
const reconcileCalls: Array<{ orgId: string; plan: string }> = [];

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
    },
    reconcileModulesForPlan: vi.fn().mockImplementation((_prisma: unknown, orgId: string, plan: string) => {
        reconcileCalls.push({ orgId, plan });
        return Promise.resolve();
    }),
}));

// ─── Fake Stripe client — deterministic price<->plan map, no network ──
const { retrieveSubscriptionMock, checkoutCreateMock, portalCreateMock } = vi.hoisted(() => ({
    retrieveSubscriptionMock: vi.fn(),
    checkoutCreateMock: vi.fn(),
    portalCreateMock: vi.fn(),
}));

vi.mock('../lib/stripe.js', () => ({
    getStripe: vi.fn().mockReturnValue({
        subscriptions: { retrieve: retrieveSubscriptionMock },
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
    retrieveSubscriptionMock.mockReset();
    checkoutCreateMock.mockReset();
    portalCreateMock.mockReset();
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
