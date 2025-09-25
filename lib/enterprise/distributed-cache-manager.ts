import Redis from 'ioredis'
import { createLogger } from '../logger'
import { z } from 'zod'

const logger = createLogger('distributed-cache-manager')

// Zod schemas for cache data validation
const CacheDataSchema = z.object({
  data: z.any(),
  tier: z.enum(['L1', 'L2', 'L3', 'L4']),
  geographic_pool: z.string(),
  expires_at: z.number(),
  created_at: z.number(),
  access_count: z.number().default(0)
})

type CacheData = z.infer<typeof CacheDataSchema>

interface GeographicPool {
  name: string
  regions: string[]
  dealership_count: number
  cache_weight: number // Higher weight = longer cache duration
}

interface CacheStats {
  total_keys: number
  hit_rate: number
  miss_rate: number
  memory_usage: number
  geographic_distribution: Record<string, number>
  tier_distribution: Record<string, number>
}

export class DistributedCacheManager {
  private redisCluster: Redis.Cluster
  private redisLocal: Redis
  private cacheTiers: Record<string, number>
  private geographicPools: Map<string, GeographicPool>
  private statsCache: Map<string, any>

  constructor() {
    // Initialize Redis cluster for distributed caching
    const clusterNodes = process.env.REDIS_CLUSTERS?.split(',').map(node => {
      const [host, port] = node.split(':')
      return { host, port: parseInt(port) || 6379 }
    }) || [{ host: 'localhost', port: 6379 }]

    this.redisCluster = new Redis.Cluster(clusterNodes, {
      redisOptions: {
        password: process.env.REDIS_PASSWORD,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3
      },
      scaleReads: 'slave',
      maxRedirections: 16,
      retryDelayOnClusterDown: 300
    })

    // Local Redis for hot cache
    this.redisLocal = new Redis({
      host: process.env.REDIS_LOCAL_HOST || 'localhost',
      port: parseInt(process.env.REDIS_LOCAL_PORT || '6379'),
      password: process.env.REDIS_LOCAL_PASSWORD,
      maxRetriesPerRequest: 3
    })

    // Cache tier durations (seconds)
    this.cacheTiers = {
      L1: 900,      // 15 min - Hot cache (frequently accessed dealerships)
      L2: 3600,     // 1 hour - Warm cache (periodic checks)
      L3: 86400,    // 24 hours - Cold cache (daily analysis)
      L4: 604800    // 7 days - Frozen cache (historical/comparative data)
    }

    this.geographicPools = this.initializeGeographicPools()
    this.statsCache = new Map()

    this.setupEventHandlers()
  }

  private initializeGeographicPools(): Map<string, GeographicPool> {
    const pools = new Map<string, GeographicPool>([
      ['northeast', {
        name: 'Northeast Corridor',
        regions: ['NY', 'NJ', 'PA', 'CT', 'MA', 'RI', 'VT', 'NH', 'ME'],
        dealership_count: 1200,
        cache_weight: 1.2
      }],
      ['southeast', {
        name: 'Southeast Region',
        regions: ['FL', 'GA', 'SC', 'NC', 'VA', 'TN', 'KY', 'AL', 'MS', 'LA'],
        dealership_count: 1400,
        cache_weight: 1.1
      }],
      ['midwest', {
        name: 'Midwest Region',
        regions: ['IL', 'IN', 'MI', 'OH', 'WI', 'MN', 'IA', 'MO', 'ND', 'SD', 'NE', 'KS'],
        dealership_count: 1100,
        cache_weight: 1.0
      }],
      ['southwest', {
        name: 'Southwest Region',
        regions: ['TX', 'OK', 'AR', 'NM', 'AZ', 'NV'],
        dealership_count: 800,
        cache_weight: 0.9
      }],
      ['west', {
        name: 'West Coast',
        regions: ['CA', 'OR', 'WA', 'ID', 'UT', 'CO', 'WY', 'MT'],
        dealership_count: 500,
        cache_weight: 1.3
      }]
    ])

    logger.info({ pools: pools.size }, 'Initialized geographic pools for enterprise caching')
    return pools
  }

