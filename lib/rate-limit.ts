import { Cache } from './cache'
import { createLogger } from './logger'

const logger = createLogger('rate-limit')

export interface RateLimitConfig {
  windowMs: number
  maxRequests: number
  keyGenerator?: (identifier: string) => string
  skipSuccessfulRequests?: boolean
  skipFailedRequests?: boolean
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  reset: number
  retryAfter?: number
}

export interface RateLimitInfo {
  requests: number
  resetTime: number
  windowMs: number
}

export class RateLimit {
  private config: RateLimitConfig

  constructor(config: RateLimitConfig) {
    this.config = {
      keyGenerator: (id: string) => `rate_limit:${id}`,
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      ...config,
    }
  }

  async checkLimit(identifier: string): Promise<RateLimitResult> {
    const key = this.config.keyGenerator!(identifier)
    const now = Date.now()
    const windowStart = now - this.config.windowMs

    try {
      // Get current limit info
      const info = await this.getLimitInfo(key)

      // Check if window has expired
      if (info.resetTime <= now) {
        // Reset the window
        await this.resetWindow(key, now)
        return {
          allowed: true,
          remaining: this.config.maxRequests - 1,
          reset: now + this.config.windowMs,
        }
      }

      // Check if limit exceeded
      if (info.requests >= this.config.maxRequests) {
        const retryAfter = Math.ceil((info.resetTime - now) / 1000)

        logger.warn({
          identifier,
          requests: info.requests,
          limit: this.config.maxRequests,
          retryAfter,
        }, 'Rate limit exceeded')

        return {
          allowed: false,
          remaining: 0,
          reset: info.resetTime,
          retryAfter,
        }
      }

      // Increment counter
      await this.incrementCounter(key, info.resetTime)

      const result = {
        allowed: true,
        remaining: this.config.maxRequests - info.requests - 1,
        reset: info.resetTime,
      }

      logger.debug({
        identifier,
        requests: info.requests + 1,
        remaining: result.remaining,
      }, 'Rate limit check passed')

      return result
    } catch (error) {
      logger.error({ error, identifier }, 'Rate limit check failed')
      // Fail open - allow request if rate limiting fails
      return {
        allowed: true,
        remaining: this.config.maxRequests,
        reset: now + this.config.windowMs,
      }
    }
  }

  async recordRequest(identifier: string, success: boolean = true): Promise<void> {
    if (this.config.skipSuccessfulRequests && success) return
    if (this.config.skipFailedRequests && !success) return

    const key = this.config.keyGenerator!(identifier)
    const now = Date.now()

    try {
      const info = await this.getLimitInfo(key)

      if (info.resetTime <= now) {
        await this.resetWindow(key, now)
        await this.incrementCounter(key, now + this.config.windowMs)
      } else {
        await this.incrementCounter(key, info.resetTime)
      }
    } catch (error) {
      logger.error({ error, identifier }, 'Failed to record rate limit request')
    }
  }

  private async getLimitInfo(key: string): Promise<RateLimitInfo> {
    const data = await Cache.get(key)

    if (!data) {
      return {
        requests: 0,
        resetTime: Date.now() + this.config.windowMs,
        windowMs: this.config.windowMs,
      }
    }

    try {
      return JSON.parse(data)
    } catch {
      return {
        requests: 0,
        resetTime: Date.now() + this.config.windowMs,
        windowMs: this.config.windowMs,
      }
    }
  }

  private async resetWindow(key: string, now: number): Promise<void> {
    const info: RateLimitInfo = {
      requests: 0,
      resetTime: now + this.config.windowMs,
      windowMs: this.config.windowMs,
    }

    await Cache.set(
      key,
      JSON.stringify(info),
      Math.ceil(this.config.windowMs / 1000)
    )
  }

  private async incrementCounter(key: string, resetTime: number): Promise<void> {
    const info = await this.getLimitInfo(key)
    info.requests += 1
    info.resetTime = resetTime

    await Cache.set(
      key,
      JSON.stringify(info),
      Math.ceil(this.config.windowMs / 1000)
    )
  }

  async getRemainingRequests(identifier: string): Promise<number> {
    const key = this.config.keyGenerator!(identifier)
    const info = await this.getLimitInfo(key)

    if (info.resetTime <= Date.now()) {
      return this.config.maxRequests
    }

    return Math.max(0, this.config.maxRequests - info.requests)
  }

