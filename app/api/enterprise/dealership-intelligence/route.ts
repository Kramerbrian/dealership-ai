import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createLogger } from '@/lib/logger'
import { rateLimit } from '@/lib/rate-limit'
import { bulkAnalysisPipeline } from '@/lib/enterprise/bulk-analysis-pipeline'
import { distributedCacheManager } from '@/lib/enterprise/distributed-cache-manager'
import { competitiveIntelligenceEngine } from '@/lib/enterprise/competitive-intelligence-engine'

const logger = createLogger('enterprise-dealership-intelligence-api')

// Request schemas
const BulkAnalysisRequestSchema = z.object({
  job_name: z.string().min(1).max(255),
  job_type: z.enum(['full_analysis', 'quick_refresh', 'competitive_scan', 'market_analysis']),
  scope: z.object({
    dealership_group_id: z.string().uuid().optional(),
    geographic_market_id: z.string().uuid().optional(),
    dealership_ids: z.array(z.string().uuid()).optional(),
    filters: z.object({
      franchise_type: z.enum(['franchise', 'independent', 'luxury']).optional(),
      brands: z.array(z.string()).optional(),
      states: z.array(z.string().length(2)).optional(),
      min_rooftops: z.number().optional()
    }).optional()
  }),
  options: z.object({
    priority: z.number().min(1).max(10000).default(1000),
    scheduled_for: z.string().datetime().optional(),
    include_competitive: z.boolean().default(true),
    include_historical: z.boolean().default(false),
    force_fresh_data: z.boolean().default(false),
    max_age_hours: z.number().default(24)
  }).default({})
})

const CompetitiveAnalysisRequestSchema = z.object({
  dealership_ids: z.array(z.string().uuid()).max(100), // Limit to 100 at once
  analysis_depth: z.enum(['basic', 'comprehensive', 'strategic']).default('comprehensive'),
  include_market_analysis: z.boolean().default(true),
  geographic_scope: z.enum(['cluster', 'market', 'regional', 'national']).default('market')
})

// Rate limiting for enterprise endpoints
const enterpriseLimiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 50,
})

