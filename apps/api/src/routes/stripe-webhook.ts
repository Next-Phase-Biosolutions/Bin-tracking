import type { FastifyInstance } from 'fastify';
import { getStripe } from '../lib/stripe.js';
import { billingService } from '../services/billing.service.js';

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
            switch (event.type) {
                case 'checkout.session.completed':
                case 'customer.subscription.created':
                case 'customer.subscription.updated':
                case 'customer.subscription.deleted':
                    await billingService.handleStripeEvent(event);
                    break;
                default:
                    break; // ignore unhandled events
            }
            return reply.status(200).send({ received: true });
        },
    });
}
