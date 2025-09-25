import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { costTracker } from '@/lib/monitoring/cost-tracking'
import { db } from '@/lib/db'

const logger = createLogger('cron-daily-cost-summary')

/**
 * Daily Cost Summary and Analysis
 * Runs at 1 AM daily to analyze costs and generate alerts
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Verify cron authentication
    if (request.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
      logger.warn('Unauthorized cron request for daily cost summary')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    logger.info('Starting daily cost summary and analysis')

    // Update daily cost summary table
    await updateDailyCostSummary()

    // Generate cost analysis
    const costSummary = await costTracker.getCostSummary('daily')
    const costTrends = await costTracker.getCostTrends(7)
    const recommendations = await costTracker.getCostOptimizationRecommendations()

    // Check for cost alerts
    const alerts = await checkCostThresholds(costSummary)

    // Generate executive summary
    const executiveSummary = generateExecutiveSummary(costSummary, costTrends, recommendations, alerts)

    // Store summary for dashboard
    await storeDailySummary(executiveSummary)

    const executionTime = Date.now() - startTime

    logger.info({
      execution_time_ms: executionTime,
      cost_per_dealer: costSummary.cost_per_dealer,
      profit_margin: costSummary.margin_analysis.profit_margin,
      dealerships_processed: costSummary.total_dealerships,
      alerts_generated: alerts.length,
      recommendations: recommendations.length
    }, 'Daily cost summary completed')

    return NextResponse.json({
      success: true,
      message: 'Daily cost summary completed',
      execution_time_ms: executionTime,
      summary: {
        cost_per_dealer: costSummary.cost_per_dealer,
        profit_margin: costSummary.margin_analysis.profit_margin,
        dealerships_processed: costSummary.total_dealerships,
        total_cost: costSummary.total_cost,
        margin_status: costSummary.margin_analysis.profit_margin >= 0.95 ? 'healthy' :
                      costSummary.margin_analysis.profit_margin >= 0.90 ? 'warning' : 'critical'
      },
      alerts: alerts.map(alert => ({
        type: alert.alert_type,
        severity: alert.severity,
        description: alert.description
      })),
      key_recommendations: recommendations.filter(r => r.priority === 'high' || r.priority === 'critical')
    })

  } catch (error) {
    const executionTime = Date.now() - startTime
    logger.error({ error, execution_time_ms: executionTime }, 'Daily cost summary failed')

    return NextResponse.json({
      success: false,
      error: 'Failed to generate daily cost summary',
      execution_time_ms: executionTime
    }, { status: 500 })
  }
}

async function updateDailyCostSummary() {
  try {
    await db.query(`
      INSERT INTO daily_cost_summary (
        summary_date, total_cost, total_dealerships, cost_per_dealer,
        total_api_calls, success_rate, profit_margin, efficiency_rating
      )
      SELECT
        DATE(analysis_date),
        SUM(cost_amount),
        COUNT(DISTINCT dealership_domain),
        SUM(cost_amount) / NULLIF(COUNT(DISTINCT dealership_domain), 0),
        SUM(api_calls),
        COUNT(*) FILTER (WHERE success = true) / NULLIF(COUNT(*), 0)::float,
        1 - (SUM(cost_amount) / NULLIF(COUNT(DISTINCT dealership_domain) * 99.00, 0)),
        CASE
          WHEN (SUM(cost_amount) / NULLIF(COUNT(DISTINCT dealership_domain), 0)) <= 3.00
            AND COUNT(*) FILTER (WHERE success = true) / NULLIF(COUNT(*), 0)::float >= 0.95 THEN 'Excellent'
          WHEN (SUM(cost_amount) / NULLIF(COUNT(DISTINCT dealership_domain), 0)) <= 4.00
            AND COUNT(*) FILTER (WHERE success = true) / NULLIF(COUNT(*), 0)::float >= 0.90 THEN 'Good'
          WHEN (SUM(cost_amount) / NULLIF(COUNT(DISTINCT dealership_domain), 0)) <= 5.00
            AND COUNT(*) FILTER (WHERE success = true) / NULLIF(COUNT(*), 0)::float >= 0.85 THEN 'Fair'
          ELSE 'Poor'
        END
      FROM cost_tracking
      WHERE DATE(analysis_date) = CURRENT_DATE - INTERVAL '1 day'
      GROUP BY DATE(analysis_date)
      ON CONFLICT (summary_date) DO UPDATE SET
        total_cost = EXCLUDED.total_cost,
        total_dealerships = EXCLUDED.total_dealerships,
        cost_per_dealer = EXCLUDED.cost_per_dealer,
        total_api_calls = EXCLUDED.total_api_calls,
        success_rate = EXCLUDED.success_rate,
        profit_margin = EXCLUDED.profit_margin,
        efficiency_rating = EXCLUDED.efficiency_rating,
        updated_at = NOW()
    `)

    logger.info('Daily cost summary table updated')
  } catch (error) {
    logger.error({ error }, 'Failed to update daily cost summary table')
    throw error
  }
}

async function checkCostThresholds(summary: any) {
  const alerts = []

  // Check cost per dealer
  if (summary.cost_per_dealer > 3.50) {
    alerts.push({
      alert_type: 'cost_spike',
      severity: 'critical',
      description: `Cost per dealer ($${summary.cost_per_dealer.toFixed(2)}) exceeds critical threshold`,
      cost_impact: (summary.cost_per_dealer - 3.00) * summary.total_dealerships,
      recommended_action: 'Immediately review and optimize data collection processes'
    })
  } else if (summary.cost_per_dealer > 3.00) {
    alerts.push({
      alert_type: 'budget_exceeded',
      severity: 'high',
      description: `Cost per dealer ($${summary.cost_per_dealer.toFixed(2)}) exceeds budget target`,
      cost_impact: (summary.cost_per_dealer - 3.00) * summary.total_dealerships,
      recommended_action: 'Review API usage and optimize collection strategies'
    })
  }

  // Check profit margin
  if (summary.margin_analysis.profit_margin < 0.85) {
    alerts.push({
      alert_type: 'low_margin',
      severity: 'critical',
      description: `Profit margin (${(summary.margin_analysis.profit_margin * 100).toFixed(1)}%) critically low`,
      cost_impact: (0.97 - summary.margin_analysis.profit_margin) * 99 * summary.total_dealerships,
      recommended_action: 'Emergency cost reduction or pricing adjustment required'
    })
  } else if (summary.margin_analysis.profit_margin < 0.90) {
    alerts.push({
      alert_type: 'low_margin',
      severity: 'high',
      description: `Profit margin (${(summary.margin_analysis.profit_margin * 100).toFixed(1)}%) below target`,
      cost_impact: (0.97 - summary.margin_analysis.profit_margin) * 99 * summary.total_dealerships,
      recommended_action: 'Review cost structure and implement optimizations'
    })
  }

  // Check success rate
  if (summary.success_rate < 0.90) {
    alerts.push({
      alert_type: 'api_limit_reached',
      severity: summary.success_rate < 0.80 ? 'critical' : 'high',
      description: `Data collection success rate (${(summary.success_rate * 100).toFixed(1)}%) below acceptable threshold`,
      cost_impact: 0, // No direct cost impact but affects value
      recommended_action: 'Investigate API failures and connection issues'
    })
  }

  // Store alerts in database
  for (const alert of alerts) {
    await db.query(`
      INSERT INTO cost_alerts (
        alert_type, severity, description, cost_impact,
        recommended_action, triggered_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())
    `, [
      alert.alert_type,
      alert.severity,
      alert.description,
      alert.cost_impact,
      alert.recommended_action
    ])
  }

  return alerts
}

function generateExecutiveSummary(summary: any, trends: any[], recommendations: any[], alerts: any[]) {
  const recentTrend = trends.length >= 3 ?
    calculateTrendDirection(trends.slice(0, 3), trends.slice(-3)) : 'stable'

  return {
    date: new Date().toISOString().split('T')[0],
    financial_health: {
      daily_cost: summary.total_cost,
      cost_per_dealer: summary.cost_per_dealer,
      profit_margin: summary.margin_analysis.profit_margin,
      total_profit: summary.margin_analysis.profit_per_dealer * summary.total_dealerships,
      vs_target: {
        cost_variance: summary.cost_per_dealer - 3.00,
        margin_variance: summary.margin_analysis.profit_margin - 0.97
      }
    },
    operational_metrics: {
      dealerships_processed: summary.total_dealerships,
      success_rate: summary.success_rate,
      total_api_calls: Object.values(summary.api_call_volume).reduce((a: any, b: any) => a + b, 0),
      cost_efficiency: summary.cost_per_dealer <= 3.00 && summary.success_rate >= 0.95 ? 'excellent' : 'needs_improvement'
    },
    trend_analysis: {
      direction: recentTrend,
      seven_day_avg_cost: trends.length > 0 ?
        trends.reduce((sum, day) => sum + day.cost_per_dealer, 0) / trends.length : 0,
      cost_volatility: calculateCostVolatility(trends)
    },
    alerts: {
      critical_count: alerts.filter(a => a.severity === 'critical').length,
      high_count: alerts.filter(a => a.severity === 'high').length,
      total_cost_impact: alerts.reduce((sum, alert) => sum + (alert.cost_impact || 0), 0)
    },
    recommendations: {
      high_priority_count: recommendations.filter(r => r.priority === 'high' || r.priority === 'critical').length,
      potential_monthly_savings: recommendations.reduce((sum, rec) => sum + (rec.potential_savings || 0), 0) * 30
    }
  }
}

function calculateTrendDirection(recent: any[], older: any[]): 'increasing' | 'decreasing' | 'stable' {
  if (recent.length === 0 || older.length === 0) return 'stable'

  const recentAvg = recent.reduce((sum, day) => sum + day.cost_per_dealer, 0) / recent.length
  const olderAvg = older.reduce((sum, day) => sum + day.cost_per_dealer, 0) / older.length

  const change = (recentAvg - olderAvg) / olderAvg

  if (change > 0.1) return 'increasing'
  if (change < -0.1) return 'decreasing'
  return 'stable'
}

function calculateCostVolatility(trends: any[]): number {
  if (trends.length < 2) return 0

  const costs = trends.map(t => t.cost_per_dealer)
  const mean = costs.reduce((sum, cost) => sum + cost, 0) / costs.length
  const variance = costs.reduce((sum, cost) => sum + Math.pow(cost - mean, 2), 0) / costs.length

  return Math.sqrt(variance)
}

async function storeDailySummary(summary: any) {
  try {
    await db.query(`
      INSERT INTO enterprise_analytics_cache (
        cache_key, cache_data, expires_at, created_at
      ) VALUES (
        'daily_cost_executive_summary', $1, NOW() + INTERVAL '2 days', NOW()
      )
      ON CONFLICT (cache_key)
      DO UPDATE SET
        cache_data = $1,
        expires_at = NOW() + INTERVAL '2 days',
        updated_at = NOW()
    `, [JSON.stringify(summary)])

    logger.info('Daily cost executive summary stored')
  } catch (error) {
    logger.error({ error }, 'Failed to store daily cost summary')
  }
}