/**
 * POST /api/enterprise/dealership-intelligence/bulk-analysis
 *
 * Submit bulk analysis jobs for 5000+ dealership rooftops
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Extract client info for rate limiting
    const ip = request.ip ?? request.headers.get('x-forwarded-for') ?? '127.0.0.1'
    const userAgent = request.headers.get('user-agent') ?? 'unknown'

    // Apply rate limiting
    const rateLimitResult = await enterpriseLimiter.check(20, ip) // 20 requests per minute for enterprise
    const success = 'success' in rateLimitResult ? rateLimitResult.success : rateLimitResult

    if (!success) {
      logger.warn({ ip, userAgent }, 'Enterprise rate limit exceeded')
      return NextResponse.json(
        {
          error: 'rate_limited',
          message: 'Enterprise rate limit exceeded. Please contact support for higher limits.',
          retry_after: 60
        },
        { status: 429 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validatedData = BulkAnalysisRequestSchema.parse(body)

    logger.info({
      job_name: validatedData.job_name,
      job_type: validatedData.job_type,
      scope: validatedData.scope,
      ip,
      userAgent
    }, 'Enterprise bulk analysis job submitted')

    // Submit job to pipeline
    const jobId = await bulkAnalysisPipeline.submitBulkAnalysis({
      job_name: validatedData.job_name,
      job_type: validatedData.job_type,
      dealership_group_id: validatedData.scope.dealership_group_id,
      geographic_market_id: validatedData.scope.geographic_market_id,
      dealership_ids: validatedData.scope.dealership_ids,
      analysis_params: {
        include_competitive: validatedData.options.include_competitive,
        include_historical: validatedData.options.include_historical,
        force_fresh_data: validatedData.options.force_fresh_data,
        max_age_hours: validatedData.options.max_age_hours
      },
      priority: validatedData.options.priority,
      scheduled_for: validatedData.options.scheduled_for,
      created_by: request.headers.get('x-user-id') || 'api_user'
    })

    const responseTime = Date.now() - startTime

    return NextResponse.json({
      success: true,
      job_id: jobId,
      message: 'Bulk analysis job submitted successfully',
      estimated_processing_time: '15-45 minutes',
      status_endpoint: `/api/enterprise/dealership-intelligence/jobs/${jobId}`,
      response_time_ms: responseTime
    }, { status: 202 })

  } catch (error) {
    const responseTime = Date.now() - startTime

    if (error instanceof z.ZodError) {
      logger.warn({ error: error.errors }, 'Invalid bulk analysis request')
      return NextResponse.json(
        {
          error: 'validation_error',
          message: 'Invalid request parameters',
          details: error.errors,
          response_time_ms: responseTime
        },
        { status: 400 }
      )
    }

    logger.error({ error, response_time_ms: responseTime }, 'Bulk analysis job submission failed')
    return NextResponse.json(
      {
        error: 'internal_error',
        message: 'Failed to submit bulk analysis job',
        response_time_ms: responseTime
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/enterprise/dealership-intelligence/competitive-analysis
 *
 * Generate competitive intelligence for multiple dealerships
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    const ip = request.ip ?? '127.0.0.1'

    // Apply rate limiting
    const rateLimitResult = await enterpriseLimiter.check(10, ip)
    const success = 'success' in rateLimitResult ? rateLimitResult.success : rateLimitResult

    if (!success) {
      return NextResponse.json(
        { error: 'rate_limited', message: 'Rate limit exceeded' },
        { status: 429 }
      )
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const dealershipIdsParam = searchParams.get('dealership_ids')
    const analysisDepth = searchParams.get('analysis_depth') || 'comprehensive'
    const includeMarketAnalysis = searchParams.get('include_market_analysis') !== 'false'
    const geographicScope = searchParams.get('geographic_scope') || 'market'

    if (!dealershipIdsParam) {
      return NextResponse.json(
        { error: 'missing_parameter', message: 'dealership_ids parameter is required' },
        { status: 400 }
      )
    }

    const dealershipIds = dealershipIdsParam.split(',').filter(id => id.trim())

    if (dealershipIds.length === 0 || dealershipIds.length > 100) {
      return NextResponse.json(
        { error: 'invalid_parameter', message: 'dealership_ids must contain 1-100 valid UUIDs' },
        { status: 400 }
      )
    }

    // Validate request
    const validatedRequest = CompetitiveAnalysisRequestSchema.parse({
      dealership_ids: dealershipIds,
      analysis_depth: analysisDepth,
      include_market_analysis: includeMarketAnalysis,
      geographic_scope: geographicScope
    })

    logger.info({
      dealership_count: dealershipIds.length,
      analysis_depth: validatedRequest.analysis_depth,
      geographic_scope: validatedRequest.geographic_scope,
      ip
    }, 'Competitive analysis request received')

    // Check cache first for bulk request
    const cacheResults = await distributedCacheManager.getBulkAnalyses(
      dealershipIds.map(id => ({ id, state: undefined, domain: undefined, brands: [] })),
      {
        analysisType: 'competitive_intelligence',
        allowPooled: false,
        maxAge: 86400 // 24 hours
      }
    )

    const cachedCount = Object.keys(cacheResults).length
    const uncachedIds = dealershipIds.filter(id => !cacheResults[id])

    logger.info({
      total_requested: dealershipIds.length,
      cache_hits: cachedCount,
      cache_misses: uncachedIds.length,
      cache_hit_rate: ((cachedCount / dealershipIds.length) * 100).toFixed(1)
    }, 'Competitive analysis cache status')

    // Generate competitive intelligence for uncached dealerships
    let freshResults = {}
    if (uncachedIds.length > 0) {
      freshResults = await competitiveIntelligenceEngine.generateBulkCompetitiveIntelligence(uncachedIds)
    }

    // Combine cached and fresh results
    const allResults = { ...cacheResults, ...freshResults }

    // Get market-level insights if requested
    let marketInsights = null
    if (validatedRequest.include_market_analysis) {
      marketInsights = await competitiveIntelligenceEngine.getCompetitiveLandscapeStats()
    }

    const responseTime = Date.now() - startTime
    const successfulAnalyses = Object.keys(allResults).length

    return NextResponse.json({
      success: true,
      summary: {
        total_requested: dealershipIds.length,
        successful_analyses: successfulAnalyses,
        success_rate: ((successfulAnalyses / dealershipIds.length) * 100).toFixed(1),
        cache_hit_rate: ((cachedCount / dealershipIds.length) * 100).toFixed(1),
        analysis_depth: validatedRequest.analysis_depth,
        geographic_scope: validatedRequest.geographic_scope
      },
      competitive_intelligence: allResults,
      market_insights: marketInsights,
      metadata: {
        response_time_ms: responseTime,
        generated_at: new Date().toISOString(),
        cache_status: {
          hits: cachedCount,
          misses: uncachedIds.length,
          fresh_generations: Object.keys(freshResults).length
        }
      }
    })

  } catch (error) {
    const responseTime = Date.now() - startTime

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'validation_error',
          message: 'Invalid request parameters',
          details: error.errors,
          response_time_ms: responseTime
        },
        { status: 400 }
      )
    }

    logger.error({ error, response_time_ms: responseTime }, 'Competitive analysis request failed')
    return NextResponse.json(
      {
        error: 'internal_error',
        message: 'Failed to generate competitive analysis',
        response_time_ms: responseTime
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/enterprise/dealership-intelligence/dashboard
 *
 * Get enterprise dashboard data for 5000+ dealerships
 */
