/**
 * defaultPlanForNewOrg is re-exported from @bin-tracker/db, where it has to
 * live so provisionOrganization() (packages/db/src/org-provision.ts) can
 * call it inside its own transaction without a reverse dependency on
 * apps/api — see org-provision.service.ts for the full layering rationale.
 *
 * This file adds the rest of the Stripe billing logic (checkout sessions,
 * customer portal, webhook subscription sync), which belongs here since it
 * needs apps/api's Stripe client.
 */
import { TRPCError } from '@trpc/server';
import type Stripe from 'stripe';
import { prisma } from '@bin-tracker/db';
import { isSubscriptionUsable, type Plan, type SubscriptionStatus } from '@bin-tracker/types';
import { getStripe, PRICE_BY_PLAN, PLAN_BY_PRICE } from '../lib/stripe.js';
import { reconcileModulesForPlan } from './module.service.js';

export { defaultPlanForNewOrg } from '@bin-tracker/db';

function isBillingEnabled(): boolean {
    return process.env['BILLING_ENABLED'] === 'true';
}

function requireBillingEnabled(): void {
    if (!isBillingEnabled()) {
        throw new TRPCError({ code: 'NOT_IMPLEMENTED', message: 'Billing is not yet enabled' });
    }
}

/** Conservative: any status not explicitly usable maps to CANCELED (fail-closed). */
function mapStripeStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
    if (status === 'trialing') return 'TRIALING';
    if (status === 'active') return 'ACTIVE';
    if (status === 'past_due') return 'PAST_DUE';
    return 'CANCELED'; // canceled, unpaid, incomplete, incomplete_expired, paused
}

function customerIdOf(customer: Stripe.Subscription['customer']): string {
    return typeof customer === 'string' ? customer : customer.id;
}

/**
 * Pure(ish) mapping from a Stripe Subscription object to our local Subscription
 * row, then reconciles the org's module bundle to match the new plan. The
 * webhook only ever trusts `items.data[0].price.id` and `status` off the
 * Stripe object itself — never client input.
 */
export async function syncSubscriptionFromStripe(orgId: string, stripeSub: Stripe.Subscription): Promise<void> {
    const item = stripeSub.items.data[0];
    const priceId = item?.price.id ?? '';
    const plan = PLAN_BY_PRICE[priceId];
    if (!plan) {
        throw new Error(`Stripe subscription ${stripeSub.id} has unrecognized price ${priceId}`);
    }
    const status = mapStripeStatus(stripeSub.status);
    const currentPeriodEnd = item ? new Date(item.current_period_end * 1000) : null;
    const stripeCustomerId = customerIdOf(stripeSub.customer);

    await prisma.subscription.upsert({
        where: { orgId },
        update: { plan, status, currentPeriodEnd, stripeCustomerId, stripeSubscriptionId: stripeSub.id },
        create: { orgId, plan, status, currentPeriodEnd, stripeCustomerId, stripeSubscriptionId: stripeSub.id },
    });

    if (isSubscriptionUsable(status)) {
        await reconcileModulesForPlan(prisma, orgId, plan);
    } else {
        // Subscription is PAST_DUE/CANCELED: `plan` here is still whatever
        // price was last on the Stripe object, so it must NOT be used to
        // re-grant a module bundle. Disable every plan-sourced module;
        // manual overrides (source: 'manual') are untouched.
        await prisma.organizationModule.updateMany({
            where: { orgId, source: 'plan' },
            data: { enabled: false },
        });
    }
}

/**
 * Dispatches a verified Stripe event to the sync logic.
 *
 * checkout.session.completed carries a Session, whose `subscription` field is
 * only an ID string — the full Subscription object must be retrieved before
 * syncing. customer.subscription.* events already carry the Subscription
 * object on event.data.object.
 */
