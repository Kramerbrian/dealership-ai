import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { bulkAnalysisPipeline } from '@/lib/enterprise/bulk-analysis-pipeline'
import { db } from '@/lib/db'

const logger = createLogger('cron-bulk-refresh')

/**
 * Morning Bulk Refresh for High-Priority Dealerships
 * Runs at 10 AM daily to refresh analysis for critical dealerships
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Verify cron authentication
    if (request.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
      logger.warn('Unauthorized cron request for bulk refresh')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    logger.info('Starting morning bulk refresh for high-priority dealerships')

    // Identify high-priority dealerships that need refresh
    const highPriorityDealerships = await identifyHighPriorityDealerships()

    // Identify stale dealerships (not analyzed in 24+ hours)
    const staleDealerships = await identifyStaleDealerships()

    // Combine and deduplicate
    const dealershipsToRefresh = [...new Set([
      ...highPriorityDealerships.map(d => d.id),
      ...staleDealerships.map(d => d.id)
    ])]

    if (dealershipsToRefresh.length === 0) {
      logger.info('No dealerships require refresh at this time')
      return NextResponse.json({
        success: true,
        message: 'No dealerships require refresh',
        dealerships_checked: highPriorityDealerships.length + staleDealerships.length
      })
    }

    // Create bulk analysis job
    const jobId = await bulkAnalysisPipeline.submitBulkAnalysis({
      job_name: `Daily Bulk Refresh - ${new Date().toISOString().split('T')[0]}`,
      job_type: 'quick_refresh',
      dealership_ids: dealershipsToRefresh,
      analysis_params: {
        include_competitive: true,
        include_historical: false,
        force_fresh_data: false,
        max_age_hours: 8 // Refresh if older than 8 hours
      },
      priority: 500, // High priority
      created_by: 'cron-bulk-refresh'
    })

    const executionTime = Date.now() - startTime

    logger.info({
      job_id: jobId,
      dealerships_to_refresh: dealershipsToRefresh.length,
      high_priority_count: highPriorityDealerships.length,
      stale_count: staleDealerships.length,
      execution_time_ms: executionTime
    }, 'Bulk refresh job submitted successfully')

    return NextResponse.json({
      success: true,
      message: 'Bulk refresh job submitted',
      job_id: jobId,
      dealerships_to_refresh: dealershipsToRefresh.length,
      breakdown: {
        high_priority: highPriorityDealerships.length,
        stale: staleDealerships.length,
        total_unique: dealershipsToRefresh.length
      },
      execution_time_ms: executionTime,
      estimated_completion: new Date(Date.now() + (dealershipsToRefresh.length * 10 * 1000)).toISOString()
    })

  } catch (error) {
    const executionTime = Date.now() - startTime
    logger.error({ error, execution_time_ms: executionTime }, 'Bulk refresh cron job failed')

    return NextResponse.json({
      success: false,
      error: 'Failed to execute bulk refresh',
      execution_time_ms: executionTime
    }, { status: 500 })
  }
}

async function identifyHighPriorityDealerships() {
  // High-priority: luxury brands, large dealer groups, recent issues
  const result = await db.query(`
    SELECT DISTINCT d.id, d.name, d.primary_domain, d.brands, d.franchise_type,
           ar.ai_visibility_score, ar.analysis_date
    FROM dealerships d
    LEFT JOIN current_dealership_analysis ar ON d.id = ar.dealership_id
    WHERE d.status = 'active'
      AND (
        -- Luxury brands
        d.brands && ARRAY['Lexus', 'Mercedes', 'BMW', 'Audi', 'Cadillac', 'Infiniti', 'Acura']
        OR
        -- Poor recent performance
        (ar.ai_visibility_score < 60 AND ar.analysis_date >= NOW() - INTERVAL '3 days')
        OR
        -- Large dealer groups (more than 50 rooftops)
        d.dealership_group_id IN (
          SELECT dg.id
          FROM dealership_groups dg
          JOIN dealerships d2 ON dg.id = d2.dealership_group_id
          WHERE d2.status = 'active'
          GROUP BY dg.id
          HAVING COUNT(d2.id) >= 50
        )
      )
    ORDER BY
      CASE WHEN d.brands && ARRAY['Lexus', 'Mercedes', 'BMW', 'Audi'] THEN 1 ELSE 2 END,
      ar.ai_visibility_score ASC NULLS LAST
    LIMIT 500
  `)

  return result.rows
}

async function identifyStaleDealerships() {
  // Dealerships not analyzed in the last 24 hours
  const result = await db.query(`
    SELECT d.id, d.name, d.primary_domain, d.last_analysis_at
    FROM dealerships d
    WHERE d.status = 'active'
      AND (
        d.last_analysis_at IS NULL
        OR d.last_analysis_at < NOW() - INTERVAL '24 hours'
      )
    ORDER BY d.last_analysis_at ASC NULLS FIRST
    LIMIT 300
  `)

  return result.rows
}

// Additional endpoint for manual bulk refresh trigger
export async function POST(request: NextRequest) {
  try {
    // Verify cron authentication
    if (request.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { dealership_ids, job_name } = await request.json()

    if (!dealership_ids || !Array.isArray(dealership_ids)) {
      return NextResponse.json({ error: 'dealership_ids array is required' }, { status: 400 })
    }

    const jobId = await bulkAnalysisPipeline.submitBulkAnalysis({
      job_name: job_name || `Manual Bulk Refresh - ${new Date().toISOString()}`,
      job_type: 'quick_refresh',
      dealership_ids,
      analysis_params: {
        include_competitive: true,
        include_historical: false,
        force_fresh_data: false,
        max_age_hours: 4
      },
      priority: 300,
      created_by: 'cron-manual-trigger'
    })

    return NextResponse.json({
      success: true,
      job_id: jobId,
      dealerships_queued: dealership_ids.length
    })

  } catch (error) {
    logger.error({ error }, 'Manual bulk refresh trigger failed')
    return NextResponse.json({ error: 'Failed to trigger manual refresh' }, { status: 500 })
  }
}