  private setupEventHandlers() {
    this.redisCluster.on('connect', () => {
      logger.info('Connected to Redis cluster')
    })

    this.redisCluster.on('error', (error) => {
      logger.error({ error }, 'Redis cluster error')
    })

    this.redisLocal.on('connect', () => {
      logger.info('Connected to local Redis cache')
    })

    // Setup cache cleanup intervals
    setInterval(() => this.cleanupExpiredEntries(), 300000) // 5 minutes
    setInterval(() => this.updateCacheStats(), 60000) // 1 minute
  }

  /**
   * Get geographic pool for a dealership based on location/domain
   */
  private getGeographicPool(dealershipData: { state?: string; domain?: string }): string {
    if (dealershipData.state) {
      for (const [poolName, pool] of this.geographicPools) {
        if (pool.regions.includes(dealershipData.state)) {
          return poolName
        }
      }
    }

    // Fallback: analyze domain for geographic hints
    if (dealershipData.domain) {
      const domain = dealershipData.domain.toLowerCase()
      if (domain.includes('florida') || domain.includes('miami') || domain.includes('tampa')) return 'southeast'
      if (domain.includes('texas') || domain.includes('dallas') || domain.includes('houston')) return 'southwest'
      if (domain.includes('california') || domain.includes('losangeles')) return 'west'
      if (domain.includes('newyork') || domain.includes('boston')) return 'northeast'
      if (domain.includes('chicago') || domain.includes('detroit')) return 'midwest'
    }

    return 'southeast' // Default to largest pool
  }

  /**
   * Generate cache key with enterprise-scale considerations
   */
  private generateCacheKey(
    dealershipId: string,
    analysisType: string = 'full',
    pooled: boolean = false
  ): string {
    const prefix = pooled ? 'POOL' : 'DEALER'
    const hash = this.hashString(dealershipId).slice(0, 8)
    return `${prefix}:${analysisType}:${hash}`
  }

