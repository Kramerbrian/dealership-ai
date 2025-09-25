import { NextRequest, NextResponse } from 'next/server'
import { dealershipIntelligenceClient } from '@/lib/dealership-intelligence-client'
import { rateLimit } from '@/lib/rate-limit'
import { createLogger } from '@/lib/logger'

const logger = createLogger('dealership-intelligence-api')

// Rate limiting for the endpoint
const limiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 200,
})

/**
 * GET /api/dealership-intelligence
 *
 * Analyzes dealership AI visibility and digital presence
 *
 * Query Parameters:
 * - domain: string (required) - Dealership website domain or business name
 * - quick: boolean (optional) - Return cached results only for faster response
 * - format: 'json' | 'report' (optional) - Response format (default: 'json')
 */
export async function GET(request: NextRequest) {
  try {
    // Extract client IP for rate limiting
    const ip = request.ip ?? request.headers.get('x-forwarded-for') ?? '127.0.0.1'

    // Apply rate limiting
    const rateLimitResult = await limiter.check(10, ip)
    const success = typeof rateLimitResult === 'object' && 'success' in rateLimitResult
      ? rateLimitResult.success
      : Boolean(rateLimitResult)

    if (!success) {
      logger.warn({ ip }, 'Rate limit exceeded')
      return NextResponse.json(
        {
          error: 'rate_limited',
          message: 'Too many requests. Please try again later.',
          retry_after: 60
        },
        { status: 429 }
      )
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const domain = searchParams.get('domain')
    const quick = searchParams.get('quick') === 'true'
    const format = searchParams.get('format') || 'json'

    // Validate required parameters
    if (!domain) {
      return NextResponse.json(
        {
          error: 'missing_parameter',
          message: 'domain parameter is required'
        },
        { status: 400 }
      )
    }

    // Validate domain format
    const domainPattern = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$/
    const isValidDomain = domainPattern.test(domain) || domain.includes('://') || !domain.includes('.')

    if (!isValidDomain && domain.length < 3) {
      return NextResponse.json(
        {
          error: 'invalid_domain',
          message: 'Please provide a valid domain name or business name'
        },
        { status: 400 }
      )
    }

    logger.info({ domain, quick, format, ip }, 'Processing dealership intelligence request')

    // Get AI analysis
    const startTime = Date.now()
    const analysis = await dealershipIntelligenceClient.getDealershipAIScore(domain, {
      quick,
      useCache: true
    })
    const responseTime = Date.now() - startTime

    logger.info({
      domain,
      responseTime,
      score: analysis.scores.ai_visibility,
      cached: 'cached' in analysis ? analysis.cached : false
    }, 'Analysis completed')

    // Format response based on requested format
    if (format === 'report') {
      const report = dealershipIntelligenceClient.generateReport(analysis)

      return NextResponse.json({
        domain,
        timestamp: new Date().toISOString(),
        response_time_ms: responseTime,
        report: {
          summary: report.summary,
          performance_breakdown: report.breakdown,
          critical_issues: report.issues,
          revenue_impact: report.revenue_impact,
          immediate_actions: report.actions
        },
        raw_data: analysis
      })
    }

    // Default JSON format compatible with existing systems
    return NextResponse.json({
      domain,
      timestamp: new Date().toISOString(),
      response_time_ms: responseTime,
      dealer: analysis.dealer,
      scores: {
        ai_visibility: analysis.scores.ai_visibility,
        seo_performance: analysis.scores.seo_performance,
        aeo_readiness: analysis.scores.aeo_readiness,
        geo_optimization: analysis.scores.geo_optimization,
        schema_integrity: analysis.scores.schema_integrity,
        review_strength: analysis.scores.review_strength
      },
      critical_issues: analysis.critical_issues,
      opportunities: analysis.opportunities,
      competitive_position: analysis.competitive_position,
      roi_projection: analysis.roi_projection
    })

  } catch (error) {
    logger.error({ error, domain: request.nextUrl.searchParams.get('domain') }, 'API request failed')

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('Rate limit exceeded')) {
        return NextResponse.json(
          {
            error: 'rate_limited',
            message: error.message
          },
          { status: 429 }
        )
      }

      if (error.message.includes('Invalid')) {
        return NextResponse.json(
          {
            error: 'validation_error',
            message: error.message
          },
          { status: 400 }
        )
      }
    }

    return NextResponse.json(
      {
        error: 'internal_error',
        message: 'An unexpected error occurred while processing your request'
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/dealership-intelligence
 *
 * Batch analysis for multiple dealerships
 */
export async function POST(request: NextRequest) {
  try {
    const ip = request.ip ?? '127.0.0.1'

    // Higher rate limit for batch requests
    const rateLimitResult = await limiter.check(5, ip)
    const success = typeof rateLimitResult === 'object' && 'success' in rateLimitResult
      ? rateLimitResult.success
      : Boolean(rateLimitResult)

    if (!success) {
      return NextResponse.json(
        { error: 'rate_limited', message: 'Rate limit exceeded' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { domains, quick = false } = body

    if (!domains || !Array.isArray(domains) || domains.length === 0) {
      return NextResponse.json(
        { error: 'invalid_request', message: 'domains array is required' },
        { status: 400 }
      )
    }

    if (domains.length > 10) {
      return NextResponse.json(
        { error: 'batch_too_large', message: 'Maximum 10 domains per batch request' },
        { status: 400 }
      )
    }

    logger.info({ domains: domains.length, quick, ip }, 'Processing batch analysis')

    // Process all domains in parallel
    const results = await Promise.allSettled(
      domains.map(async (domain: string) => {
        try {
          const analysis = await dealershipIntelligenceClient.getDealershipAIScore(domain, { quick })
          return { domain, success: true, data: analysis }
        } catch (error) {
          return { domain, success: false, error: error instanceof Error ? error.message : 'Unknown error' }
        }
      })
    )

    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length
    const failed = results.length - successful

    logger.info({ successful, failed, total: domains.length }, 'Batch analysis completed')

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      summary: {
        total: domains.length,
        successful,
        failed
      },
      results: results.map(r => r.status === 'fulfilled' ? r.value : { success: false, error: 'Processing failed' })
    })

  } catch (error) {
    logger.error({ error }, 'Batch analysis failed')
    return NextResponse.json(
      { error: 'internal_error', message: 'Batch processing failed' },
      { status: 500 }
    )
  }
}