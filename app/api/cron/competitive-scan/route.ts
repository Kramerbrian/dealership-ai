import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { competitiveIntelligenceEngine } from '@/lib/enterprise/competitive-intelligence-engine'
import { bulkAnalysisPipeline } from '@/lib/enterprise/bulk-analysis-pipeline'
import { db } from '@/lib/db'

const logger = createLogger('cron-competitive-scan')

/**
 * Weekly Competitive Intelligence Scan
 * Runs at 2 PM every Monday to analyze competitive landscapes across all markets
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Verify cron authentication
    if (request.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
      logger.warn('Unauthorized cron request for competitive scan')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    logger.info('Starting weekly competitive intelligence scan across all markets')

    // Get all active geographic markets
    const markets = await getActiveGeographicMarkets()

    // Create competitive analysis job for each major market
    const competitiveJobs = []

    for (const market of markets) {
      if (market.dealership_count >= 10) { // Focus on markets with 10+ dealerships
        try {
          const jobId = await bulkAnalysisPipeline.submitBulkAnalysis({
            job_name: `Competitive Scan - ${market.name}`,
            job_type: 'competitive_scan',
            geographic_market_id: market.id,
            analysis_params: {
              include_competitive: true,
              include_historical: true,
              force_fresh_data: false,
              max_age_hours: 168 // Week old data is acceptable for competitive analysis
            },
            priority: 800,
            created_by: 'cron-competitive-scan'
          })

          competitiveJobs.push({
            market_id: market.id,
            market_name: market.name,
            job_id: jobId,
            dealership_count: market.dealership_count
          })

        } catch (error) {
          logger.error({ error, market: market.name }, 'Failed to create competitive job for market')
        }
      }
    }

    // Update competitive landscape statistics
    const landscapeStats = await updateCompetitiveLandscapeStats()

    // Generate market trend analysis
    const marketTrends = await generateMarketTrendAnalysis()

    const executionTime = Date.now() - startTime

    logger.info({
      markets_analyzed: markets.length,
      competitive_jobs_created: competitiveJobs.length,
      execution_time_ms: executionTime
    }, 'Weekly competitive scan completed')

    return NextResponse.json({
      success: true,
      message: 'Weekly competitive scan initiated',
      execution_time_ms: executionTime,
      markets_analyzed: markets.length,
      competitive_jobs: competitiveJobs,
      landscape_stats: landscapeStats,
      market_trends: marketTrends.slice(0, 5), // Top 5 trends
      estimated_completion: new Date(Date.now() + (2 * 60 * 60 * 1000)).toISOString() // 2 hours
    })

  } catch (error) {
    const executionTime = Date.now() - startTime
    logger.error({ error, execution_time_ms: executionTime }, 'Weekly competitive scan failed')

    return NextResponse.json({
      success: false,
      error: 'Failed to execute competitive scan',
      execution_time_ms: executionTime
    }, { status: 500 })
  }
}

async function getActiveGeographicMarkets() {
  const result = await db.query(`
    SELECT
      gm.id,
      gm.name,
      gm.market_code,
      gm.state_code,
      gm.population,
      COUNT(d.id) as dealership_count,
      AVG(ar.ai_visibility_score) as avg_visibility,
      STDDEV(ar.ai_visibility_score) as visibility_variance
    FROM geographic_markets gm
    JOIN dealerships d ON gm.id = d.geographic_market_id
    LEFT JOIN current_dealership_analysis ar ON d.id = ar.dealership_id
    WHERE d.status = 'active'
    GROUP BY gm.id, gm.name, gm.market_code, gm.state_code, gm.population
    HAVING COUNT(d.id) >= 5
    ORDER BY dealership_count DESC, visibility_variance DESC
  `)

  return result.rows
}

async function updateCompetitiveLandscapeStats() {
  try {
    // Calculate overall competitive metrics
    const stats = await db.query(`
      SELECT
        COUNT(DISTINCT gm.id) as total_markets,
        COUNT(DISTINCT d.id) as total_dealerships,
        AVG(ar.ai_visibility_score) as avg_visibility_score,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ar.ai_visibility_score) as median_visibility,
        PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY ar.ai_visibility_score) as p90_visibility,
        PERCENTILE_CONT(0.1) WITHIN GROUP (ORDER BY ar.ai_visibility_score) as p10_visibility
      FROM geographic_markets gm
      JOIN dealerships d ON gm.id = d.geographic_market_id
      LEFT JOIN current_dealership_analysis ar ON d.id = ar.dealership_id
      WHERE d.status = 'active'
    `)

    // Get brand distribution analysis
    const brandDistribution = await db.query(`
      SELECT
        brand,
        COUNT(*) as dealership_count,
        AVG(ar.ai_visibility_score) as avg_visibility,
        RANK() OVER (ORDER BY AVG(ar.ai_visibility_score) DESC) as performance_rank
      FROM (
        SELECT d.id, unnest(d.brands) as brand
        FROM dealerships d
        WHERE d.status = 'active'
      ) brand_expanded
      JOIN dealerships d ON brand_expanded.id = d.id
      LEFT JOIN current_dealership_analysis ar ON d.id = ar.dealership_id
      GROUP BY brand
      HAVING COUNT(*) >= 10
      ORDER BY avg_visibility DESC
      LIMIT 20
    `)

    // Store competitive landscape stats
    await db.query(`
      INSERT INTO competitive_analyses (
        geographic_market_id, analysis_date, total_dealerships, active_dealerships,
        average_ai_visibility, market_leader_id, market_laggard_id,
        brand_performance, total_market_opportunity, untapped_opportunity_pct
      ) VALUES (
        NULL, -- Market-wide analysis
        NOW(),
        $1, $1, $2, NULL, NULL,
        $3, $4, $5
      )
    `, [
      stats.rows[0].total_dealerships,
      stats.rows[0].avg_visibility_score,
      JSON.stringify(brandDistribution.rows),
      Math.round(stats.rows[0].total_dealerships * 25000), // Estimated total opportunity
      Math.round((100 - stats.rows[0].avg_visibility_score) * 0.8) // Untapped percentage
    ])

    return {
      total_markets: stats.rows[0].total_markets,
      total_dealerships: stats.rows[0].total_dealerships,
      avg_visibility: stats.rows[0].avg_visibility_score,
      performance_spread: stats.rows[0].p90_visibility - stats.rows[0].p10_visibility,
      top_performing_brands: brandDistribution.rows.slice(0, 5).map(b => ({
        brand: b.brand,
        avg_visibility: b.avg_visibility,
        dealership_count: b.dealership_count
      }))
    }

  } catch (error) {
    logger.error({ error }, 'Failed to update competitive landscape stats')
    return { error: 'Failed to calculate competitive stats' }
  }
}

async function generateMarketTrendAnalysis() {
  try {
    const trends = await db.query(`
      WITH weekly_trends AS (
        SELECT
          DATE_TRUNC('week', ar.analysis_date) as week,
          d.franchise_type,
          unnest(d.brands) as brand,
          AVG(ar.ai_visibility_score) as avg_visibility,
          COUNT(*) as analysis_count
        FROM ai_analysis_results ar
        JOIN dealerships d ON ar.dealership_id = d.id
        WHERE ar.analysis_date >= NOW() - INTERVAL '8 weeks'
          AND d.status = 'active'
        GROUP BY DATE_TRUNC('week', ar.analysis_date), d.franchise_type, unnest(d.brands)
        HAVING COUNT(*) >= 5
      ),
      trend_analysis AS (
        SELECT
          brand,
          franchise_type,
          AVG(avg_visibility) as overall_avg,
          COUNT(*) as weeks_tracked,
          REGR_SLOPE(avg_visibility, EXTRACT(EPOCH FROM week)) as trend_slope,
          STDDEV(avg_visibility) as volatility
        FROM weekly_trends
        GROUP BY brand, franchise_type
        HAVING COUNT(*) >= 4
      )
      SELECT
        brand,
        franchise_type,
        overall_avg,
        trend_slope,
        volatility,
        CASE
          WHEN trend_slope > 0.5 THEN 'Strong Growth'
          WHEN trend_slope > 0.1 THEN 'Moderate Growth'
          WHEN trend_slope > -0.1 THEN 'Stable'
          WHEN trend_slope > -0.5 THEN 'Moderate Decline'
          ELSE 'Strong Decline'
        END as trend_direction,
        CASE
          WHEN volatility < 2 THEN 'Low'
          WHEN volatility < 5 THEN 'Moderate'
          ELSE 'High'
        END as volatility_level
      FROM trend_analysis
      ORDER BY trend_slope DESC, overall_avg DESC
      LIMIT 50
    `)

    return trends.rows

  } catch (error) {
    logger.error({ error }, 'Failed to generate market trend analysis')
    return []
  }
}