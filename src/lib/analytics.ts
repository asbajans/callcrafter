export class AnalyticsService {
  private posthog: any;
  private ga4MeasurementId: string;

  constructor() {
    this.ga4MeasurementId = process.env.GA4_MEASUREMENT_ID || '';
    if (typeof window !== 'undefined' && process.env.POSTHOG_KEY) {
      try {
        const posthog = require('posthog-js');
        this.posthog = posthog.init(process.env.POSTHOG_KEY, {
          api_host: process.env.POSTHOG_HOST || 'https://app.posthog.com',
          capture_pageview: false,
          loaded: (ph: any) => {
            if (process.env.NODE_ENV === 'development') ph.debug();
          },
        });
      } catch (error) {
        console.warn('PostHog not available:', error);
      }
    }
  }

  track(event: string, properties?: Record<string, unknown>, userId?: string) {
    const props = {
      ...properties,
      timestamp: new Date().toISOString(),
      app_version: process.env.APP_VERSION || '0.1.0',
    };

    if (this.posthog && userId) {
      try {
        this.posthog.capture(event, props, { distinctId: userId });
      } catch (error) {
        console.warn('PostHog track error:', error);
      }
    }

    if (this.ga4MeasurementId && typeof window !== 'undefined' && (window as any).gtag) {
      try {
        (window as any).gtag('event', event, props);
      } catch (error) {
        console.warn('GA4 track error:', error);
      }
    }
  }

  identify(userId: string, traits?: Record<string, unknown>) {
    if (this.posthog) {
      try {
        this.posthog.identify(userId, traits);
      } catch (error) {
        console.warn('PostHog identify error:', error);
      }
    }
  }

  trackFunnelStep(funnelName: string, step: string, properties?: Record<string, unknown>, userId?: string) {
    this.track(`funnel_${funnelName}`, {
      ...properties,
      step,
      funnel_name: funnelName,
    }, userId);
  }

  trackConversion(conversionType: string, properties?: Record<string, unknown>, userId?: string) {
    this.track('conversion', {
      ...properties,
      conversion_type: conversionType,
      timestamp: new Date().toISOString(),
    }, userId);
  }

  trackError(errorType: string, properties?: Record<string, unknown>, userId?: string) {
    this.track('error', {
      ...properties,
      error_type: errorType,
      timestamp: new Date().toISOString(),
    }, userId);
  }
}

export const analytics = new AnalyticsService();
