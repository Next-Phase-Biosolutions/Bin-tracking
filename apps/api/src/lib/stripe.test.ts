import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// PRICE_BY_PLAN/PLAN_BY_PRICE are built once at module load from env vars, so
// each case needs a fresh module instance (vi.resetModules + dynamic import)
// with its own env vars set beforehand.
const ENV_KEYS = ['STRIPE_PRICE_STARTER', 'STRIPE_PRICE_PRO', 'STRIPE_PRICE_ENTERPRISE'] as const;
const originalEnv: Record<string, string | undefined> = {};

beforeEach(() => {
    for (const key of ENV_KEYS) originalEnv[key] = process.env[key];
});

afterEach(() => {
    for (const key of ENV_KEYS) {
        if (originalEnv[key] === undefined) delete process.env[key];
        else process.env[key] = originalEnv[key];
    }
});

describe('PLAN_BY_PRICE', () => {
    it('maps configured price ids back to their plan', async () => {
        process.env['STRIPE_PRICE_STARTER'] = 'price_starter';
        process.env['STRIPE_PRICE_PRO'] = 'price_pro';
        process.env['STRIPE_PRICE_ENTERPRISE'] = 'price_enterprise';

        const modulePath = './stripe.js' + '?case=configured';
        const { PLAN_BY_PRICE } = await import(modulePath);

        expect(PLAN_BY_PRICE).toEqual({
            price_starter: 'STARTER',
            price_pro: 'PRO',
            price_enterprise: 'ENTERPRISE',
        });
    });

    it('does NOT map an empty price id to ENTERPRISE when env vars are unset (regression: fail-open bug)', async () => {
        delete process.env['STRIPE_PRICE_STARTER'];
        delete process.env['STRIPE_PRICE_PRO'];
        delete process.env['STRIPE_PRICE_ENTERPRISE'];

        const modulePath = './stripe.js' + '?case=unset';
        const { PLAN_BY_PRICE } = await import(modulePath);

        expect(PLAN_BY_PRICE['']).toBeUndefined();
        expect(Object.keys(PLAN_BY_PRICE)).toHaveLength(0);
    });
});
