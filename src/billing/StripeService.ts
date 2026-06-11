import Stripe from 'stripe';

interface CheckoutSessionParams {
  customerId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}

interface WebhookResult {
  type: string;
  data: any;
}

export class StripeService {
  private stripe: Stripe;

  constructor(apiKey: string) {
    this.stripe = new Stripe(apiKey, {
      apiVersion: '2025-02-24.acacia',
    });
  }

  async createCustomer(
    email: string,
    name: string,
    metadata?: Record<string, string>
  ): Promise<Stripe.Customer> {
    return this.stripe.customers.create({
      email,
      name,
      metadata,
    });
  }

  async createProduct(
    name: string,
    description: string,
    amount: number,
    interval?: 'month' | 'year'
  ): Promise<{ product: Stripe.Product; price: Stripe.Price }> {
    const product = await this.stripe.products.create({
      name,
      description,
    });

    const price = await this.stripe.prices.create({
      product: product.id,
      unit_amount: Math.round(amount * 100),
      currency: 'usd',
      recurring: interval ? { interval } : undefined,
    });

    return { product, price };
  }

  async createCheckoutSession(
    params: CheckoutSessionParams
  ): Promise<Stripe.Checkout.Session> {
    return this.stripe.checkout.sessions.create({
      customer: params.customerId,
      line_items: [
        {
          price: params.priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: params.metadata,
    });
  }

  async createPortalSession(
    customerId: string,
    returnUrl: string
  ): Promise<Stripe.BillingPortal.Session> {
    return this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
  }

  async handleWebhook(
    rawBody: string,
    signature: string,
    webhookSecret: string
  ): Promise<WebhookResult> {
    const event = this.stripe.webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecret
    );

    return {
      type: event.type,
      data: event.data.object,
    };
  }

  async cancelSubscription(
    subscriptionId: string
  ): Promise<Stripe.Subscription> {
    return this.stripe.subscriptions.cancel(subscriptionId);
  }

  async getSubscription(
    subscriptionId: string
  ): Promise<Stripe.Subscription> {
    return this.stripe.subscriptions.retrieve(subscriptionId);
  }

  async listInvoices(customerId: string): Promise<Stripe.Invoice[]> {
    const invoices = await this.stripe.invoices.list({
      customer: customerId,
      limit: 100,
    });
    return invoices.data;
  }

  async createPaymentIntent(
    amount: number,
    currency: string,
    customerId: string
  ): Promise<Stripe.PaymentIntent> {
    return this.stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency,
      customer: customerId,
    });
  }
}
