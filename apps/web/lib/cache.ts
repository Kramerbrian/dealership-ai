// Redis-based cache with in-memory fallback
import { logger } from './logger';

interface CacheEntry {
  value: any;
  ttl: number;
  created: number;
}

class InMemoryCache {
  private cache = new Map<string, CacheEntry>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.created > entry.ttl * 1000) {
        this.cache.delete(key);
      }
    }
  }

  async get<T = any>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.created > entry.ttl * 1000) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  async set(key: string, value: any, ttlSeconds: number = 3600): Promise<void> {
    this.cache.set(key, {
      value,
      ttl: ttlSeconds,
      created: Date.now(),
    });
  }

  async del(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;

    const now = Date.now();
    if (now - entry.created > entry.ttl * 1000) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  async flush(): Promise<void> {
    this.cache.clear();
  }

  destroy() {
    clearInterval(this.cleanupInterval);
    this.cache.clear();
  }
}

class RedisCache {
  private redis: any;
  private connected = false;

  constructor() {
    this.initRedis();
  }

  private async initRedis() {
    try {
      if (!process.env.REDIS_URL) {
        logger.info('No Redis URL provided, skipping Redis initialization');
        return;
      }

      // Dynamic import to avoid issues if redis package isn't installed
      const Redis = (await import('ioredis')).default;
      this.redis = new Redis(process.env.REDIS_URL);

      this.redis.on('connect', () => {
        this.connected = true;
        logger.info('Redis connected');
      });

      this.redis.on('error', (error: Error) => {
        this.connected = false;
        logger.error('Redis error', error);
      });

      await this.redis.ping();
      this.connected = true;
    } catch (error) {
      logger.warn('Failed to initialize Redis, using in-memory cache', { error });
      this.connected = false;
    }
  }

  async get<T = any>(key: string): Promise<T | null> {
    if (!this.connected || !this.redis) return null;

    try {
      const result = await this.redis.get(key);
      return result ? JSON.parse(result) : null;
    } catch (error) {
      logger.error('Redis get error', error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds: number = 3600): Promise<void> {
    if (!this.connected || !this.redis) return;

    try {
      await this.redis.setex(key, ttlSeconds, JSON.stringify(value));
    } catch (error) {
      logger.error('Redis set error', error instanceof Error ? error : new Error(String(error)));
    }
  }

  async del(key: string): Promise<void> {
    if (!this.connected || !this.redis) return;

    try {
      await this.redis.del(key);
    } catch (error) {
      logger.error('Redis del error', error instanceof Error ? error : new Error(String(error)));
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.connected || !this.redis) return false;

    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Redis exists error', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  async flush(): Promise<void> {
    if (!this.connected || !this.redis) return;

    try {
      await this.redis.flushall();
    } catch (error) {
      logger.error('Redis flush error', error instanceof Error ? error : new Error(String(error)));
    }
  }
}

class CacheManager {
  private redis: RedisCache;
  private memory: InMemoryCache;

  constructor() {
    this.redis = new RedisCache();
    this.memory = new InMemoryCache();
  }

  async get<T = any>(key: string): Promise<T | null> {
    // Try Redis first, fallback to memory
    let result = await this.redis.get<T>(key);
    if (result !== null) return result;

    result = await this.memory.get<T>(key);
    return result;
  }

  async set(key: string, value: any, ttlSeconds: number = 3600): Promise<void> {
    // Set in both caches
    await Promise.all([
      this.redis.set(key, value, ttlSeconds),
      this.memory.set(key, value, ttlSeconds),
    ]);
  }

  async del(key: string): Promise<void> {
    await Promise.all([
      this.redis.del(key),
      this.memory.del(key),
    ]);
  }

  async exists(key: string): Promise<boolean> {
    const redisExists = await this.redis.exists(key);
    if (redisExists) return true;

    return await this.memory.exists(key);
  }

  async flush(): Promise<void> {
    await Promise.all([
      this.redis.flush(),
      this.memory.flush(),
    ]);
  }

  // Utility methods for common patterns
  async remember<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds: number = 3600
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;

    const fresh = await fetcher();
    await this.set(key, fresh, ttlSeconds);
    return fresh;
  }

  async mget<T = any>(keys: string[]): Promise<(T | null)[]> {
    return Promise.all(keys.map(key => this.get<T>(key)));
  }

  async mset(entries: Array<{ key: string; value: any; ttl?: number }>): Promise<void> {
    await Promise.all(
      entries.map(({ key, value, ttl = 3600 }) => this.set(key, value, ttl))
    );
  }

  // Namespace helpers for organized cache keys
  key(namespace: string, ...parts: string[]): string {
    return `dealershipai:${namespace}:${parts.join(':')}`;
  }

  dealerKey(dealerId: string, ...parts: string[]): string {
    return this.key('dealer', dealerId, ...parts);
  }

  scoreKey(dealerId: string, type: string): string {
    return this.dealerKey(dealerId, 'scores', type);
  }

  batchKey(batchId: string, ...parts: string[]): string {
    return this.key('batch', batchId, ...parts);
  }

  queueKey(...parts: string[]): string {
    return this.key('queue', ...parts);
  }
}

export const cache = new CacheManager();
export default cache;