export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
        case 'checkout.session.completed': {
            const session = event.data.object;
            if (!session.subscription) return; // e.g. one-time payment mode, not applicable here
            const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
            const stripeSub = await getStripe().subscriptions.retrieve(subscriptionId);
            await syncFromSubscriptionMetadata(stripeSub);
            break;
        }
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted': {
            await syncFromSubscriptionMetadata(event.data.object);
            break;
        }
        default:
            break; // ignore unhandled events
    }
}

async function syncFromSubscriptionMetadata(stripeSub: Stripe.Subscription): Promise<void> {
    const orgId = stripeSub.metadata['orgId'];
    if (!orgId) {
        throw new Error(`Stripe subscription ${stripeSub.id} is missing orgId metadata`);
    }
    await syncSubscriptionFromStripe(orgId, stripeSub);
}

export async function createCheckoutSession(orgId: string, plan: Plan): Promise<{ url: string }> {
    requireBillingEnabled();
    const priceId = PRICE_BY_PLAN[plan];
    if (!priceId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: `No Stripe price configured for plan ${plan}` });
    }

    const subscription = await prisma.subscription.findUnique({ where: { orgId } });
    const appUrl = process.env['APP_URL'] ?? 'http://localhost:3000';

    const session = await getStripe().checkout.sessions.create({
        mode: 'subscription',
        customer: subscription?.stripeCustomerId ?? undefined,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${appUrl}/settings/billing?checkout=success`,
        cancel_url: `${appUrl}/settings/billing?checkout=cancelled`,
        metadata: { orgId },
        subscription_data: { metadata: { orgId } },
    });

    if (!session.url) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Stripe did not return a checkout URL' });
    }
    return { url: session.url };
}

/**
 * Called right after provisionOrganization() during self-serve signup when
 * BILLING_ENABLED=true (auth.router.ts's createOrganization, Task 18).
 * Creates a real Stripe customer + subscription with a 14-day trial, then
 * syncs it into the local Subscription row via the same syncSubscriptionFromStripe
 * path Stripe webhooks use — so the org has real stripeCustomerId/
 * stripeSubscriptionId immediately instead of waiting on the first webhook
 * delivery. Not reachable in any current deployment (BILLING_ENABLED
 * defaults to false); correctness is verified via mocked Stripe in tests.
 */
export async function createTrialSubscription(orgId: string, ownerEmail: string): Promise<void> {
    requireBillingEnabled();
    const priceId = PRICE_BY_PLAN['STARTER'];
    if (!priceId) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'No Stripe price configured for the STARTER plan' });
    }

    const stripe = getStripe();
    const customer = await stripe.customers.create({ email: ownerEmail, metadata: { orgId } });
    const trialSubscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: priceId }],
        trial_period_days: 14,
        metadata: { orgId },
    });

    await syncSubscriptionFromStripe(orgId, trialSubscription);
}

export async function createPortalSession(orgId: string): Promise<{ url: string }> {
    requireBillingEnabled();
    const subscription = await prisma.subscription.findUnique({ where: { orgId } });
    if (!subscription?.stripeCustomerId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No Stripe customer on file for this organization' });
    }
    const appUrl = process.env['APP_URL'] ?? 'http://localhost:3000';

    const session = await getStripe().billingPortal.sessions.create({
        customer: subscription.stripeCustomerId,
        return_url: `${appUrl}/settings/billing`,
    });
    return { url: session.url };
}

export interface CurrentSubscriptionView {
    plan: Plan;
    status: SubscriptionStatus;
    currentPeriodEnd: Date | null;
}

export async function getCurrentSubscription(orgId: string): Promise<CurrentSubscriptionView> {
    const subscription = await prisma.subscription.findUnique({ where: { orgId } });
    if (!subscription) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'No subscription found for this organization' });
    }
    return { plan: subscription.plan, status: subscription.status, currentPeriodEnd: subscription.currentPeriodEnd };
}

export const billingService = {
    syncSubscriptionFromStripe,
    handleStripeEvent,
    createCheckoutSession,
    createPortalSession,
    createTrialSubscription,
    getCurrentSubscription,
};
