import Redis from 'ioredis'
import { createLogger } from './logger'

const logger = createLogger('cache')

let redis: Redis | null = null

if (process.env.REDIS_URL) {
  try {
    redis = new Redis(process.env.REDIS_URL, {
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    })

    redis.on('connect', () => {
      logger.info('Redis connected')
    })

    redis.on('error', (err) => {
      logger.error({ error: err }, 'Redis connection error')
    })

    redis.on('reconnecting', () => {
      logger.info('Redis reconnecting')
    })
  } catch (error) {
    logger.error({ error }, 'Failed to initialize Redis')
  }
} else {
  logger.info('Redis URL not provided, using in-memory cache fallback')
}

const memoryCache = new Map<string, { value: string; expires: number }>()

const cleanupMemoryCache = () => {
  const now = Date.now()
  for (const [key, data] of memoryCache.entries()) {
    if (data.expires < now) {
      memoryCache.delete(key)
    }
  }
}

setInterval(cleanupMemoryCache, 60000) // Clean up every minute

export class Cache {
  static async get(key: string): Promise<string | null> {
    if (redis) {
      try {
        return await redis.get(key)
      } catch (error) {
        logger.error({ error, key }, 'Redis get error')
        return null
      }
    }

    const cached = memoryCache.get(key)
    if (!cached) return null
    if (cached.expires < Date.now()) {
      memoryCache.delete(key)
      return null
    }
    return cached.value
  }

  static async set(
    key: string,
    value: string,
    ttlSeconds: number = 3600
  ): Promise<boolean> {
    if (redis) {
      try {
        await redis.setex(key, ttlSeconds, value)
        return true
      } catch (error) {
        logger.error({ error, key }, 'Redis set error')
        return false
      }
    }

    memoryCache.set(key, {
      value,
      expires: Date.now() + ttlSeconds * 1000,
    })
    return true
  }

  static async del(key: string): Promise<boolean> {
    if (redis) {
      try {
        await redis.del(key)
        return true
      } catch (error) {
        logger.error({ error, key }, 'Redis del error')
        return false
      }
    }

    return memoryCache.delete(key)
  }

  static async keys(pattern: string): Promise<string[]> {
    if (redis) {
      try {
        return await redis.keys(pattern)
      } catch (error) {
        logger.error({ error, pattern }, 'Redis keys error')
        return []
      }
    }

    const regex = new RegExp(pattern.replace(/\*/g, '.*'))
    return Array.from(memoryCache.keys()).filter(key => regex.test(key))
  }

  static async flushAll(): Promise<boolean> {
    if (redis) {
      try {
        await redis.flushall()
        return true
      } catch (error) {
        logger.error({ error }, 'Redis flushall error')
        return false
      }
    }

    memoryCache.clear()
    return true
  }

  static async incr(key: string, ttl?: number): Promise<number> {
    if (redis) {
      try {
        const result = await redis.incr(key)
        if (ttl && result === 1) {
          await redis.expire(key, ttl)
        }
        return result
      } catch (error) {
        logger.error({ error, key }, 'Redis incr error')
        return 0
      }
    }

    const current = await this.get(key)
    const newValue = (parseInt(current || '0', 10) || 0) + 1
    await this.set(key, newValue.toString(), ttl || 3600)
    return newValue
  }

  static async exists(key: string): Promise<boolean> {
    if (redis) {
      try {
        const result = await redis.exists(key)
        return result === 1
      } catch (error) {
        logger.error({ error, key }, 'Redis exists error')
        return false
      }
    }

    const cached = memoryCache.get(key)
    if (!cached) return false
    if (cached.expires < Date.now()) {
      memoryCache.delete(key)
      return false
    }
    return true
  }

  static getClient(): Redis | null {
    return redis
  }

  static isConnected(): boolean {
    return redis?.status === 'ready' || !process.env.REDIS_URL
  }
}

export default Cache