  async resetLimit(identifier: string): Promise<void> {
    const key = this.config.keyGenerator!(identifier)
    await Cache.del(key)
    logger.info({ identifier }, 'Rate limit reset')
  }
}

// Predefined rate limiters
export const createAPIRateLimit = () => new RateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100,
  keyGenerator: (id) => `api_rate_limit:${id}`,
})

export const createAIRateLimit = () => new RateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10,
  keyGenerator: (id) => `ai_rate_limit:${id}`,
})

export const createBatchRateLimit = () => new RateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 5,
  keyGenerator: (id) => `batch_rate_limit:${id}`,
})

export const createSchemaRateLimit = () => new RateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  maxRequests: 20,
  keyGenerator: (id) => `schema_rate_limit:${id}`,
})

// Global rate limiters
export const apiRateLimit = createAPIRateLimit()
export const aiRateLimit = createAIRateLimit()
export const batchRateLimit = createBatchRateLimit()
export const schemaRateLimit = createSchemaRateLimit()

// Rate limiting middleware helpers
export async function rateLimitMiddleware(
  identifier: string,
  rateLimit: RateLimit,
  request: Request
): Promise<Response | null> {
  const result = await rateLimit.checkLimit(identifier)

  if (!result.allowed) {
    return new Response(
      JSON.stringify({
        error: 'Rate limit exceeded',
        retryAfter: result.retryAfter,
        reset: result.reset,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': rateLimit['config'].maxRequests.toString(),
          'X-RateLimit-Remaining': result.remaining.toString(),
          'X-RateLimit-Reset': result.reset.toString(),
          'Retry-After': (result.retryAfter || 60).toString(),
        },
      }
    )
  }

  return null
}

export function createRateLimitHeaders(result: RateLimitResult, maxRequests: number): Record<string, string> {
  return {
    'X-RateLimit-Limit': maxRequests.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.reset.toString(),
  }
}

// Usage tracking for billing/analytics
export class UsageTracker {
  private dailyLimitKey = 'usage_daily:'
  private monthlyLimitKey = 'usage_monthly:'

  async trackUsage(
    identifier: string,
    category: 'api' | 'ai' | 'batch' | 'schema',
    amount: number = 1
  ): Promise<{
    daily: number
    monthly: number
  }> {
    const today = new Date().toISOString().split('T')[0]
    const month = today.substring(0, 7)

    const dailyKey = `${this.dailyLimitKey}${identifier}:${category}:${today}`
    const monthlyKey = `${this.monthlyLimitKey}${identifier}:${category}:${month}`

    try {
      const [dailyCount, monthlyCount] = await Promise.all([
        Cache.incr(dailyKey, 24 * 60 * 60), // 24 hour TTL
        Cache.incr(monthlyKey, 31 * 24 * 60 * 60), // 31 day TTL
      ])

      logger.debug({
        identifier,
        category,
        amount,
        dailyTotal: dailyCount,
        monthlyTotal: monthlyCount,
      }, 'Usage tracked')

      return {
        daily: dailyCount,
        monthly: monthlyCount,
      }
    } catch (error) {
      logger.error({ error, identifier, category }, 'Failed to track usage')
      return { daily: 0, monthly: 0 }
    }
  }

  async getUsage(
    identifier: string,
    category: 'api' | 'ai' | 'batch' | 'schema'
  ): Promise<{
    daily: number
    monthly: number
  }> {
    const today = new Date().toISOString().split('T')[0]
    const month = today.substring(0, 7)

    const dailyKey = `${this.dailyLimitKey}${identifier}:${category}:${today}`
    const monthlyKey = `${this.monthlyLimitKey}${identifier}:${category}:${month}`

    try {
      const [dailyData, monthlyData] = await Promise.all([
        Cache.get(dailyKey),
        Cache.get(monthlyKey),
      ])

      return {
        daily: parseInt(dailyData || '0', 10),
        monthly: parseInt(monthlyData || '0', 10),
      }
    } catch (error) {
      logger.error({ error, identifier, category }, 'Failed to get usage')
      return { daily: 0, monthly: 0 }
    }
  }
}

export const usageTracker = new UsageTracker()