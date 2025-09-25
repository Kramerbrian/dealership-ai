import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { costTracker } from '@/lib/monitoring/cost-tracking'
import { authenticDataCollector } from '@/lib/data-collection/authentic-data-collector'

const logger = createLogger('cost-monitoring-api')

/**
 * GET /api/enterprise/cost-monitoring
 *
 * Get cost tracking metrics and analysis
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const period = searchParams.get('period') as 'daily' | 'weekly' | 'monthly' || 'weekly'
    const days = parseInt(searchParams.get('days') || '30')
    const format = searchParams.get('format') || 'summary'

    logger.info({ period, days, format }, 'Cost monitoring request received')

    switch (format) {
      case 'summary':
        const summary = await costTracker.getCostSummary(period)
        return NextResponse.json({
          success: true,
          data: {
            summary,
            target_metrics: {
              cost_per_dealer_target: 3.00,
              revenue_per_dealer: 99.00,
              target_margin: 0.97,
              current_margin: summary.margin_analysis.profit_margin
            },
            margin_health: {
              status: summary.margin_analysis.profit_margin >= 0.95 ? 'excellent' :
                      summary.margin_analysis.profit_margin >= 0.90 ? 'good' :
                      summary.margin_analysis.profit_margin >= 0.85 ? 'warning' : 'critical',
              profit_per_dealer: summary.margin_analysis.profit_per_dealer,
              total_profit: summary.total_dealerships * summary.margin_analysis.profit_per_dealer
            }
          }
        })

      case 'trends':
        const trends = await costTracker.getCostTrends(days)
        return NextResponse.json({
          success: true,
          data: {
            trends,
            analysis: {
              avg_daily_cost: trends.reduce((sum, day) => sum + day.daily_cost, 0) / trends.length,
              avg_cost_per_dealer: trends.reduce((sum, day) => sum + day.cost_per_dealer, 0) / trends.length,
              avg_margin: trends.reduce((sum, day) => sum + day.profit_margin, 0) / trends.length,
              trend_direction: trends.length >= 7 ?
                calculateTrendDirection(trends.slice(0, 7)) : 'insufficient_data'
            }
          }
        })

      case 'top_costs':
        const topDealerships = await costTracker.getTopCostDealerships(20)
        return NextResponse.json({
          success: true,
          data: {
            top_cost_dealerships: topDealerships,
            insights: analyzeTopCosts(topDealerships)
          }
        })

      case 'recommendations':
        const recommendations = await costTracker.getCostOptimizationRecommendations()
        return NextResponse.json({
          success: true,
          data: {
            recommendations,
            priority_actions: recommendations.filter(r => r.priority === 'high' || r.priority === 'critical')
          }
        })

      case 'alerts':
        // Get recent cost alerts from database
        const alerts = await getRecentCostAlerts(days)
        return NextResponse.json({
          success: true,
          data: {
            alerts,
            alert_summary: {
              critical: alerts.filter(a => a.severity === 'critical').length,
              high: alerts.filter(a => a.severity === 'high').length,
              medium: alerts.filter(a => a.severity === 'medium').length,
              total_cost_impact: alerts.reduce((sum, alert) => sum + (alert.cost_impact || 0), 0)
            }
          }
        })

      default:
        return NextResponse.json({
          error: 'invalid_format',
          message: 'Format must be: summary, trends, top_costs, recommendations, or alerts'
        }, { status: 400 })
    }

  } catch (error) {
    logger.error({ error }, 'Cost monitoring API failed')
    return NextResponse.json({
      success: false,
      error: 'monitoring_failed',
      message: 'Failed to retrieve cost monitoring data'
    }, { status: 500 })
  }
}

/**
 * POST /api/enterprise/cost-monitoring
 *
 * Update cost budget limits or configurations
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, budget_type, category, limit, warning_threshold } = body

    if (action === 'update_budget') {
      // Update budget limits in database
      await updateBudgetLimit(budget_type, category, limit, warning_threshold)

      logger.info({
        action,
        budget_type,
        category,
        limit,
        warning_threshold
      }, 'Budget limit updated')

      return NextResponse.json({
        success: true,
        message: 'Budget limit updated successfully'
      })
    }

    if (action === 'resolve_alert') {
      const { alert_id } = body
      await resolveAlert(alert_id)

      return NextResponse.json({
        success: true,
        message: 'Alert resolved'
      })
    }

    return NextResponse.json({
      error: 'invalid_action',
      message: 'Action must be: update_budget or resolve_alert'
    }, { status: 400 })

  } catch (error) {
    logger.error({ error }, 'Cost monitoring update failed')
    return NextResponse.json({
      success: false,
      error: 'update_failed'
    }, { status: 500 })
  }
}

// Helper functions
function calculateTrendDirection(trends: any[]): 'increasing' | 'decreasing' | 'stable' {
  if (trends.length < 3) return 'stable'

  const recent = trends.slice(0, 3).reduce((sum, day) => sum + day.cost_per_dealer, 0) / 3
  const older = trends.slice(-3).reduce((sum, day) => sum + day.cost_per_dealer, 0) / 3

  const change = (recent - older) / older

  if (change > 0.1) return 'increasing'
  if (change < -0.1) return 'decreasing'
  return 'stable'
}

function analyzeTopCosts(topDealerships: any[]) {
  const insights = []

  const avgCost = topDealerships.reduce((sum, d) => sum + d.total_cost, 0) / topDealerships.length
  const highCostCount = topDealerships.filter(d => d.total_cost > avgCost * 1.5).length

  if (highCostCount > topDealerships.length * 0.2) {
    insights.push({
      type: 'cost_concentration',
      severity: 'medium',
      description: `${highCostCount} dealerships have significantly higher costs than average`,
      recommendation: 'Review data collection efficiency for high-cost dealerships'
    })
  }

  const lowSuccessCount = topDealerships.filter(d => d.success_rate < 0.9).length
  if (lowSuccessCount > 0) {
    insights.push({
      type: 'success_rate',
      severity: 'high',
      description: `${lowSuccessCount} high-cost dealerships have low success rates`,
      recommendation: 'Investigate and fix data collection failures to reduce waste'
    })
  }

  return insights
}

async function getRecentCostAlerts(days: number) {
  const { db } = await import('@/lib/db')

  const result = await db.query(`
    SELECT *
    FROM cost_alerts
    WHERE triggered_at >= NOW() - INTERVAL '${days} days'
      AND resolved = false
    ORDER BY triggered_at DESC
    LIMIT 50
  `)

  return result.rows
}

async function updateBudgetLimit(
  budgetType: string,
  category: string | null,
  limit: number,
  warningThreshold: number
) {
  const { db } = await import('@/lib/db')

  await db.query(`
    INSERT INTO cost_budgets (budget_type, category, budget_limit, warning_threshold, active)
    VALUES ($1, $2, $3, $4, true)
    ON CONFLICT (budget_type, COALESCE(category, ''))
    DO UPDATE SET
      budget_limit = $3,
      warning_threshold = $4,
      updated_at = NOW()
  `, [budgetType, category, limit, warningThreshold])
}

async function resolveAlert(alertId: string) {
  const { db } = await import('@/lib/db')

  await db.query(`
    UPDATE cost_alerts
    SET resolved = true, resolved_at = NOW()
    WHERE id = $1
  `, [alertId])
}