  private hashString(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16)
  }

  /**
   * Intelligent cache retrieval with geographic pooling
   */
  async getAnalysis(
    dealershipId: string,
    dealershipData: { state?: string; domain?: string; brands?: string[] },
    options: {
      analysisType?: string
      allowPooled?: boolean
      maxAge?: number
    } = {}
  ): Promise<any | null> {
    const { analysisType = 'full', allowPooled = true, maxAge = 86400 } = options

    try {
      // Try L1 hot cache first (local Redis)
      const l1Key = `L1:${this.generateCacheKey(dealershipId, analysisType)}`
      let cachedData = await this.redisLocal.get(l1Key)

      if (cachedData) {
        const parsed = JSON.parse(cachedData)
        if (Date.now() - parsed.created_at < maxAge * 1000) {
          await this.incrementAccessCount(l1Key, 'L1')
          logger.debug({ dealershipId, cache: 'L1_HIT' }, 'Cache hit - L1')
          return this.addVarianceForDealership(parsed.data, dealershipId)
        }
      }

      // Try L2 warm cache (cluster)
      const l2Key = `L2:${this.generateCacheKey(dealershipId, analysisType)}`
      cachedData = await this.redisCluster.get(l2Key)

      if (cachedData) {
        const parsed = JSON.parse(cachedData)
        if (Date.now() - parsed.created_at < maxAge * 1000) {
          // Promote to L1
          await this.promoteToL1(l1Key, parsed)
          await this.incrementAccessCount(l2Key, 'L2')
          logger.debug({ dealershipId, cache: 'L2_HIT' }, 'Cache hit - L2')
          return this.addVarianceForDealership(parsed.data, dealershipId)
        }
      }

      // Try geographic pooled cache if allowed
      if (allowPooled) {
        const pool = this.getGeographicPool(dealershipData)
        const poolKey = `POOL:${pool}:${analysisType}`
        cachedData = await this.redisCluster.get(poolKey)

        if (cachedData) {
          const parsed = JSON.parse(cachedData)
          if (Date.now() - parsed.created_at < maxAge * 1000) {
            const variedData = this.addVarianceForDealership(parsed.data, dealershipId, dealershipData)

            // Cache the varied data in L1 for this specific dealership
            await this.setCache(l1Key, variedData, 'L1', pool)

            logger.debug({ dealershipId, pool, cache: 'POOL_HIT' }, 'Cache hit - Geographic pool')
            return variedData
          }
        }
      }

      logger.debug({ dealershipId, cache: 'MISS' }, 'Cache miss - no valid data found')
      return null

    } catch (error) {
      logger.error({ error, dealershipId }, 'Cache retrieval error')
      return null
    }
  }

  /**
   * Set cached analysis with intelligent tier placement
   */
  async setAnalysis(
    dealershipId: string,
    data: any,
    dealershipData: { state?: string; domain?: string; brands?: string[] },
    options: {
      analysisType?: string
      tier?: string
      pooled?: boolean
    } = {}
  ): Promise<void> {
    const { analysisType = 'full', tier = 'L2', pooled = false } = options

    try {
      const pool = this.getGeographicPool(dealershipData)
      const key = pooled
        ? `POOL:${pool}:${analysisType}`
        : `${tier}:${this.generateCacheKey(dealershipId, analysisType)}`

      await this.setCache(key, data, tier, pool)

      // For fresh analysis, also update the geographic pool
      if (!pooled && tier === 'L2') {
        const poolKey = `POOL:${pool}:${analysisType}`
        await this.setCache(poolKey, data, 'L3', pool)
      }

      logger.debug({
        dealershipId,
        tier,
        pool,
        pooled,
        key: key.slice(0, 50) + '...'
      }, 'Analysis cached successfully')

    } catch (error) {
      logger.error({ error, dealershipId, tier }, 'Cache storage error')
    }
  }

  /**
   * Bulk cache operations for enterprise-scale batch processing
   */
  async getBulkAnalyses(
    dealerships: Array<{
      id: string
      state?: string
      domain?: string
      brands?: string[]
    }>,
    options: {
      analysisType?: string
      allowPooled?: boolean
      maxAge?: number
    } = {}
  ): Promise<Record<string, any>> {
    const results: Record<string, any> = {}
    const { analysisType = 'full', allowPooled = true } = options

    // Group dealerships by geographic pool for efficient batch retrieval
    const poolGroups = new Map<string, typeof dealerships>()

    for (const dealership of dealerships) {
      const pool = this.getGeographicPool(dealership)
      if (!poolGroups.has(pool)) {
        poolGroups.set(pool, [])
      }
      poolGroups.get(pool)!.push(dealership)
    }

    // Process each geographic pool in parallel
    const poolPromises = Array.from(poolGroups.entries()).map(async ([pool, dealershipGroup]) => {
      const pipeline = this.redisCluster.pipeline()
      const keys: string[] = []

      // Add all cache keys to pipeline
      for (const dealership of dealershipGroup) {
        const l1Key = `L1:${this.generateCacheKey(dealership.id, analysisType)}`
        const l2Key = `L2:${this.generateCacheKey(dealership.id, analysisType)}`

        pipeline.get(l1Key)
        pipeline.get(l2Key)
        keys.push(l1Key, l2Key)
      }

      // Add pool key if allowed
      if (allowPooled) {
        const poolKey = `POOL:${pool}:${analysisType}`
        pipeline.get(poolKey)
        keys.push(poolKey)
      }

      const pipelineResults = await pipeline.exec()

      // Process results
      let keyIndex = 0
      for (const dealership of dealershipGroup) {
        const l1Result = pipelineResults?.[keyIndex]?.[1]
        const l2Result = pipelineResults?.[keyIndex + 1]?.[1]
        keyIndex += 2

        let cachedData = null

        // Check L1 first
        if (l1Result && typeof l1Result === 'string') {
          try {
            cachedData = JSON.parse(l1Result)
          } catch (e) {
            logger.warn({ dealership: dealership.id }, 'Failed to parse L1 cache data')
          }
        }

        // Check L2 if L1 miss
        if (!cachedData && l2Result && typeof l2Result === 'string') {
          try {
            cachedData = JSON.parse(l2Result)
          } catch (e) {
            logger.warn({ dealership: dealership.id }, 'Failed to parse L2 cache data')
          }
        }

        // Use pooled data if no individual cache hit
        if (!cachedData && allowPooled) {
          const poolResult = pipelineResults?.[keys.length - 1]?.[1]
          if (poolResult && typeof poolResult === 'string') {
            try {
              const poolData = JSON.parse(poolResult)
              cachedData = {
                data: this.addVarianceForDealership(poolData.data, dealership.id, dealership),
                created_at: poolData.created_at
              }
            } catch (e) {
              logger.warn({ pool }, 'Failed to parse pool cache data')
            }
          }
        }

        if (cachedData) {
          results[dealership.id] = cachedData.data
        }
      }
    })

    await Promise.all(poolPromises)

    logger.info({
      requested: dealerships.length,
      found: Object.keys(results).length,
      cache_hit_rate: (Object.keys(results).length / dealerships.length * 100).toFixed(1)
    }, 'Bulk cache retrieval completed')

    return results
  }

  /**
   * Set bulk analyses with intelligent geographic distribution
   */
  async setBulkAnalyses(
    analyses: Array<{
      dealershipId: string
      data: any
      dealershipData: { state?: string; domain?: string; brands?: string[] }
      tier?: string
    }>
  ): Promise<void> {
    // Group by geographic pools for efficient batch storage
    const poolGroups = new Map<string, typeof analyses>()

    for (const analysis of analyses) {
      const pool = this.getGeographicPool(analysis.dealershipData)
      if (!poolGroups.has(pool)) {
        poolGroups.set(pool, [])
      }
      poolGroups.get(pool)!.push(analysis)
    }

    // Process each pool in parallel
    const poolPromises = Array.from(poolGroups.entries()).map(async ([pool, analysisGroup]) => {
      const pipeline = this.redisCluster.pipeline()

      for (const analysis of analysisGroup) {
        const tier = analysis.tier || 'L2'
        const key = `${tier}:${this.generateCacheKey(analysis.dealershipId)}`
        const expirationTime = Math.floor(Date.now() / 1000) + this.cacheTiers[tier]

        const cacheData: CacheData = {
          data: analysis.data,
          tier: tier as any,
          geographic_pool: pool,
          expires_at: expirationTime,
          created_at: Date.now(),
          access_count: 0
        }

        pipeline.setex(key, this.cacheTiers[tier], JSON.stringify(cacheData))
      }

      await pipeline.exec()
    })

    await Promise.all(poolPromises)

    logger.info({
      stored: analyses.length,
      pools: poolGroups.size
    }, 'Bulk analyses cached successfully')
  }

  private async setCache(key: string, data: any, tier: string, pool: string): Promise<void> {
    const expirationTime = Math.floor(Date.now() / 1000) + this.cacheTiers[tier]
    const cacheData: CacheData = {
      data,
      tier: tier as any,
      geographic_pool: pool,
      expires_at: expirationTime,
      created_at: Date.now(),
      access_count: 0
    }

    const ttl = this.cacheTiers[tier]
    const redis = tier === 'L1' ? this.redisLocal : this.redisCluster

    await redis.setex(key, ttl, JSON.stringify(cacheData))
  }

  private async promoteToL1(key: string, data: any): Promise<void> {
    await this.redisLocal.setex(key, this.cacheTiers.L1, JSON.stringify(data))
  }

  private async incrementAccessCount(key: string, tier: string): Promise<void> {
    // Use Lua script for atomic increment
    const script = `
      local key = KEYS[1]
      local data = redis.call('get', key)
      if data then
        local parsed = cjson.decode(data)
        parsed.access_count = (parsed.access_count or 0) + 1
        parsed.last_accessed = tonumber(ARGV[1])
        return redis.call('set', key, cjson.encode(parsed), 'KEEPTTL')
      end
      return nil
    `

    const redis = tier === 'L1' ? this.redisLocal : this.redisCluster
    await redis.eval(script, 1, key, Date.now().toString())
  }

  /**
   * Add dealership-specific variance to pooled data
   */
  private addVarianceForDealership(
    baseData: any,
    dealershipId: string,
    dealershipData?: { state?: string; domain?: string; brands?: string[] }
  ): any {
    const hash = this.hashString(dealershipId)
    const variance = ((parseInt(hash.slice(-2), 16) % 10) - 5) / 100 // ±5% variance

    // Apply variance to scores
    if (baseData.scores) {
      const variedScores = { ...baseData.scores }
      Object.keys(variedScores).forEach(key => {
        if (typeof variedScores[key] === 'number') {
          variedScores[key] = Math.max(0, Math.min(100,
            Math.round(variedScores[key] * (1 + variance))
          ))
        }
      })

      return {
        ...baseData,
        scores: variedScores,
        dealer_id: dealershipId,
        cache_source: 'pooled_with_variance',
        variance_applied: variance
      }
    }

    return {
      ...baseData,
      dealer_id: dealershipId,
      cache_source: 'pooled_with_variance',
      variance_applied: variance
    }
  }

  /**
   * Cleanup expired cache entries
   */
  private async cleanupExpiredEntries(): Promise<void> {
    try {
      const script = `
        local keys = redis.call('keys', ARGV[1])
        local expired = 0
        for i=1,#keys do
          local data = redis.call('get', keys[i])
          if data then
            local parsed = cjson.decode(data)
            if parsed.expires_at and parsed.expires_at < tonumber(ARGV[2]) then
              redis.call('del', keys[i])
              expired = expired + 1
            end
          end
        end
        return expired
      `

      const currentTime = Math.floor(Date.now() / 1000)
      const [localExpired, clusterExpired] = await Promise.all([
        this.redisLocal.eval(script, 0, '*', currentTime.toString()),
        this.redisCluster.eval(script, 0, '*', currentTime.toString())
      ])

      if ((localExpired as number) > 0 || (clusterExpired as number) > 0) {
        logger.info({
          local_expired: localExpired,
          cluster_expired: clusterExpired
        }, 'Cleaned up expired cache entries')
      }

    } catch (error) {
      logger.error({ error }, 'Cache cleanup error')
    }
  }

  /**
   * Update cache statistics for monitoring
   */
  private async updateCacheStats(): Promise<void> {
    try {
      // This would be implemented with proper Redis stats collection
      const stats: CacheStats = {
        total_keys: 0,
        hit_rate: 0,
        miss_rate: 0,
        memory_usage: 0,
        geographic_distribution: {},
        tier_distribution: {}
      }

      this.statsCache.set('current_stats', {
        ...stats,
        updated_at: Date.now()
      })

    } catch (error) {
      logger.error({ error }, 'Failed to update cache stats')
    }
  }

  /**
   * Get current cache statistics
   */
  async getCacheStats(): Promise<CacheStats> {
    const cached = this.statsCache.get('current_stats')
    if (cached && Date.now() - cached.updated_at < 60000) { // 1 minute
      return cached
    }

    await this.updateCacheStats()
    return this.statsCache.get('current_stats') || {
      total_keys: 0,
      hit_rate: 0,
      miss_rate: 0,
      memory_usage: 0,
      geographic_distribution: {},
      tier_distribution: {}
    }
  }

  /**
   * Invalidate cache for specific dealerships or pools
   */
  async invalidateCache(options: {
    dealershipIds?: string[]
    geographicPools?: string[]
    analysisType?: string
    tier?: string
  }): Promise<number> {
    const { dealershipIds, geographicPools, analysisType = '*', tier = '*' } = options
    let deletedCount = 0

    try {
      if (dealershipIds) {
        const pipeline = this.redisCluster.pipeline()
        for (const dealershipId of dealershipIds) {
          const patterns = [
            `L1:${this.generateCacheKey(dealershipId, analysisType)}`,
            `L2:${this.generateCacheKey(dealershipId, analysisType)}`,
            `L3:${this.generateCacheKey(dealershipId, analysisType)}`,
            `L4:${this.generateCacheKey(dealershipId, analysisType)}`
          ]
          patterns.forEach(pattern => pipeline.del(pattern))
        }
        const results = await pipeline.exec()
        deletedCount += results?.filter(r => r && r[1] === 1).length || 0
      }

      if (geographicPools) {
        const pipeline = this.redisCluster.pipeline()
        for (const pool of geographicPools) {
          pipeline.del(`POOL:${pool}:${analysisType}`)
        }
        const results = await pipeline.exec()
        deletedCount += results?.filter(r => r && r[1] === 1).length || 0
      }

      logger.info({ deletedCount, dealershipIds, geographicPools }, 'Cache invalidation completed')
      return deletedCount

    } catch (error) {
      logger.error({ error }, 'Cache invalidation error')
      return 0
    }
  }
}

export const distributedCacheManager = new DistributedCacheManager()