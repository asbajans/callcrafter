import Redis from 'ioredis';

export class RateLimiter {
  private redis: Redis | null;
  private memoryCache: Map<string, { count: number; resetAt: number }>;
  
  constructor() {
    this.memoryCache = new Map();
    if (process.env.REDIS_URL) {
      try {
        this.redis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1 });
      } catch {
        this.redis = null;
      }
    } else {
      this.redis = null;
    }
  }
  
  async checkLimit(tenantId: string, userId: string, limit: number, windowMs: number): Promise<{ allowed: boolean; limit: number; remaining: number; reset: number }> {
    const key = `rate_limit:${tenantId}:${userId}`;
    const now = Date.now();
    const windowKey = `${key}:${Math.floor(now / windowMs)}`;
    
    // Check memory cache first (faster)
    if (this.memoryCache.has(windowKey)) {
      const data = this.memoryCache.get(windowKey)!;
      if (data.resetAt > now) {
        return {
          allowed: data.count < limit,
          limit,
          remaining: Math.max(0, limit - data.count),
          reset: data.resetAt
        };
      } else {
        this.memoryCache.delete(windowKey);
      }
    }
    
    // Check Redis for distributed systems
    if (this.redis) {
      try {
        const redisCount = await this.redis.incr(windowKey);
        if (redisCount === 1) {
          await this.redis.expireat(windowKey, Math.ceil((now + windowMs) / 1000));
        }
        
        this.memoryCache.set(windowKey, {
          count: redisCount,
          resetAt: (Math.floor(now / windowMs) + 1) * windowMs
        });
        
        return {
          allowed: redisCount <= limit,
          limit,
          remaining: Math.max(0, limit - redisCount),
          reset: (Math.floor(now / windowMs) + 1) * windowMs
        };
      } catch (error) {
        console.warn('Redis error, falling back to memory cache:', error);
      }
    }
    
    // Fallback to memory cache only
    this.memoryCache.set(windowKey, {
      count: 1,
      resetAt: now + windowMs
    });
    
    return {
      allowed: true,
      limit,
      remaining: limit - 1,
      reset: now + windowMs
    };
  }
}

export function withRateLimit<T>(
  handler: () => Promise<T>,
  config: { tenantId: string; userId: string; limit: number; windowMs: number }
): () => Promise<T | Response> {
  return async () => {
    const rateLimiter = new RateLimiter();
    const result = await rateLimiter.checkLimit(
      config.tenantId,
      config.userId,
      config.limit,
      config.windowMs
    );
    
    if (!result.allowed) {
      return new Response(JSON.stringify({
        error: 'Rate limit exceeded',
        limit: result.limit,
        remaining: result.remaining,
        reset: result.reset,
      }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': result.limit.toString(),
          'X-RateLimit-Remaining': result.remaining.toString(),
          'X-RateLimit-Reset': result.reset.toString(),
        },
      });
    }
    
    return handler();
  };
}
