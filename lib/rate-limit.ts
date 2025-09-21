import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Create Redis client with fallback for development
let redis: Redis | undefined;

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
}

// Create rate limiter with fallback for development
export function rateLimit(config: {
  interval: number;
  uniqueTokenPerInterval: number;
}) {
  if (!redis) {
    // In development or when Redis is not configured, use in-memory rate limiting
    const requests = new Map<string, { count: number; resetTime: number }>();

    return {
      check: async (limit: number, token: string) => {
        const now = Date.now();
        const key = token;
        const current = requests.get(key);

        if (!current || now > current.resetTime) {
          requests.set(key, { count: 1, resetTime: now + config.interval });
          return { success: true };
        }

        if (current.count >= limit) {
          return { success: false };
        }

        current.count++;
        return { success: true };
      }
    };
  }

  // Use Upstash rate limiting in production
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "1 m"), // 10 requests per minute
    analytics: true,
  });
}