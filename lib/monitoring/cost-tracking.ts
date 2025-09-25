import { createLogger } from '../logger'
import { db } from '../db'

const logger = createLogger('cost-tracking')

export interface CostEntry {
  dealership_id?: string
  dealership_domain: string
  cost_category: 'gmb_api' | 'review_aggregation' | 'serp_tracking' | 'competitor_intel' | 'pagespeed_api' | 'schema_validation'
  cost_amount: number
  api_calls: number
  data_volume: number
  success: boolean
  error_message?: string
  job_type: string
  analysis_date: Date
}

export interface CostSummary {
  period: 'daily' | 'weekly' | 'monthly'
  total_cost: number
  total_dealerships: number
  cost_per_dealer: number
  cost_breakdown: Record<string, number>
  api_call_volume: Record<string, number>
  success_rate: number
  margin_analysis: {
    total_cost: number
    revenue_per_dealer: number
    profit_margin: number
    profit_per_dealer: number
  }
}

export interface CostAlert {
  alert_type: 'budget_exceeded' | 'cost_spike' | 'low_margin' | 'api_limit_reached'
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  cost_impact: number
  recommended_action: string
  triggered_at: Date
}

export class CostTracker {
  private readonly TARGET_COST_PER_DEALER = 3.00
  private readonly REVENUE_PER_DEALER = 99.00
  private readonly TARGET_MARGIN = 0.97 // 97%

  /**
   * Track cost for authentic data collection
   */
  async trackCost(entry: CostEntry): Promise<void> {
    try {
      await db.query(`
        INSERT INTO cost_tracking (
          dealership_id, dealership_domain, cost_category, cost_amount,
          api_calls, data_volume, success, error_message, job_type, analysis_date,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      `, [
        entry.dealership_id || null,
        entry.dealership_domain,
        entry.cost_category,
        entry.cost_amount,
        entry.api_calls,
        entry.data_volume,
        entry.success,
        entry.error_message || null,
        entry.job_type,
        entry.analysis_date
      ])

      // Check for cost alerts
      await this.checkCostAlerts(entry)

    } catch (error) {
      logger.error({ error, entry }, 'Failed to track cost')
    }
  }

  /**
   * Get cost summary for a specific period
   */
  async getCostSummary(
    period: 'daily' | 'weekly' | 'monthly',
    startDate?: Date,
    endDate?: Date
  ): Promise<CostSummary> {
    const dateRange = this.getDateRange(period, startDate, endDate)

    const result = await db.query(`
      WITH cost_aggregation AS (
        SELECT
          cost_category,
          SUM(cost_amount) as category_cost,
          SUM(api_calls) as category_api_calls,
          COUNT(DISTINCT dealership_domain) as unique_dealerships,
          COUNT(*) as total_operations,
          COUNT(*) FILTER (WHERE success = true) as successful_operations
        FROM cost_tracking
        WHERE analysis_date >= $1 AND analysis_date <= $2
        GROUP BY cost_category
      )
      SELECT
        SUM(category_cost) as total_cost,
        MAX(unique_dealerships) as total_dealerships,
        SUM(category_api_calls) as total_api_calls,
        SUM(successful_operations) as successful_operations,
        SUM(total_operations) as total_operations,
        json_object_agg(cost_category, category_cost) as cost_breakdown,
        json_object_agg(cost_category, category_api_calls) as api_call_volume
      FROM cost_aggregation
    `, [dateRange.start, dateRange.end])

    const data = result.rows[0]
    const totalCost = parseFloat(data.total_cost || 0)
    const totalDealerships = parseInt(data.total_dealerships || 0)
    const costPerDealer = totalDealerships > 0 ? totalCost / totalDealerships : 0
    const successRate = data.total_operations > 0 ?
      (data.successful_operations / data.total_operations) : 0

    return {
      period,
      total_cost: totalCost,
      total_dealerships: totalDealerships,
      cost_per_dealer: costPerDealer,
      cost_breakdown: data.cost_breakdown || {},
      api_call_volume: data.api_call_volume || {},
      success_rate: successRate,
      margin_analysis: {
        total_cost: totalCost,
        revenue_per_dealer: this.REVENUE_PER_DEALER,
        profit_margin: totalDealerships > 0 ?
          1 - (totalCost / (totalDealerships * this.REVENUE_PER_DEALER)) : 0,
        profit_per_dealer: this.REVENUE_PER_DEALER - costPerDealer
      }
    }
  }

