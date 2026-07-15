import Stripe from 'stripe';

let _stripe: Stripe | null = null;

/**
 * Lazy singleton — deliberately does NOT read/validate STRIPE_SECRET_KEY at
 * import time. During the free-launch period BILLING_ENABLED=false and
 * STRIPE_SECRET_KEY is unset; the server must still boot cleanly. This only
 * throws when a checkout/portal/webhook call is actually attempted.
 */
export function getStripe(): Stripe {
    if (_stripe) return _stripe;
    const key = process.env['STRIPE_SECRET_KEY'];
    if (!key) throw new Error('STRIPE_SECRET_KEY not configured — set it before enabling BILLING_ENABLED');
    _stripe = new Stripe(key);
    return _stripe;
}

export const PRICE_BY_PLAN: Record<string, string> = {
    STARTER: process.env['STRIPE_PRICE_STARTER'] ?? '',
    PRO: process.env['STRIPE_PRICE_PRO'] ?? '',
    ENTERPRISE: process.env['STRIPE_PRICE_ENTERPRISE'] ?? '',
};
export const PLAN_BY_PRICE: Record<string, 'STARTER' | 'PRO' | 'ENTERPRISE'> = Object.fromEntries(
    Object.entries(PRICE_BY_PLAN)
        .filter(([, id]) => id !== '')
        .map(([p, id]) => [id, p]),
) as never;
