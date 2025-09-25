import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { competitiveIntelligenceEngine } from '@/lib/enterprise/competitive-intelligence-engine'
import { db } from '@/lib/db'

const logger = createLogger('cron-market-trends')

/**
 * Weekly Market Trends Analysis
 * Runs at 6 PM every Friday to analyze market trends and generate insights
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Verify cron authentication
    if (request.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
      logger.warn('Unauthorized cron request for market trends analysis')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    logger.info('Starting weekly market trends analysis for geographic clusters')

    // Generate comprehensive market trends
    const marketTrends = await generateComprehensiveMarketTrends()

    // Analyze brand performance trends
    const brandTrends = await analyzeBrandPerformanceTrends()

    // Generate geographic cluster insights
    const clusterInsights = await generateGeographicClusterInsights()

    // Calculate predictive market indicators
    const predictiveIndicators = await calculatePredictiveIndicators()

    // Store trend analysis results
    await storeTrendAnalysisResults({
      market_trends: marketTrends,
      brand_trends: brandTrends,
      cluster_insights: clusterInsights,
      predictive_indicators: predictiveIndicators,
      analysis_date: new Date().toISOString()
    })

    const executionTime = Date.now() - startTime

    logger.info({
      execution_time_ms: executionTime,
      markets_analyzed: marketTrends.length,
      brands_analyzed: brandTrends.length,
      clusters_analyzed: clusterInsights.length
    }, 'Weekly market trends analysis completed')

    return NextResponse.json({
      success: true,
      message: 'Weekly market trends analysis completed',
      execution_time_ms: executionTime,
      analysis_summary: {
        market_trends_identified: marketTrends.length,
        brand_trends_analyzed: brandTrends.length,
        geographic_clusters: clusterInsights.length,
        predictive_indicators: predictiveIndicators
      },
      key_insights: {
        strongest_growth_market: marketTrends[0]?.market_name || 'N/A',
        top_performing_brand: brandTrends[0]?.brand || 'N/A',
        emerging_opportunities: clusterInsights.filter(c => c.opportunity_score > 80).length
      }
    })

  } catch (error) {
    const executionTime = Date.now() - startTime
    logger.error({ error, execution_time_ms: executionTime }, 'Weekly market trends analysis failed')

    return NextResponse.json({
      success: false,
      error: 'Failed to execute market trends analysis',
      execution_time_ms: executionTime
    }, { status: 500 })
  }
}

async function generateComprehensiveMarketTrends() {
  try {
    const trends = await db.query(`
      WITH weekly_performance AS (
        SELECT
          gm.id,
          gm.name as market_name,
          gm.state_code,
          DATE_TRUNC('week', ar.analysis_date) as week,
          AVG(ar.ai_visibility_score) as avg_visibility,
          AVG(ar.seo_performance_score) as avg_seo,
          AVG(ar.market_rank) as avg_market_rank,
          COUNT(DISTINCT ar.dealership_id) as dealerships_analyzed
        FROM geographic_markets gm
        JOIN dealerships d ON gm.id = d.geographic_market_id
        JOIN ai_analysis_results ar ON d.id = ar.dealership_id
        WHERE ar.analysis_date >= NOW() - INTERVAL '12 weeks'
          AND d.status = 'active'
        GROUP BY gm.id, gm.name, gm.state_code, DATE_TRUNC('week', ar.analysis_date)
        HAVING COUNT(DISTINCT ar.dealership_id) >= 3
      ),
      trend_calculations AS (
        SELECT
          id,
          market_name,
          state_code,
          COUNT(*) as weeks_tracked,
          AVG(avg_visibility) as overall_avg_visibility,
          REGR_SLOPE(avg_visibility, EXTRACT(EPOCH FROM week)) as visibility_trend,
          REGR_SLOPE(avg_seo, EXTRACT(EPOCH FROM week)) as seo_trend,
          STDDEV(avg_visibility) as visibility_volatility,
          MAX(dealerships_analyzed) as max_dealerships
        FROM weekly_performance
        GROUP BY id, market_name, state_code
        HAVING COUNT(*) >= 6  -- At least 6 weeks of data
      )
      SELECT
        market_name,
        state_code,
        overall_avg_visibility,
        visibility_trend,
        seo_trend,
        visibility_volatility,
        max_dealerships,
        CASE
          WHEN visibility_trend > 1.0 THEN 'Strong Growth'
          WHEN visibility_trend > 0.3 THEN 'Moderate Growth'
          WHEN visibility_trend > -0.3 THEN 'Stable'
          WHEN visibility_trend > -1.0 THEN 'Moderate Decline'
          ELSE 'Strong Decline'
        END as trend_classification,
        CASE
          WHEN visibility_volatility < 3 THEN 'Low Volatility'
          WHEN visibility_volatility < 6 THEN 'Moderate Volatility'
          ELSE 'High Volatility'
        END as volatility_level
      FROM trend_calculations
      ORDER BY visibility_trend DESC, overall_avg_visibility DESC
      LIMIT 50
    `)

    return trends.rows

  } catch (error) {
    logger.error({ error }, 'Failed to generate comprehensive market trends')
    return []
  }
}

async function analyzeBrandPerformanceTrends() {
  try {
    const brandTrends = await db.query(`
      WITH brand_weekly_performance AS (
        SELECT
          unnest(d.brands) as brand,
          d.franchise_type,
          DATE_TRUNC('week', ar.analysis_date) as week,
          AVG(ar.ai_visibility_score) as avg_visibility,
          AVG(ar.seo_performance_score) as avg_seo,
          COUNT(DISTINCT d.id) as dealership_count
        FROM dealerships d
        JOIN ai_analysis_results ar ON d.id = ar.dealership_id
        WHERE ar.analysis_date >= NOW() - INTERVAL '10 weeks'
          AND d.status = 'active'
        GROUP BY unnest(d.brands), d.franchise_type, DATE_TRUNC('week', ar.analysis_date)
        HAVING COUNT(DISTINCT d.id) >= 5
      ),
      brand_trend_analysis AS (
        SELECT
          brand,
          franchise_type,
          COUNT(*) as weeks_tracked,
          AVG(avg_visibility) as overall_performance,
          REGR_SLOPE(avg_visibility, EXTRACT(EPOCH FROM week)) as performance_trend,
          STDDEV(avg_visibility) as performance_volatility,
          SUM(dealership_count) as total_dealerships_tracked
        FROM brand_weekly_performance
        GROUP BY brand, franchise_type
        HAVING COUNT(*) >= 5 AND SUM(dealership_count) >= 20
      )
      SELECT
        brand,
        franchise_type,
        overall_performance,
        performance_trend,
        performance_volatility,
        total_dealerships_tracked,
        CASE
          WHEN performance_trend > 0.8 THEN 'Accelerating'
          WHEN performance_trend > 0.2 THEN 'Growing'
          WHEN performance_trend > -0.2 THEN 'Stable'
          WHEN performance_trend > -0.8 THEN 'Declining'
          ELSE 'Struggling'
        END as trend_status,
        RANK() OVER (ORDER BY performance_trend DESC) as trend_rank
      FROM brand_trend_analysis
      ORDER BY performance_trend DESC, overall_performance DESC
    `)

    return brandTrends.rows

  } catch (error) {
    logger.error({ error }, 'Failed to analyze brand performance trends')
    return []
  }
}

async function generateGeographicClusterInsights() {
  try {
    // Get competitive landscape insights from the engine
    const landscapeStats = await competitiveIntelligenceEngine.getCompetitiveLandscapeStats()

    // Generate cluster-specific insights
    const clusterInsights = await db.query(`
      WITH cluster_performance AS (
        SELECT
          gm.name as market_name,
          gm.state_code,
          gm.population,
          COUNT(DISTINCT d.id) as total_dealerships,
          AVG(ar.ai_visibility_score) as avg_visibility,
          STDDEV(ar.ai_visibility_score) as visibility_variance,
          AVG(ar.monthly_revenue_at_risk) as avg_revenue_at_risk,
          SUM(ar.potential_monthly_recovery) as total_opportunity,
          COUNT(DISTINCT d.dealership_group_id) as unique_groups
        FROM geographic_markets gm
        JOIN dealerships d ON gm.id = d.geographic_market_id
        LEFT JOIN current_dealership_analysis ar ON d.id = ar.dealership_id
        WHERE d.status = 'active'
        GROUP BY gm.id, gm.name, gm.state_code, gm.population
        HAVING COUNT(DISTINCT d.id) >= 5
      ),
      opportunity_scoring AS (
        SELECT
          *,
          CASE
            WHEN avg_visibility < 60 AND total_opportunity > 100000 THEN 90
            WHEN avg_visibility < 70 AND total_opportunity > 50000 THEN 80
            WHEN visibility_variance > 15 THEN 75
            WHEN total_dealerships > 20 AND avg_visibility < 75 THEN 70
            ELSE 50
          END as opportunity_score
        FROM cluster_performance
      )
      SELECT
        market_name,
        state_code,
        population,
        total_dealerships,
        avg_visibility,
        visibility_variance,
        total_opportunity,
        opportunity_score,
        CASE
          WHEN opportunity_score >= 85 THEN 'High Opportunity'
          WHEN opportunity_score >= 70 THEN 'Moderate Opportunity'
          ELSE 'Stable Market'
        END as opportunity_level
      FROM opportunity_scoring
      ORDER BY opportunity_score DESC, total_opportunity DESC
    `)

    return clusterInsights.rows.map(cluster => ({
      ...cluster,
      competitive_intensity: calculateCompetitiveIntensity(cluster),
      growth_potential: calculateGrowthPotential(cluster),
      strategic_priority: calculateStrategicPriority(cluster)
    }))

  } catch (error) {
    logger.error({ error }, 'Failed to generate geographic cluster insights')
    return []
  }
}

async function calculatePredictiveIndicators() {
  try {
    // Calculate various predictive indicators for market forecasting
    const indicators = await db.query(`
      WITH recent_trends AS (
        SELECT
          DATE_TRUNC('month', ar.analysis_date) as month,
          COUNT(DISTINCT ar.dealership_id) as dealerships_analyzed,
          AVG(ar.ai_visibility_score) as avg_visibility,
          COUNT(*) FILTER (WHERE ar.ai_visibility_score >= 80) as high_performers,
          COUNT(*) FILTER (WHERE ar.ai_visibility_score < 50) as underperformers,
          SUM(ar.monthly_revenue_at_risk) as total_at_risk,
          SUM(ar.potential_monthly_recovery) as total_opportunity
        FROM ai_analysis_results ar
        JOIN dealerships d ON ar.dealership_id = d.id
        WHERE ar.analysis_date >= NOW() - INTERVAL '6 months'
          AND d.status = 'active'
        GROUP BY DATE_TRUNC('month', ar.analysis_date)
        ORDER BY month
      )
      SELECT
        COUNT(*) as months_analyzed,
        AVG(avg_visibility) as overall_avg_visibility,
        REGR_SLOPE(avg_visibility, EXTRACT(EPOCH FROM month)) as visibility_momentum,
        REGR_SLOPE(high_performers, EXTRACT(EPOCH FROM month)) as high_performer_trend,
        REGR_SLOPE(total_opportunity, EXTRACT(EPOCH FROM month)) as opportunity_trend,
        STDDEV(avg_visibility) as market_volatility
      FROM recent_trends
    `)

    const baseIndicators = indicators.rows[0]

    // Calculate additional predictive metrics
    const marketHealth = calculateMarketHealthScore(baseIndicators)
    const growthForecast = calculateGrowthForecast(baseIndicators)
    const riskFactors = identifyRiskFactors(baseIndicators)

    return {
      market_momentum: baseIndicators.visibility_momentum,
      high_performer_growth_rate: baseIndicators.high_performer_trend,
      opportunity_trend: baseIndicators.opportunity_trend,
      market_volatility: baseIndicators.market_volatility,
      market_health_score: marketHealth,
      growth_forecast: growthForecast,
      risk_factors: riskFactors,
      confidence_level: calculateConfidenceLevel(baseIndicators)
    }

  } catch (error) {
    logger.error({ error }, 'Failed to calculate predictive indicators')
    return {
      error: 'Failed to calculate predictive indicators',
      market_momentum: 0,
      market_health_score: 50
    }
  }
}

async function storeTrendAnalysisResults(analysisResults: any) {
  try {
    await db.query(`
      INSERT INTO enterprise_analytics_cache (
        cache_key, cache_data, expires_at, created_at
      ) VALUES (
        'weekly_market_trends', $1, NOW() + INTERVAL '8 days', NOW()
      )
      ON CONFLICT (cache_key)
      DO UPDATE SET
        cache_data = $1,
        expires_at = NOW() + INTERVAL '8 days',
        created_at = NOW()
    `, [JSON.stringify(analysisResults)])

    logger.info('Market trends analysis results stored successfully')

  } catch (error) {
    logger.error({ error }, 'Failed to store trend analysis results')
  }
}

// Helper functions for calculations
function calculateCompetitiveIntensity(cluster: any): string {
  const dealershipsPerCapita = (cluster.total_dealerships / cluster.population) * 100000
  if (dealershipsPerCapita > 15) return 'Extreme'
  if (dealershipsPerCapita > 10) return 'High'
  if (dealershipsPerCapita > 5) return 'Moderate'
  return 'Low'
}

function calculateGrowthPotential(cluster: any): number {
  let potential = 50 // Base score
  if (cluster.avg_visibility < 60) potential += 20
  if (cluster.visibility_variance > 15) potential += 15
  if (cluster.total_opportunity > 100000) potential += 15
  return Math.min(100, potential)
}

function calculateStrategicPriority(cluster: any): 'High' | 'Medium' | 'Low' {
  const score = cluster.opportunity_score + calculateGrowthPotential(cluster)
  if (score >= 150) return 'High'
  if (score >= 120) return 'Medium'
  return 'Low'
}

function calculateMarketHealthScore(indicators: any): number {
  let healthScore = 50

  // Positive momentum increases health
  if (indicators.visibility_momentum > 0) healthScore += 20
  if (indicators.high_performer_trend > 0) healthScore += 15
  if (indicators.opportunity_trend > 0) healthScore += 10

  // Low volatility increases health
  if (indicators.market_volatility < 5) healthScore += 15
  else if (indicators.market_volatility > 10) healthScore -= 10

  return Math.max(0, Math.min(100, healthScore))
}

function calculateGrowthForecast(indicators: any): string {
  if (indicators.visibility_momentum > 0.5 && indicators.high_performer_trend > 0) {
    return 'Strong Growth Expected'
  }
  if (indicators.visibility_momentum > 0.1) {
    return 'Moderate Growth Expected'
  }
  if (indicators.visibility_momentum > -0.1) {
    return 'Stable Performance Expected'
  }
  return 'Cautious Outlook'
}

function identifyRiskFactors(indicators: any): string[] {
  const risks = []

  if (indicators.market_volatility > 10) risks.push('High Market Volatility')
  if (indicators.visibility_momentum < -0.3) risks.push('Declining Performance Trend')
  if (indicators.high_performer_trend < 0) risks.push('Decreasing High Performers')
  if (indicators.opportunity_trend < 0) risks.push('Shrinking Market Opportunities')

  return risks
}

function calculateConfidenceLevel(indicators: any): number {
  let confidence = 70 // Base confidence

  // More data points increase confidence
  if (indicators.months_analyzed >= 6) confidence += 15
  if (indicators.months_analyzed >= 12) confidence += 10

  // Lower volatility increases confidence
  if (indicators.market_volatility < 5) confidence += 10
  else if (indicators.market_volatility > 15) confidence -= 20

  return Math.max(0, Math.min(100, confidence))
}