  /**
   * Get cost trends over time
   */
  async getCostTrends(days: number = 30): Promise<any[]> {
    const result = await db.query(`
      SELECT
        DATE(analysis_date) as date,
        SUM(cost_amount) as daily_cost,
        COUNT(DISTINCT dealership_domain) as dealerships_processed,
        SUM(api_calls) as total_api_calls,
        COUNT(*) FILTER (WHERE success = true) / COUNT(*)::float as success_rate
      FROM cost_tracking
      WHERE analysis_date >= NOW() - INTERVAL '${days} days'
      GROUP BY DATE(analysis_date)
      ORDER BY date DESC
    `)

    return result.rows.map(row => ({
      date: row.date,
      daily_cost: parseFloat(row.daily_cost),
      dealerships_processed: parseInt(row.dealerships_processed),
      cost_per_dealer: row.dealerships_processed > 0 ?
        parseFloat(row.daily_cost) / parseInt(row.dealerships_processed) : 0,
      total_api_calls: parseInt(row.total_api_calls),
      success_rate: parseFloat(row.success_rate),
      profit_margin: row.dealerships_processed > 0 ?
        1 - (parseFloat(row.daily_cost) / (parseInt(row.dealerships_processed) * this.REVENUE_PER_DEALER)) : 0
    }))
  }

  /**
   * Get top cost-driving dealerships
   */
  async getTopCostDealerships(limit: number = 20): Promise<any[]> {
    const result = await db.query(`
      SELECT
        dealership_domain,
        dealership_id,
        SUM(cost_amount) as total_cost,
        COUNT(*) as total_operations,
        COUNT(*) FILTER (WHERE success = true) as successful_operations,
        MAX(analysis_date) as last_analysis,
        AVG(cost_amount) as avg_cost_per_operation
      FROM cost_tracking
      WHERE analysis_date >= NOW() - INTERVAL '30 days'
      GROUP BY dealership_domain, dealership_id
      ORDER BY total_cost DESC
      LIMIT $1
    `, [limit])

    return result.rows.map(row => ({
      dealership_domain: row.dealership_domain,
      dealership_id: row.dealership_id,
      total_cost: parseFloat(row.total_cost),
      total_operations: parseInt(row.total_operations),
      success_rate: row.total_operations > 0 ?
        row.successful_operations / row.total_operations : 0,
      last_analysis: row.last_analysis,
      avg_cost_per_operation: parseFloat(row.avg_cost_per_operation),
      efficiency_score: this.calculateEfficiencyScore(row)
    }))
  }

  /**
   * Check for cost alerts and create notifications
   */
  private async checkCostAlerts(entry: CostEntry): Promise<void> {
    const alerts: CostAlert[] = []

    // Check daily cost per dealer
    const dailyCosts = await this.getDailyCostSummary()
    if (dailyCosts.cost_per_dealer > this.TARGET_COST_PER_DEALER * 1.5) {
      alerts.push({
        alert_type: 'cost_spike',
        severity: 'high',
        description: `Daily cost per dealer (${dailyCosts.cost_per_dealer.toFixed(2)}) exceeds target by 50%`,
        cost_impact: (dailyCosts.cost_per_dealer - this.TARGET_COST_PER_DEALER) * dailyCosts.total_dealerships,
        recommended_action: 'Review API usage patterns and optimize data collection strategies',
        triggered_at: new Date()
      })
    }

    // Check margin health
    const margin = 1 - (dailyCosts.cost_per_dealer / this.REVENUE_PER_DEALER)
    if (margin < this.TARGET_MARGIN * 0.9) {
      alerts.push({
        alert_type: 'low_margin',
        severity: margin < this.TARGET_MARGIN * 0.8 ? 'critical' : 'medium',
        description: `Profit margin (${(margin * 100).toFixed(1)}%) below target`,
        cost_impact: (this.TARGET_MARGIN - margin) * this.REVENUE_PER_DEALER * dailyCosts.total_dealerships,
        recommended_action: 'Reduce API costs or increase pricing',
        triggered_at: new Date()
      })
    }

    // Store alerts
    for (const alert of alerts) {
      await this.storeAlert(alert)
    }
  }

