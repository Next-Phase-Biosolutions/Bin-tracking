-- Stripe webhook ordering guard: records `event.created` of the last webhook
-- applied to each subscription so a retried, older event can never overwrite
-- newer state (see apps/api/src/services/billing.service.ts).
ALTER TABLE "subscriptions" ADD COLUMN "lastStripeEventAt" TIMESTAMP(3);
