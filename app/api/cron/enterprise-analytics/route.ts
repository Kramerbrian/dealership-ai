import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { db } from '@/lib/db'

const logger = createLogger('cron-enterprise-analytics')

/**
 * Daily Enterprise Analytics Aggregation
 * Runs at 6 AM daily to aggregate analytics for 5000+ dealerships
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Verify cron authentication
    if (request.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
      logger.warn({ headers: Object.fromEntries(request.headers.entries()) }, 'Unauthorized cron request')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    logger.info('Starting daily enterprise analytics aggregation for 5000+ dealerships')

    // Update enterprise dashboard statistics
    const dashboardStats = await updateEnterpriseDashboardStats()

    // Aggregate dealership group performance
    const groupPerformance = await aggregateDealershipGroupPerformance()

    // Update geographic market insights
    const marketInsights = await updateGeographicMarketInsights()

    // Calculate competitive positioning trends
    const competitiveTrends = await calculateCompetitiveTrends()

    // Store aggregated metrics
    await storeAggregatedMetrics({
      dashboard_stats: dashboardStats,
      group_performance: groupPerformance,
      market_insights: marketInsights,
      competitive_trends: competitiveTrends,
      generated_at: new Date().toISOString()
    })

    const executionTime = Date.now() - startTime

    logger.info({
      execution_time_ms: executionTime,
      dealership_groups: groupPerformance.length,
      geographic_markets: marketInsights.length
    }, 'Enterprise analytics aggregation completed')

    return NextResponse.json({
      success: true,
      message: 'Enterprise analytics aggregation completed',
      execution_time_ms: executionTime,
      metrics: {
        total_dealerships: dashboardStats.total_dealerships,
        dealership_groups: groupPerformance.length,
        geographic_markets: marketInsights.length,
        active_jobs: dashboardStats.running_jobs
      }
    })

  } catch (error) {
    const executionTime = Date.now() - startTime
    logger.error({ error, execution_time_ms: executionTime }, 'Enterprise analytics aggregation failed')

    return NextResponse.json({
      success: false,
      error: 'Failed to run enterprise analytics aggregation',
      execution_time_ms: executionTime
    }, { status: 500 })
  }
}

async function updateEnterpriseDashboardStats() {
  const result = await db.query(`
    SELECT
      COUNT(DISTINCT d.id) as total_dealerships,
      COUNT(DISTINCT d.id) FILTER (WHERE d.status = 'active') as active_dealerships,
      AVG(ar.ai_visibility_score) as avg_ai_visibility,
      COUNT(DISTINCT d.id) FILTER (WHERE ar.ai_visibility_score >= 80) as high_performers,
      COUNT(DISTINCT d.id) FILTER (WHERE ar.ai_visibility_score < 50) as underperformers,
      SUM(ar.monthly_revenue_at_risk) as total_revenue_at_risk,
      SUM(ar.potential_monthly_recovery) as total_opportunity,
      COUNT(DISTINCT gm.id) as markets_covered,
      COUNT(DISTINCT baj.id) FILTER (WHERE baj.status = 'running') as running_jobs
    FROM dealerships d
    LEFT JOIN current_dealership_analysis ar ON d.id = ar.dealership_id
    LEFT JOIN geographic_markets gm ON d.geographic_market_id = gm.id
    LEFT JOIN bulk_analysis_jobs baj ON baj.status = 'running'
    WHERE d.status = 'active'
  `)

  return result.rows[0]
}

async function aggregateDealershipGroupPerformance() {
  const result = await db.query(`
    SELECT
      dg.id,
      dg.name,
      dg.type,
      COUNT(DISTINCT d.id) as total_rooftops,
      COUNT(DISTINCT d.geographic_market_id) as markets_covered,
      AVG(ar.ai_visibility_score) as avg_ai_visibility,
      COUNT(DISTINCT d.id) FILTER (WHERE ar.ai_visibility_score >= 80) as high_performers,
      COUNT(DISTINCT d.id) FILTER (WHERE ar.ai_visibility_score < 50) as underperformers,
      SUM(ar.monthly_revenue_at_risk) as total_revenue_at_risk,
      SUM(ar.potential_monthly_recovery) as total_opportunity,
      AVG(ar.market_rank) as avg_market_rank
    FROM dealership_groups dg
    JOIN dealerships d ON dg.id = d.dealership_group_id
    LEFT JOIN current_dealership_analysis ar ON d.id = ar.dealership_id
    WHERE d.status = 'active'
    GROUP BY dg.id, dg.name, dg.type
    ORDER BY total_rooftops DESC
  `)

  return result.rows
}

async function updateGeographicMarketInsights() {
  const result = await db.query(`
    SELECT
      gm.id,
      gm.name,
      gm.market_code,
      gm.state_code,
      COUNT(DISTINCT d.id) as total_dealerships,
      AVG(ar.ai_visibility_score) as avg_ai_visibility,
      SUM(ar.monthly_revenue_at_risk) as total_revenue_at_risk,
      SUM(ar.potential_monthly_recovery) as total_recovery_potential,
      (
        SELECT d2.name
        FROM dealerships d2
        JOIN current_dealership_analysis ar2 ON d2.id = ar2.dealership_id
        WHERE d2.geographic_market_id = gm.id
        ORDER BY ar2.ai_visibility_score DESC
        LIMIT 1
      ) as market_leader
    FROM geographic_markets gm
    LEFT JOIN dealerships d ON gm.id = d.geographic_market_id
    LEFT JOIN current_dealership_analysis ar ON d.id = ar.dealership_id
    WHERE d.status = 'active'
    GROUP BY gm.id, gm.name, gm.market_code, gm.state_code
    HAVING COUNT(DISTINCT d.id) > 0
    ORDER BY avg_ai_visibility DESC
  `)

  return result.rows
}

async function calculateCompetitiveTrends() {
  // This would typically analyze trends over time
  const result = await db.query(`
    SELECT
      DATE_TRUNC('week', ar.analysis_date) as week,
      AVG(ar.ai_visibility_score) as avg_visibility,
      AVG(ar.market_rank) as avg_market_rank,
      COUNT(*) as analysis_count
    FROM ai_analysis_results ar
    JOIN dealerships d ON ar.dealership_id = d.id
    WHERE ar.analysis_date >= NOW() - INTERVAL '4 weeks'
      AND d.status = 'active'
    GROUP BY DATE_TRUNC('week', ar.analysis_date)
    ORDER BY week DESC
  `)

  return result.rows
}

async function storeAggregatedMetrics(metrics: any) {
  // Store in a dedicated analytics table for fast dashboard loading
  await db.query(`
    INSERT INTO enterprise_analytics_cache (
      cache_key, cache_data, expires_at, created_at
    ) VALUES (
      'daily_enterprise_metrics', $1, NOW() + INTERVAL '25 hours', NOW()
    )
    ON CONFLICT (cache_key)
    DO UPDATE SET
      cache_data = $1,
      expires_at = NOW() + INTERVAL '25 hours',
      created_at = NOW()
  `, [JSON.stringify(metrics)])
}