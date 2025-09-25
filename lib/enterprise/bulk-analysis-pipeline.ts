import { Queue, Worker, Job } from 'bullmq'
import IORedis from 'ioredis'
import { createLogger } from '../logger'
import { distributedCacheManager } from './distributed-cache-manager'
import { z } from 'zod'
import { db } from '../db'

const logger = createLogger('bulk-analysis-pipeline')

// Job schemas
const BulkAnalysisJobSchema = z.object({
  job_name: z.string(),
  job_type: z.enum(['full_analysis', 'quick_refresh', 'competitive_scan', 'market_analysis']),
  dealership_group_id: z.string().uuid().optional(),
  geographic_market_id: z.string().uuid().optional(),
  dealership_ids: z.array(z.string().uuid()).optional(),
  analysis_params: z.object({
    include_competitive: z.boolean().default(true),
    include_historical: z.boolean().default(false),
    force_fresh_data: z.boolean().default(false),
    max_age_hours: z.number().default(24)
  }).default({}),
  priority: z.number().default(1000),
  scheduled_for: z.string().datetime().optional(),
  created_by: z.string().optional()
})

type BulkAnalysisJobData = z.infer<typeof BulkAnalysisJobSchema>

interface DealershipRecord {
  id: string
  name: string
  primary_domain: string
  city: string
  state_code: string
  brands: string[]
  franchise_type: string
  dealership_group_id?: string
  geographic_market_id?: string
  last_analysis_at?: Date
}

interface AnalysisResult {
  dealership_id: string
  success: boolean
  data?: any
  error?: string
  execution_time_ms: number
  cache_hit: boolean
}

interface JobProgress {
  total_dealerships: number
  completed_dealerships: number
  failed_dealerships: number
  current_phase: string
  estimated_completion: Date
  errors: string[]
}

export class BulkAnalysisPipeline {
  private analysisQueue: Queue
  private competitiveQueue: Queue
  private marketQueue: Queue
  private workers: Worker[]
  private redis: IORedis