  private async getDailyCostSummary(): Promise<CostSummary> {
    return this.getCostSummary('daily')
  }

  private async storeAlert(alert: CostAlert): Promise<void> {
    try {
      await db.query(`
        INSERT INTO cost_alerts (
          alert_type, severity, description, cost_impact,
          recommended_action, triggered_at, resolved, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, false, NOW())
      `, [
        alert.alert_type,
        alert.severity,
        alert.description,
        alert.cost_impact,
        alert.recommended_action,
        alert.triggered_at
      ])

      logger.warn({
        alert_type: alert.alert_type,
        severity: alert.severity,
        cost_impact: alert.cost_impact
      }, 'Cost alert triggered')

    } catch (error) {
      logger.error({ error, alert }, 'Failed to store cost alert')
    }
  }

  private getDateRange(period: 'daily' | 'weekly' | 'monthly', startDate?: Date, endDate?: Date) {
    const end = endDate || new Date()
    let start: Date

    if (startDate) {
      start = startDate
    } else {
      switch (period) {
        case 'daily':
          start = new Date(end.getTime() - 24 * 60 * 60 * 1000)
          break
        case 'weekly':
          start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case 'monthly':
          start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000)
          break
      }
    }

    return { start, end }
  }

  private calculateEfficiencyScore(row: any): number {
    const successRate = row.total_operations > 0 ?
      row.successful_operations / row.total_operations : 0
    const costEfficiency = Math.max(0, 1 - (parseFloat(row.total_cost) / this.TARGET_COST_PER_DEALER))

    return Math.round((successRate * 0.6 + costEfficiency * 0.4) * 100)
  }

  /**
   * Get cost optimization recommendations
   */
  async getCostOptimizationRecommendations(): Promise<any[]> {
    const summary = await this.getCostSummary('weekly')
    const trends = await this.getCostTrends(14)
    const recommendations = []

    // Analyze cost breakdown
    Object.entries(summary.cost_breakdown).forEach(([category, cost]) => {
      const percentage = (cost / summary.total_cost) * 100
      if (percentage > 40) {
        recommendations.push({
          category: 'cost_reduction',
          priority: 'high',
          title: `Optimize ${category} usage`,
          description: `${category} accounts for ${percentage.toFixed(1)}% of total costs`,
          potential_savings: cost * 0.2, // Assume 20% reduction potential
          implementation_effort: 'medium'
        })
      }
    })

    // Check for cost trends
    if (trends.length >= 7) {
      const recentTrend = trends.slice(0, 7)
      const avgRecentCost = recentTrend.reduce((sum, day) => sum + day.cost_per_dealer, 0) / 7

      if (avgRecentCost > this.TARGET_COST_PER_DEALER * 1.2) {
        recommendations.push({
          category: 'cost_control',
          priority: 'critical',
          title: 'Implement cost controls',
          description: `Average cost per dealer (${avgRecentCost.toFixed(2)}) significantly above target`,
          potential_savings: (avgRecentCost - this.TARGET_COST_PER_DEALER) * summary.total_dealerships * 7,
          implementation_effort: 'high'
        })
      }
    }

    return recommendations
  }
}

export const costTracker = new CostTracker()