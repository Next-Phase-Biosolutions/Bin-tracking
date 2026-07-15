import type { FastifyInstance } from 'fastify';
import { getStripe } from '../lib/stripe.js';
import { billingService, PermanentStripeError } from '../services/billing.service.js';
import { captureError } from '../lib/sentry.js';

export async function registerStripeWebhook(server: FastifyInstance): Promise<void> {
    server.route({
        method: 'POST',
        url: '/webhooks/stripe',
        config: { rawBody: true },
        handler: async (req, reply) => {
            const sig = req.headers['stripe-signature'];
            const secret = process.env['STRIPE_WEBHOOK_SECRET'];
            if (!sig || !secret) return reply.status(400).send();
            let event;
            try {
                event = getStripe().webhooks.constructEvent(req.rawBody as string, sig, secret);
            } catch {
                return reply.status(400).send({ error: 'invalid signature' });
            }

            // A test-mode event reaching a production deployment (or vice versa)
            // means a mis-pointed webhook endpoint in the Stripe dashboard —
            // never apply it. Ack with 200 so Stripe doesn't retry forever.
            const isProduction = process.env['NODE_ENV'] === 'production';
            if (Boolean(event.livemode) !== isProduction) {
                req.log.warn({ eventId: event.id, livemode: event.livemode }, 'stripe webhook: livemode/environment mismatch — ignored');
                return reply.status(200).send({ received: true, ignored: 'livemode mismatch' });
            }

            switch (event.type) {
                case 'checkout.session.completed':
                case 'customer.subscription.created':
                case 'customer.subscription.updated':
                case 'customer.subscription.deleted':
                    try {
                        await billingService.handleStripeEvent(event);
                    } catch (err) {
                        if (err instanceof PermanentStripeError) {
                            // Retrying can never fix these (unknown price ID, missing
                            // orgId metadata) — a 500 would make Stripe retry for days
                            // and eventually disable the endpoint. Log + report + ack.
                            req.log.error({ eventId: event.id, err }, 'stripe webhook: permanent error — acked without processing');
                            captureError(err, null);
                            return reply.status(200).send({ received: true, ignored: 'permanent error' });
                        }
                        throw err; // transient (DB/Stripe hiccup) → 500 → Stripe retries
                    }
                    break;
                default:
                    break; // ignore unhandled events
            }
            return reply.status(200).send({ received: true });
        },
    });
}
