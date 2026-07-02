import { NextRequest, NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '../../../../../payload.config';
import { StripeService } from '@/billing/StripeService';
import { CreditService } from '@/billing/CreditService';
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
        const purchaseType = session.metadata?.type;
        const credits = session.metadata?.credits;
        const creditPackageId = session.metadata?.creditPackageId;

        // Credit package purchase (one-time payment)
        if (purchaseType === 'credit_purchase' && tenantId && credits) {
          const creditService = new CreditService();
          const creditAmount = parseInt(credits);
          await creditService.addCredits(tenantId, creditAmount, 'stripe', {
            description: `Stripe purchase - ${creditAmount} credits`,
            expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
            stripePaymentIntentId: session.payment_intent,
            creditPackageId: creditPackageId,
          });

          // Log payment in payments collection
          await payload.create({
            collection: 'payments',
            data: {
              tenant: tenantId,
              amount: session.amount_total ? session.amount_total / 100 : 0,
              currency: session.currency || 'usd',
              status: 'succeeded',
              stripePaymentIntentId: session.payment_intent,
              description: `Credit purchase - ${creditAmount} credits`,
              metadata: { type: 'credit_purchase', credits: creditAmount, creditPackageId },
            },
          });

          billingLogger.info('Credit purchase completed', { tenantId, credits: creditAmount });
          break;
        }

        // Subscription plan checkout
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

          // Sync plan limits to tenant-credits monthlyLimit
          try {
            const plan = await payload.findByID({ collection: 'pricing-plans', id: planId });
            if (plan) {
              const planData = plan as any;
              const limits = planData.limits;
              if (limits?.monthlyAiCredits > 0) {
                const creditsRecord = await payload.find({
                  collection: 'tenant-credits' as any,
                  where: { tenant: { equals: tenantId } },
                  limit: 1,
                });
                if (creditsRecord.docs[0]) {
                  await payload.update({
                    collection: 'tenant-credits' as any,
                    id: creditsRecord.docs[0].id,
                    data: { monthlyLimit: limits.monthlyAiCredits },
                  });
                }
              }
            }
          } catch (e) {
            billingLogger.error('Failed to sync plan limits', e instanceof Error ? e : undefined);
          }

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

          // Sync plan limits when subscription is updated (e.g. plan change)
          if (subscription.status === 'active' || subscription.status === 'trialing') {
            try {
              const subData = sub as any;
              if (subData.plan) {
                const planId = typeof subData.plan === 'object' ? subData.plan.id : subData.plan;
                const plan = await payload.findByID({ collection: 'pricing-plans', id: planId });
                if (plan) {
                  const limits = (plan as any).limits;
                  if (limits?.monthlyAiCredits > 0) {
                    const creditsRecord = await payload.find({
                      collection: 'tenant-credits' as any,
                      where: { tenant: { equals: tenantId } },
                      limit: 1,
                    });
                    if (creditsRecord.docs[0]) {
                      await payload.update({
                        collection: 'tenant-credits' as any,
                        id: creditsRecord.docs[0].id,
                        data: { monthlyLimit: limits.monthlyAiCredits },
                      });
                    }
                  }
                }
              }
            } catch (e) {
              billingLogger.error('Failed to sync plan limits on update', e instanceof Error ? e : undefined);
            }
          }
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