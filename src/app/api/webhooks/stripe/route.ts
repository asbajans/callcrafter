import { NextRequest, NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '../../../../../payload.config';
import { StripeService } from '@/billing/StripeService';
import { billingLogger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      billingLogger.warn('Missing Stripe signature');
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!stripeSecretKey || !webhookSecret) {
      billingLogger.error('Stripe configuration missing');
      return NextResponse.json({ error: 'Configuration error' }, { status: 500 });
    }

    const stripeService = new StripeService(stripeSecretKey);
    const event = stripeService.handleWebhook(rawBody, signature, webhookSecret);

    billingLogger.info('Stripe webhook received', { type: (await event).type });

    const payload = await getPayload({ config });
    const eventData = (await event).data;

    switch ((await event).type) {
      case 'checkout.session.completed': {
        const session = eventData as any;
        const tenantId = session.metadata?.tenantId;
        const planId = session.metadata?.planId;

        if (tenantId && planId) {
          const existing = await payload.find({
            collection: 'subscriptions',
            where: { tenant: { equals: tenantId } },
          });

          if (existing.docs.length > 0) {
            await payload.update({
              collection: 'subscriptions',
              id: existing.docs[0].id,
              data: {
                stripeSubscriptionId: session.subscription,
                stripeCustomerId: session.customer,
                status: 'active',
                plan: planId,
                currentPeriodStart: new Date().toISOString(),
              },
            });
          } else {
            await payload.create({
              collection: 'subscriptions',
              data: {
                tenant: tenantId,
                plan: planId,
                stripeSubscriptionId: session.subscription,
                stripeCustomerId: session.customer,
                status: 'active',
                currentPeriodStart: new Date().toISOString(),
              },
            });
          }

          await payload.update({
            collection: 'tenants',
            id: tenantId,
            data: { status: 'active' },
          });

          billingLogger.info('Subscription activated for tenant', { tenantId, planId });
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = eventData as any;
        const tenantResult = await payload.find({
          collection: 'subscriptions',
          where: { stripeSubscriptionId: { equals: subscription.id } },
        });

        if (tenantResult.docs.length > 0) {
          const sub = tenantResult.docs[0];

          let subStatus: string;
          let tenantStatus: string;

          if (subscription.status === 'active' || subscription.status === 'trialing') {
            subStatus = 'active';
            tenantStatus = 'active';
          } else if (subscription.status === 'past_due') {
            subStatus = 'past_due';
            tenantStatus = 'suspended';
          } else {
            subStatus = 'cancelled';
            tenantStatus = 'inactive';
          }

          await payload.update({
            collection: 'subscriptions',
            id: sub.id,
            data: {
              status: subStatus as 'active' | 'cancelled' | 'past_due',
              currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
              currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
            },
          });

          const tenantId = typeof sub.tenant === 'object' ? sub.tenant.id : sub.tenant;
          await payload.update({
            collection: 'tenants',
            id: tenantId,
            data: { status: tenantStatus as 'active' | 'suspended' | 'inactive' },
          });
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const deletedSub = eventData as any;
        const tenantResult = await payload.find({
          collection: 'subscriptions',
          where: { stripeSubscriptionId: { equals: deletedSub.id } },
        });

        if (tenantResult.docs.length > 0) {
          const sub = tenantResult.docs[0];
          await payload.update({
            collection: 'subscriptions',
            id: sub.id,
            data: { status: 'cancelled', cancelledAt: new Date().toISOString() },
          });

          const tenantId = typeof sub.tenant === 'object' ? sub.tenant.id : sub.tenant;
          await payload.update({
            collection: 'tenants',
            id: tenantId,
            data: { status: 'inactive' },
          });

          billingLogger.info('Subscription cancelled for tenant', { tenantId });
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = eventData as any;
        billingLogger.info('Payment succeeded', {
          customer: invoice.customer,
          amount: invoice.amount_paid,
          currency: invoice.currency,
        });
        break;
      }

      case 'invoice.payment_failed': {
        const failedInvoice = eventData as any;
        billingLogger.warn('Payment failed', {
          customer: failedInvoice.customer,
          amount: failedInvoice.amount_due,
        });

        const subscriptionResult = await payload.find({
          collection: 'subscriptions',
          where: { stripeSubscriptionId: { equals: failedInvoice.subscription } },
        });

        if (subscriptionResult.docs.length > 0) {
          const sub = subscriptionResult.docs[0];
          const tenantId = typeof sub.tenant === 'object' ? sub.tenant.id : sub.tenant;
          await payload.update({
            collection: 'tenants',
            id: tenantId,
            data: { status: 'suspended' },
          });
        }
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    billingLogger.error('Stripe webhook processing failed', error instanceof Error ? error : undefined, { error: message });
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}