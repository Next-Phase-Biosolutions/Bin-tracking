import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyRawBody from 'fastify-raw-body';
import { registerStripeWebhook } from './stripe-webhook.js';

// Signature verification is the security-critical path here (Task 24's
// checklist calls it out explicitly) — we can't reach real Stripe from this
// sandbox, so we drive the actual route through Fastify's .inject() with a
// fake constructEvent that mimics Stripe's real behavior: throws on a bad
// signature, returns the parsed event on a valid one.
const { constructEventMock, handleStripeEventMock } = vi.hoisted(() => ({
    constructEventMock: vi.fn(),
    handleStripeEventMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../lib/stripe.js', () => ({
    getStripe: vi.fn().mockReturnValue({ webhooks: { constructEvent: constructEventMock } }),
}));

vi.mock('../services/billing.service.js', () => ({
    billingService: { handleStripeEvent: handleStripeEventMock },
}));

async function buildTestServer(): Promise<FastifyInstance> {
    const server = Fastify();
    await server.register(fastifyRawBody, { field: 'rawBody', global: false, runFirst: true });
    await registerStripeWebhook(server);
    return server;
}

describe('POST /webhooks/stripe', () => {
    let server: FastifyInstance;

    beforeEach(async () => {
        constructEventMock.mockReset();
        handleStripeEventMock.mockClear();
        process.env['STRIPE_WEBHOOK_SECRET'] = 'whsec_test';
        server = await buildTestServer();
    });

    afterEach(async () => {
        await server.close();
    });

    it('rejects a request with no stripe-signature header', async () => {
        const res = await server.inject({
            method: 'POST',
            url: '/webhooks/stripe',
            payload: '{}',
            headers: { 'content-type': 'application/json' },
        });
        expect(res.statusCode).toBe(400);
        expect(constructEventMock).not.toHaveBeenCalled();
    });

    it('rejects a request when STRIPE_WEBHOOK_SECRET is unset', async () => {
        delete process.env['STRIPE_WEBHOOK_SECRET'];
        const res = await server.inject({
            method: 'POST',
            url: '/webhooks/stripe',
            payload: '{}',
            headers: { 'content-type': 'application/json', 'stripe-signature': 'sig_whatever' },
        });
        expect(res.statusCode).toBe(400);
    });

    it('rejects a bogus signature with 400 and never dispatches the event', async () => {
        constructEventMock.mockImplementation(() => {
            throw new Error('No signatures found matching the expected signature for payload');
        });

        const res = await server.inject({
            method: 'POST',
            url: '/webhooks/stripe',
            payload: '{"type":"customer.subscription.updated"}',
            headers: { 'content-type': 'application/json', 'stripe-signature': 'bogus' },
        });

        expect(res.statusCode).toBe(400);
        expect(handleStripeEventMock).not.toHaveBeenCalled();
    });

    it('accepts a valid signature, dispatches to billingService, and returns 200', async () => {
        const fakeEvent = { type: 'customer.subscription.updated', data: { object: {} } };
        constructEventMock.mockReturnValue(fakeEvent);

        const res = await server.inject({
            method: 'POST',
            url: '/webhooks/stripe',
            payload: '{"type":"customer.subscription.updated"}',
            headers: { 'content-type': 'application/json', 'stripe-signature': 'valid_sig' },
        });

        expect(res.statusCode).toBe(200);
        expect(res.json()).toEqual({ received: true });
        expect(handleStripeEventMock).toHaveBeenCalledWith(fakeEvent);
    });

    it('ignores unhandled event types but still returns 200', async () => {
        constructEventMock.mockReturnValue({ type: 'invoice.paid', data: { object: {} } });

        const res = await server.inject({
            method: 'POST',
            url: '/webhooks/stripe',
            payload: '{"type":"invoice.paid"}',
            headers: { 'content-type': 'application/json', 'stripe-signature': 'valid_sig' },
        });

        expect(res.statusCode).toBe(200);
        expect(handleStripeEventMock).not.toHaveBeenCalled();
    });
});