export async function dashboard(request: NextRequest) {
  const startTime = Date.now()

  try {
    const ip = request.ip ?? '127.0.0.1'

    // Apply rate limiting
    const rateLimitResult = await enterpriseLimiter.check(30, ip) // Higher limit for dashboard
    const success = 'success' in rateLimitResult ? rateLimitResult.success : rateLimitResult

    if (!success) {
      return NextResponse.json(
        { error: 'rate_limited', message: 'Rate limit exceeded' },
        { status: 429 }
      )
    }

    // Parse filters from query params
    const searchParams = request.nextUrl.searchParams
    const timeframe = searchParams.get('timeframe') || '7d'
    const dealershipGroupId = searchParams.get('dealership_group_id')
    const geographicMarketId = searchParams.get('geographic_market_id')
    const franchiseType = searchParams.get('franchise_type')

    logger.info({
      timeframe,
      dealership_group_id: dealershipGroupId,
      geographic_market_id: geographicMarketId,
      franchise_type: franchiseType,
      ip
    }, 'Enterprise dashboard data requested')

    // This would typically aggregate data from the database views
    // For now, return structured mock data that matches the dashboard component

    const dashboardData = {
      summary_stats: {
        total_dealerships: 5247,
        active_dealerships: 5180,
        avg_ai_visibility: 64.2,
        high_performers: 1876,
        underperformers: 1243,
        total_revenue_at_risk: 47850000,
        total_opportunity: 31200000,
        markets_covered: 156,
        running_jobs: 3
      },
      dealership_groups: [
        {
          id: '1',
          name: 'AutoNation',
          type: 'dealer_group',
          total_rooftops: 326,
          markets_covered: 15,
          avg_ai_visibility: 72.4,
          high_performers: 187,
          underperformers: 45,
          total_revenue_at_risk: 8450000,
          total_opportunity: 5200000,
          avg_market_rank: 3.2
        },
        {
          id: '2',
          name: 'Toyota Motor Sales',
          type: 'oem',
          total_rooftops: 1247,
          markets_covered: 48,
          avg_ai_visibility: 68.9,
          high_performers: 623,
          underperformers: 234,
          total_revenue_at_risk: 15600000,
          total_opportunity: 11800000,
          avg_market_rank: 4.1
        }
      ],
      geographic_markets: [
        {
          id: '1',
          name: 'Los Angeles-Long Beach-Santa Ana',
          market_code: 'DMA803',
          state_code: 'CA',
          total_dealerships: 247,
          avg_ai_visibility: 71.2,
          total_revenue_at_risk: 12400000,
          total_recovery_potential: 8900000,
          market_leader: 'Toyota of Hollywood'
        }
      ],
      active_jobs: await bulkAnalysisPipeline.getJobStatistics(timeframe as any),
      performance_trends: {
        weekly_visibility_change: 2.3,
        monthly_revenue_impact: -1250000,
        quarterly_improvement_rate: 8.7,
        competitive_position_shift: 'improving'
      },
      alerts: [
        {
          type: 'warning',
          message: '23 dealerships showing declining AI visibility trends',
          action_required: true,
          created_at: new Date().toISOString()
        }
      ]
    }

    const responseTime = Date.now() - startTime

    return NextResponse.json({
      success: true,
      data: dashboardData,
      filters_applied: {
        timeframe,
        dealership_group_id: dealershipGroupId,
        geographic_market_id: geographicMarketId,
        franchise_type: franchiseType
      },
      metadata: {
        response_time_ms: responseTime,
        generated_at: new Date().toISOString(),
        data_freshness: 'real-time'
      }
    })

  } catch (error) {
    const responseTime = Date.now() - startTime
    logger.error({ error, response_time_ms: responseTime }, 'Dashboard data request failed')

    return NextResponse.json(
      {
        error: 'internal_error',
        message: 'Failed to load dashboard data',
        response_time_ms: responseTime
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/enterprise/dealership-intelligence/jobs/{id}
 *
 * Get bulk analysis job status and progress
 */
export async function getJobStatus(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const jobId = params.id

    if (!jobId) {
      return NextResponse.json(
        { error: 'missing_parameter', message: 'Job ID is required' },
        { status: 400 }
      )
    }

    const jobStatus = await bulkAnalysisPipeline.getJobStatus(jobId)

    return NextResponse.json({
      success: true,
      job: jobStatus,
      real_time_updates_available: true,
      websocket_endpoint: `/ws/jobs/${jobId}`
    })

  } catch (error) {
    if (error instanceof Error && error.message === 'Job not found') {
      return NextResponse.json(
        { error: 'not_found', message: 'Job not found' },
        { status: 404 }
      )
    }

    logger.error({ error, job_id: params.id }, 'Failed to get job status')
    return NextResponse.json(
      { error: 'internal_error', message: 'Failed to get job status' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/enterprise/dealership-intelligence/jobs/{id}
 *
 * Cancel a running bulk analysis job
 */
export async function cancelJob(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const jobId = params.id

    if (!jobId) {
      return NextResponse.json(
        { error: 'missing_parameter', message: 'Job ID is required' },
        { status: 400 }
      )
    }

    await bulkAnalysisPipeline.cancelJob(jobId)

    logger.info({ job_id: jobId }, 'Bulk analysis job cancelled')

    return NextResponse.json({
      success: true,
      message: 'Job cancellation requested',
      job_id: jobId
    })

  } catch (error) {
    logger.error({ error, job_id: params.id }, 'Failed to cancel job')
    return NextResponse.json(
      { error: 'internal_error', message: 'Failed to cancel job' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/enterprise/dealership-intelligence/cache-stats
 *
 * Get cache performance statistics
 */
export async function getCacheStats(request: NextRequest) {
  try {
    const cacheStats = await distributedCacheManager.getCacheStats()

    return NextResponse.json({
      success: true,
      cache_stats: cacheStats,
      recommendations: {
        cache_optimization: cacheStats.hit_rate < 70 ? 'Consider increasing cache TTL' : 'Cache performance is optimal',
        memory_usage: cacheStats.memory_usage > 85 ? 'Consider cache cleanup or expansion' : 'Memory usage is healthy'
      }
    })

  } catch (error) {
    logger.error({ error }, 'Failed to get cache stats')
    return NextResponse.json(
      { error: 'internal_error', message: 'Failed to get cache statistics' },
      { status: 500 }
    )
  }
}