  constructor() {
    // Initialize Redis connection for queues
    this.redis = new IORedis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100
    })

    // Initialize queues with different priorities
    this.analysisQueue = new Queue('dealership-analysis', {
      connection: this.redis,
      defaultJobOptions: {
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 50, // Keep last 50 failed jobs
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      }
    })

    this.competitiveQueue = new Queue('competitive-analysis', {
      connection: this.redis,
      defaultJobOptions: {
        removeOnComplete: 50,
        removeOnFail: 25,
        attempts: 2,
        backoff: {
          type: 'exponential',
          delay: 5000
        }
      }
    })

    this.marketQueue = new Queue('market-analysis', {
      connection: this.redis,
      defaultJobOptions: {
        removeOnComplete: 20,
        removeOnFail: 10,
        attempts: 2,
        backoff: {
          type: 'exponential',
          delay: 10000
        }
      }
    })

    this.workers = []
    this.initializeWorkers()
  }

  private initializeWorkers() {
    // Primary analysis workers (high concurrency)
    for (let i = 0; i < 10; i++) {
      const worker = new Worker('dealership-analysis', this.processAnalysisJob.bind(this), {
        connection: this.redis,
        concurrency: 5,
        stalledInterval: 30 * 1000,
        maxStalledCount: 1
      })
      this.workers.push(worker)
    }

    // Competitive analysis workers (medium concurrency)
    for (let i = 0; i < 5; i++) {
      const worker = new Worker('competitive-analysis', this.processCompetitiveJob.bind(this), {
        connection: this.redis,
        concurrency: 3,
        stalledInterval: 60 * 1000,
        maxStalledCount: 1
      })
      this.workers.push(worker)
    }

    // Market analysis workers (low concurrency, high resource)
    for (let i = 0; i < 2; i++) {
      const worker = new Worker('market-analysis', this.processMarketJob.bind(this), {
        connection: this.redis,
        concurrency: 1,
        stalledInterval: 120 * 1000,
        maxStalledCount: 1
      })
      this.workers.push(worker)
    }

    logger.info({ workers: this.workers.length }, 'Bulk analysis workers initialized')
  }

  /**
   * Submit a bulk analysis job for 5000+ dealerships
   */
  async submitBulkAnalysis(jobData: BulkAnalysisJobData): Promise<string> {
    try {
      // Validate job data
      const validatedData = BulkAnalysisJobSchema.parse(jobData)

      // Get dealerships to analyze
      const dealerships = await this.getDealershipsForJob(validatedData)

      if (dealerships.length === 0) {
        throw new Error('No dealerships found matching job criteria')
      }

      if (dealerships.length > 5000) {
        logger.warn({
          requested: dealerships.length,
          job_name: validatedData.job_name
        }, 'Large bulk job detected, implementing intelligent batching')
      }

      // Create database record
      const jobRecord = await db.query(`
        INSERT INTO bulk_analysis_jobs (
          job_name, job_type, dealership_group_id, geographic_market_id,
          dealership_ids, status, priority, scheduled_for, total_dealerships,
          created_by, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        RETURNING id
      `, [
        validatedData.job_name,
        validatedData.job_type,
        validatedData.dealership_group_id || null,
        validatedData.geographic_market_id || null,
        dealerships.map(d => d.id),
        'pending',
        validatedData.priority,
        validatedData.scheduled_for ? new Date(validatedData.scheduled_for) : new Date(),
        dealerships.length,
        validatedData.created_by || 'system'
      ])

      const jobId = jobRecord.rows[0].id

      // Intelligent job batching for enterprise scale
      const batches = this.createIntelligentBatches(dealerships, validatedData.job_type)

      logger.info({
        jobId,
        job_name: validatedData.job_name,
        total_dealerships: dealerships.length,
        batches: batches.length,
        job_type: validatedData.job_type
      }, 'Bulk analysis job created with intelligent batching')

      // Submit batches to appropriate queues
      await this.submitJobBatches(jobId, batches, validatedData)

      return jobId

    } catch (error) {
      logger.error({ error, jobData }, 'Failed to submit bulk analysis job')
      throw error
    }
  }

  /**
   * Get dealerships for a job based on criteria
   */
  private async getDealershipsForJob(jobData: BulkAnalysisJobData): Promise<DealershipRecord[]> {
    let query = `
      SELECT d.id, d.name, d.primary_domain, d.city, d.state_code, d.brands,
             d.franchise_type, d.dealership_group_id, d.geographic_market_id,
             d.last_analysis_at
      FROM dealerships d
      WHERE d.status = 'active'
    `
    const params: any[] = []
    let paramIndex = 1

    // Filter by dealership group
    if (jobData.dealership_group_id) {
      query += ` AND d.dealership_group_id = $${paramIndex++}`
      params.push(jobData.dealership_group_id)
    }

    // Filter by geographic market
    if (jobData.geographic_market_id) {
      query += ` AND d.geographic_market_id = $${paramIndex++}`
      params.push(jobData.geographic_market_id)
    }

    // Filter by specific dealership IDs
    if (jobData.dealership_ids && jobData.dealership_ids.length > 0) {
      query += ` AND d.id = ANY($${paramIndex++})`
      params.push(jobData.dealership_ids)
    }

    // For quick refresh, prioritize dealerships that haven't been analyzed recently
    if (jobData.job_type === 'quick_refresh') {
      const maxAge = jobData.analysis_params.max_age_hours || 24
      query += ` AND (d.last_analysis_at IS NULL OR d.last_analysis_at < NOW() - INTERVAL '${maxAge} hours')`
    }

    query += ` ORDER BY d.last_analysis_at ASC NULLS FIRST, d.created_at ASC`

    const result = await db.query(query, params)
    return result.rows
  }

  /**
   * Create intelligent batches based on geographic clustering and job type
   */
  private createIntelligentBatches(
    dealerships: DealershipRecord[],
    jobType: string
  ): Array<{ id: string; dealerships: DealershipRecord[]; priority: number; estimated_duration: number }> {
    const batches: Array<{ id: string; dealerships: DealershipRecord[]; priority: number; estimated_duration: number }> = []

    // Batch size based on job type
    const batchSizes = {
      full_analysis: 50,    // Intensive analysis
      quick_refresh: 200,   // Cache-heavy, faster
      competitive_scan: 100, // Medium intensity
      market_analysis: 25   // Very intensive
    }

    const batchSize = batchSizes[jobType] || 100

    // Group by geographic market for better caching efficiency
    const marketGroups = new Map<string, DealershipRecord[]>()

    dealerships.forEach(dealership => {
      const marketKey = dealership.geographic_market_id || `${dealership.state_code}_unknown`
      if (!marketGroups.has(marketKey)) {
        marketGroups.set(marketKey, [])
      }
      marketGroups.get(marketKey)!.push(dealership)
    })

    // Create batches within each market
    let batchIndex = 0
    for (const [marketKey, marketDealerships] of marketGroups) {
      const marketBatches = this.chunkArray(marketDealerships, batchSize)

      marketBatches.forEach((batch, index) => {
        batches.push({
          id: `${marketKey}_batch_${batchIndex++}`,
          dealerships: batch,
          priority: this.calculateBatchPriority(batch, jobType),
          estimated_duration: this.estimateBatchDuration(batch, jobType)
        })
      })
    }

    // Sort batches by priority (lower number = higher priority)
    batches.sort((a, b) => a.priority - b.priority)

    logger.info({
      total_dealerships: dealerships.length,
      batches: batches.length,
      markets: marketGroups.size,
      avg_batch_size: Math.round(dealerships.length / batches.length)
    }, 'Intelligent batching completed')

    return batches
  }

  private calculateBatchPriority(dealerships: DealershipRecord[], jobType: string): number {
    let priority = 1000 // Base priority

    // Higher priority for luxury brands
    const luxuryCount = dealerships.filter(d =>
      d.brands.some(brand => ['Lexus', 'Mercedes', 'BMW', 'Audi', 'Cadillac'].includes(brand))
    ).length
    priority -= luxuryCount * 10

    // Higher priority for recently inactive dealerships
    const staleCount = dealerships.filter(d =>
      !d.last_analysis_at || Date.now() - d.last_analysis_at.getTime() > 7 * 24 * 60 * 60 * 1000
    ).length
    priority -= staleCount * 5

    // Job type adjustments
    if (jobType === 'competitive_scan') priority -= 100
    if (jobType === 'market_analysis') priority -= 200

    return Math.max(1, priority)
  }

  private estimateBatchDuration(dealerships: DealershipRecord[], jobType: string): number {
    const baseDurations = {
      full_analysis: 120,    // 2 minutes per dealership
      quick_refresh: 10,     // 10 seconds per dealership
      competitive_scan: 60,  // 1 minute per dealership
      market_analysis: 300   // 5 minutes per dealership
    }

    const basePerDealership = baseDurations[jobType] || 60
    return dealerships.length * basePerDealership
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize))
    }
    return chunks
  }

  /**
   * Submit job batches to appropriate queues
   */
  private async submitJobBatches(
    jobId: string,
    batches: Array<{ id: string; dealerships: DealershipRecord[]; priority: number; estimated_duration: number }>,
    jobData: BulkAnalysisJobData
  ): Promise<void> {
    const queue = this.getQueueForJobType(jobData.job_type)

    // Submit batches with staggered timing to prevent overwhelming
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i]
      const delay = i * 1000 // 1 second between batch submissions

      await queue.add(`${jobData.job_name}_${batch.id}`, {
        job_id: jobId,
        batch_id: batch.id,
        batch_index: i,
        total_batches: batches.length,
        dealerships: batch.dealerships,
        job_type: jobData.job_type,
        analysis_params: jobData.analysis_params,
        estimated_duration: batch.estimated_duration
      }, {
        priority: batch.priority,
        delay: delay,
        attempts: jobData.job_type === 'market_analysis' ? 2 : 3
      })
    }

    // Update job status
    await db.query(`
      UPDATE bulk_analysis_jobs
      SET status = 'running', started_at = NOW(), updated_at = NOW()
      WHERE id = $1
    `, [jobId])

    logger.info({
      jobId,
      batches: batches.length,
      job_type: jobData.job_type
    }, 'All job batches submitted to queue')
  }

  private getQueueForJobType(jobType: string): Queue {
    switch (jobType) {
      case 'competitive_scan':
        return this.competitiveQueue
      case 'market_analysis':
        return this.marketQueue
      default:
        return this.analysisQueue
    }
  }

  /**
   * Process individual dealership analysis job
   */
  private async processAnalysisJob(job: Job): Promise<AnalysisResult[]> {
    const { job_id, batch_id, dealerships, job_type, analysis_params } = job.data

    logger.info({
      jobId: job_id,
      batchId: batch_id,
      dealerships: dealerships.length,
      job_type
    }, 'Processing analysis batch')

    const results: AnalysisResult[] = []
    const startTime = Date.now()

    try {
      // Update job progress
      job.updateProgress({
        phase: 'analyzing',
        completed: 0,
        total: dealerships.length
      })

      // Try bulk cache retrieval first
      const cacheResults = await distributedCacheManager.getBulkAnalyses(
        dealerships.map(d => ({
          id: d.id,
          state: d.state_code,
          domain: d.primary_domain,
          brands: d.brands
        })),
        {
          analysisType: job_type,
          allowPooled: !analysis_params.force_fresh_data,
          maxAge: analysis_params.max_age_hours * 3600
        }
      )

      // Process each dealership
      for (let i = 0; i < dealerships.length; i++) {
        const dealership = dealerships[i]
        const dealershipStartTime = Date.now()
        let analysisResult: AnalysisResult

        try {
          // Check if we have cached data
          if (cacheResults[dealership.id] && !analysis_params.force_fresh_data) {
            analysisResult = {
              dealership_id: dealership.id,
              success: true,
              data: cacheResults[dealership.id],
              execution_time_ms: Date.now() - dealershipStartTime,
              cache_hit: true
            }
          } else {
            // Generate new analysis
            const analysisData = await this.generateDealershipAnalysis(dealership, job_type)

            // Cache the result
            await distributedCacheManager.setAnalysis(
              dealership.id,
              analysisData,
              {
                state: dealership.state_code,
                domain: dealership.primary_domain,
                brands: dealership.brands
              },
              {
                analysisType: job_type,
                tier: 'L2'
              }
            )

            analysisResult = {
              dealership_id: dealership.id,
              success: true,
              data: analysisData,
              execution_time_ms: Date.now() - dealershipStartTime,
              cache_hit: false
            }
          }

          // Store result in database
          await this.storeAnalysisResult(dealership.id, analysisResult.data)

        } catch (error) {
          logger.error({ error, dealership: dealership.id }, 'Dealership analysis failed')
          analysisResult = {
            dealership_id: dealership.id,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            execution_time_ms: Date.now() - dealershipStartTime,
            cache_hit: false
          }
        }

        results.push(analysisResult)

        // Update progress
        job.updateProgress({
          phase: 'analyzing',
          completed: i + 1,
          total: dealerships.length,
          current_dealership: dealership.name
        })

        // Rate limiting to prevent API abuse
        if (!analysisResult.cache_hit && i < dealerships.length - 1) {
          await this.rateLimitDelay(job_type)
        }
      }

      // Update job completion status
      const successful = results.filter(r => r.success).length
      const failed = results.length - successful

      await this.updateJobProgress(job_id, {
        completed_dealerships: successful,
        failed_dealerships: failed,
        errors: results.filter(r => !r.success).map(r => r.error || 'Unknown error')
      })

      logger.info({
        jobId: job_id,
        batchId: batch_id,
        successful,
        failed,
        total_time_ms: Date.now() - startTime,
        cache_hit_rate: (results.filter(r => r.cache_hit).length / results.length * 100).toFixed(1)
      }, 'Analysis batch completed')

      return results

    } catch (error) {
      logger.error({ error, jobId: job_id, batchId: batch_id }, 'Analysis batch failed')
      throw error
    }
  }

  /**
   * Process competitive analysis job
   */
  private async processCompetitiveJob(job: Job): Promise<void> {
    // Implementation for competitive analysis
    // This would analyze market positioning, competitor strengths/weaknesses
    logger.info({ jobId: job.id }, 'Processing competitive analysis job')
  }

  /**
   * Process market analysis job
   */
  private async processMarketJob(job: Job): Promise<void> {
    // Implementation for market-level analysis
    // This would analyze entire markets, identify trends, opportunities
    logger.info({ jobId: job.id }, 'Processing market analysis job')
  }

  private async generateDealershipAnalysis(dealership: DealershipRecord, jobType: string): Promise<any> {
    // This would integrate with the actual DealershipAI Intelligence API
    // For now, return synthetic data similar to the previous implementation

    const baseScores = this.getBaseScoresByFranchiseType(dealership.franchise_type)
    const brandMultiplier = this.getBrandMultiplier(dealership.brands)
    const marketMultiplier = this.getMarketMultiplier(dealership.state_code)

    const scores = {
      ai_visibility: Math.round(baseScores.ai_visibility * brandMultiplier * marketMultiplier),
      seo_performance: Math.round(baseScores.seo_performance * brandMultiplier * marketMultiplier),
      aeo_readiness: Math.round(baseScores.aeo_readiness * brandMultiplier * marketMultiplier),
      geo_optimization: Math.round(baseScores.geo_optimization * brandMultiplier * marketMultiplier),
      schema_integrity: Math.round(baseScores.schema_integrity * brandMultiplier * marketMultiplier),
      review_strength: Math.round(baseScores.review_strength * brandMultiplier * marketMultiplier)
    }

    return {
      dealer: {
        name: dealership.name,
        location: `${dealership.city}, ${dealership.state_code}`,
        type: dealership.franchise_type
      },
      scores,
      critical_issues: this.generateIssues(scores),
      opportunities: this.generateOpportunities(scores),
      competitive_position: {
        market_rank: Math.floor(Math.random() * 20) + 1,
        vs_average: Math.random() > 0.5 ? 'above' : 'below',
        top_competitor: 'Market Leader'
      },
      roi_projection: this.calculateROI(scores),
      analysis_metadata: {
        job_type: jobType,
        generated_at: new Date().toISOString(),
        dealership_id: dealership.id
      }
    }
  }

  private getBaseScoresByFranchiseType(franchiseType: string): Record<string, number> {
    const baseScores = {
      franchise: { ai_visibility: 68, seo_performance: 72, aeo_readiness: 65, geo_optimization: 61, schema_integrity: 70, review_strength: 74 },
      independent: { ai_visibility: 45, seo_performance: 52, aeo_readiness: 43, geo_optimization: 38, schema_integrity: 48, review_strength: 58 },
      luxury: { ai_visibility: 78, seo_performance: 82, aeo_readiness: 76, geo_optimization: 71, schema_integrity: 85, review_strength: 88 }
    }
    return baseScores[franchiseType] || baseScores.independent
  }

  private getBrandMultiplier(brands: string[]): number {
    const luxuryBrands = ['Lexus', 'Mercedes', 'BMW', 'Audi', 'Cadillac', 'Infiniti', 'Acura']
    const premiumBrands = ['Toyota', 'Honda', 'Nissan', 'Subaru', 'Mazda']

    if (brands.some(brand => luxuryBrands.includes(brand))) return 1.15
    if (brands.some(brand => premiumBrands.includes(brand))) return 1.05
    return 0.95
  }

  private getMarketMultiplier(stateCode: string): number {
    const highCompetitionStates = ['CA', 'TX', 'FL', 'NY']
    const mediumCompetitionStates = ['GA', 'NC', 'SC', 'TN', 'AZ']

    if (highCompetitionStates.includes(stateCode)) return 1.1
    if (mediumCompetitionStates.includes(stateCode)) return 1.0
    return 0.9
  }

  private generateIssues(scores: Record<string, number>): any[] {
    const issues = []
    Object.entries(scores).forEach(([category, score]) => {
      if (score < 60) {
        issues.push({
          severity: score < 40 ? 'critical' : score < 50 ? 'high' : 'medium',
          category: category.replace('_', ' ').toUpperCase(),
          issue: `${category} performance below market standards`,
          impact: `Potential revenue impact in ${category}`,
          fix: `Implement ${category} optimization protocols`
        })
      }
    })
    return issues.slice(0, 5) // Limit to top 5 issues
  }

  private generateOpportunities(scores: Record<string, number>): any[] {
    return [
      {
        score: Math.max(...Object.values(scores)) + 10,
        title: 'AI Voice Search Optimization',
        monthly_value: Math.round(Math.random() * 15000 + 5000)
      },
      {
        score: Math.max(...Object.values(scores)) + 5,
        title: 'Local Schema Enhancement',
        monthly_value: Math.round(Math.random() * 10000 + 3000)
      }
    ]
  }

  private calculateROI(scores: Record<string, number>): any {
    const avgScore = Object.values(scores).reduce((a, b) => a + b) / Object.keys(scores).length
    const gapToIdeal = 100 - avgScore

    return {
      monthly_at_risk: Math.round(gapToIdeal * 2500),
      potential_recovery: Math.round(gapToIdeal * 1800),
      implementation_cost: 299,
      payback_days: Math.ceil(299 / (gapToIdeal * 60))
    }
  }

  private async storeAnalysisResult(dealershipId: string, analysisData: any): Promise<void> {
    try {
      await db.query(`
        INSERT INTO ai_analysis_results (
          dealership_id, analysis_date,
          ai_visibility_score, seo_performance_score, aeo_readiness_score,
          geo_optimization_score, schema_integrity_score, review_strength_score,
          market_rank, competitive_visibility_ratio,
          monthly_revenue_at_risk, potential_monthly_recovery,
          implementation_cost, projected_payback_days,
          critical_issues, opportunities,
          analysis_type, data_freshness_score, confidence_score
        ) VALUES (
          $1, NOW(), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
        )
      `, [
        dealershipId,
        analysisData.scores.ai_visibility,
        analysisData.scores.seo_performance,
        analysisData.scores.aeo_readiness,
        analysisData.scores.geo_optimization,
        analysisData.scores.schema_integrity,
        analysisData.scores.review_strength,
        analysisData.competitive_position.market_rank,
        1.0, // competitive_visibility_ratio placeholder
        analysisData.roi_projection.monthly_at_risk,
        analysisData.roi_projection.potential_recovery,
        analysisData.roi_projection.implementation_cost,
        analysisData.roi_projection.payback_days,
        JSON.stringify(analysisData.critical_issues),
        JSON.stringify(analysisData.opportunities),
        'bulk_analysis',
        95, // data_freshness_score
        90  // confidence_score
      ])
    } catch (error) {
      logger.error({ error, dealershipId }, 'Failed to store analysis result')
    }
  }

  private async updateJobProgress(jobId: string, progress: Partial<JobProgress>): Promise<void> {
    const updates = []
    const values = []
    let paramIndex = 1

    if (progress.completed_dealerships !== undefined) {
      updates.push(`completed_dealerships = $${paramIndex++}`)
      values.push(progress.completed_dealerships)
    }

    if (progress.failed_dealerships !== undefined) {
      updates.push(`failed_dealerships = $${paramIndex++}`)
      values.push(progress.failed_dealerships)
    }

    if (progress.errors && progress.errors.length > 0) {
      updates.push(`error_log = $${paramIndex++}`)
      values.push(progress.errors)
    }

    if (updates.length > 0) {
      updates.push(`updated_at = NOW()`)
      values.push(jobId)

      await db.query(`
        UPDATE bulk_analysis_jobs
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
      `, values)
    }
  }

  private async rateLimitDelay(jobType: string): Promise<void> {
    const delays = {
      full_analysis: 1000,    // 1 second
      quick_refresh: 100,     // 100ms
      competitive_scan: 500,  // 500ms
      market_analysis: 2000   // 2 seconds
    }

    const delay = delays[jobType] || 500
    await new Promise(resolve => setTimeout(resolve, delay))
  }

  /**
   * Get job status and progress
   */
  async getJobStatus(jobId: string): Promise<any> {
    const result = await db.query(`
      SELECT * FROM bulk_analysis_jobs WHERE id = $1
    `, [jobId])

    if (result.rows.length === 0) {
      throw new Error('Job not found')
    }

    const job = result.rows[0]

    // Get queue status if job is running
    let queueStatus = null
    if (job.status === 'running' || job.status === 'pending') {
      // This would check the actual queue status
      queueStatus = {
        waiting: await this.analysisQueue.getWaiting(),
        active: await this.analysisQueue.getActive(),
        completed: await this.analysisQueue.getCompleted(),
        failed: await this.analysisQueue.getFailed()
      }
    }

    return {
      ...job,
      queue_status: queueStatus,
      progress_percentage: job.total_dealerships > 0
        ? Math.round((job.completed_dealerships / job.total_dealerships) * 100)
        : 0
    }
  }

  /**
   * Cancel a running job
   */
  async cancelJob(jobId: string): Promise<void> {
    // Update database status
    await db.query(`
      UPDATE bulk_analysis_jobs
      SET status = 'cancelled', updated_at = NOW()
      WHERE id = $1 AND status IN ('pending', 'running')
    `, [jobId])

    // Remove pending jobs from queues
    // This would require more sophisticated job tracking
    logger.info({ jobId }, 'Job cancellation requested')
  }

  /**
   * Get enterprise-wide job statistics
   */
  async getJobStatistics(timeframe: 'day' | 'week' | 'month' = 'week'): Promise<any> {
    const interval = timeframe === 'day' ? '1 day' : timeframe === 'week' ? '7 days' : '30 days'

    const result = await db.query(`
      SELECT
        COUNT(*) as total_jobs,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_jobs,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_jobs,
        COUNT(CASE WHEN status = 'running' THEN 1 END) as running_jobs,
        SUM(total_dealerships) as total_dealerships_processed,
        SUM(completed_dealerships) as total_completed_dealerships,
        AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_job_duration_seconds
      FROM bulk_analysis_jobs
      WHERE created_at > NOW() - INTERVAL '${interval}'
    `, [])

    return result.rows[0]
  }
}

export const bulkAnalysisPipeline = new BulkAnalysisPipeline()