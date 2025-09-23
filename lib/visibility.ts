import { ScoringResult, calculateBatchScore, generateScoreInsights } from './scoring'
import { createLogger } from './logger'

const logger = createLogger('visibility')

export interface VisibilityMetrics {
  overall_score: number
  category_scores: Record<string, number>
  total_prompts: number
  prompts_with_visibility: number
  top_performing_prompts: string[]
  improvement_areas: string[]
  competitive_advantage: number
  local_presence_score: number
}

export interface CategoryWeights {
  visibility_audit: number
  reputation: number
  zero_click: number
  local_seo: number
  competitive: number
  crisis: number
  service: number
  ux: number
  operations: number
}

export const DEFAULT_CATEGORY_WEIGHTS: CategoryWeights = {
  visibility_audit: 0.20,
  reputation: 0.15,
  zero_click: 0.15,
  local_seo: 0.15,
  competitive: 0.10,
  crisis: 0.05,
  service: 0.10,
  ux: 0.05,
  operations: 0.05,
}

export const PROMPT_CATEGORIES: Record<string, keyof CategoryWeights> = {
  // Visibility Audit
  'visibility_basic_top5': 'visibility_audit',
  'competition_crusher_compare': 'visibility_audit',
  'brutal_honesty_test': 'visibility_audit',
  'brutal_comparison_table': 'visibility_audit',
  'final_boss_recommendation': 'visibility_audit',
  'spanish_visibility_check': 'visibility_audit',

  // Reputation
  'reddit_disaster_check': 'reputation',
  'hidden_fee_expose': 'reputation',
  'social_sentiment_analysis': 'reputation',

  // Zero-Click / E-E-A-T
  'ai_optimization_audit': 'zero_click',
  'trust_signal_optimizer': 'zero_click',
  'authority_builder': 'zero_click',
  'zero_click_answer_hub': 'zero_click',
  'multilingual_presence_check': 'zero_click',

  // Local SEO
  'local_seo_reality_check': 'local_seo',
  'map_pack_verdict': 'local_seo',
  'apple_maps_vs_google': 'local_seo',

  // Competitive Intel
  'success_pattern_decoder': 'competitive',
  'weakness_finder': 'competitive',
  'opportunity_spotter': 'competitive',

  // Crisis
  'damage_assessment': 'crisis',
  'recovery_roadmap_90d': 'crisis',
  'reputation_repair_check': 'crisis',

  // Service/Trade/Finance
  'service_top_choices': 'service',
  'service_same_day': 'service',
  'sight_unseen_appraisal_test': 'service',
  'trade_in_fairness_check': 'service',
  'finance_transparency_checker': 'service',
  'first_time_buyer_programs': 'service',

  // UX/Journey
  'customer_journey_simulator': 'ux',
  'voice_query_simulation': 'ux',

  // Operations
  'ev_readiness_audit': 'operations',
  'commercial_fleet_friendly': 'operations',
  'vdps_data_completeness': 'operations',
  'inventory_freshness_signal': 'operations',
  'policy_clarity_check': 'operations',
  'response_time_truth_test': 'operations',
}

export function calculateVisibilityMetrics(
  batchResults: Record<string, Record<string, ScoringResult>>,
  weights: CategoryWeights = DEFAULT_CATEGORY_WEIGHTS
): VisibilityMetrics {
  logger.debug({ totalPrompts: Object.keys(batchResults).length }, 'Calculating visibility metrics')

  const promptScores = calculateBatchScore(batchResults)
  const categoryScores: Record<string, number[]> = {}

  // Group scores by category
  Object.entries(promptScores).forEach(([promptId, score]) => {
    const category = PROMPT_CATEGORIES[promptId] || 'operations'
    if (!categoryScores[category]) {
      categoryScores[category] = []
    }
    categoryScores[category].push(score.total_score)
  })

  // Calculate average scores per category
  const avgCategoryScores: Record<string, number> = {}
  Object.entries(categoryScores).forEach(([category, scores]) => {
    avgCategoryScores[category] = scores.reduce((sum, score) => sum + score, 0) / scores.length
  })

  // Calculate weighted overall score
  let overallScore = 0
  let totalWeight = 0
  Object.entries(weights).forEach(([category, weight]) => {
    if (avgCategoryScores[category] !== undefined) {
      overallScore += avgCategoryScores[category] * weight
      totalWeight += weight
    }
  })
  overallScore = totalWeight > 0 ? overallScore / totalWeight : 0

  // Identify top performing prompts
  const sortedPrompts = Object.entries(promptScores)
    .sort(([, a], [, b]) => b.total_score - a.total_score)
    .slice(0, 5)
    .map(([promptId]) => promptId)

  // Identify improvement areas (lowest scoring categories)
  const improvementAreas = Object.entries(avgCategoryScores)
    .filter(([, score]) => score < 1.0)
    .sort(([, a], [, b]) => a - b)
    .slice(0, 3)
    .map(([category]) => category)

  // Calculate competitive advantage (how often we beat competitors)
  let competitiveAdvantage = 0
  let competitiveChecks = 0
  Object.values(promptScores).forEach((score) => {
    if (score.breakdown.competitors_absent > 0) {
      competitiveAdvantage += score.breakdown.competitors_absent
      competitiveChecks++
    }
  })
  competitiveAdvantage = competitiveChecks > 0 ? competitiveAdvantage / competitiveChecks : 0

  // Calculate local presence score
  let localPresenceScore = 0
  let localChecks = 0
  Object.values(promptScores).forEach((score) => {
    if (score.locality_score > 0) {
      localPresenceScore += score.locality_score
      localChecks++
    }
  })
  localPresenceScore = localChecks > 0 ? localPresenceScore / localChecks : 0

  const metrics: VisibilityMetrics = {
    overall_score: Number(overallScore.toFixed(3)),
    category_scores: Object.fromEntries(
      Object.entries(avgCategoryScores).map(([cat, score]) => [cat, Number(score.toFixed(3))])
    ),
    total_prompts: Object.keys(promptScores).length,
    prompts_with_visibility: Object.values(promptScores).filter(s => s.total_score > 0).length,
    top_performing_prompts: sortedPrompts,
    improvement_areas: improvementAreas,
    competitive_advantage: Number(competitiveAdvantage.toFixed(3)),
    local_presence_score: Number(localPresenceScore.toFixed(3)),
  }

  logger.info({
    overall_score: metrics.overall_score,
    prompts_analyzed: metrics.total_prompts,
    visibility_rate: `${((metrics.prompts_with_visibility / metrics.total_prompts) * 100).toFixed(1)}%`,
  }, 'Visibility metrics calculated')

  return metrics
}

export function generateVisibilityReport(metrics: VisibilityMetrics): {
  summary: string
  recommendations: string[]
  category_insights: Record<string, string>
  score_grade: string
} {
  const scoreGrade = getScoreGrade(metrics.overall_score)

  const summary = `Overall visibility score: ${metrics.overall_score}/5.0 (${scoreGrade}). ` +
    `${metrics.prompts_with_visibility}/${metrics.total_prompts} prompts show visibility ` +
    `(${((metrics.prompts_with_visibility / metrics.total_prompts) * 100).toFixed(1)}%).`

  const recommendations: string[] = []

  if (metrics.overall_score < 2.0) {
    recommendations.push('🚨 Critical: Implement immediate visibility improvements across all categories')
  }

  if (metrics.improvement_areas.length > 0) {
    recommendations.push(`🎯 Focus on: ${metrics.improvement_areas.join(', ')} categories`)
  }

  if (metrics.competitive_advantage < 0.5) {
    recommendations.push('🏁 Strengthen competitive positioning against local rivals')
  }

  if (metrics.local_presence_score < 1.0) {
    recommendations.push('📍 Enhance local SEO signals and geographic targeting')
  }

  if (metrics.category_scores.reputation && metrics.category_scores.reputation < 1.5) {
    recommendations.push('⭐ Address reputation management and review response strategy')
  }

  if (metrics.category_scores.zero_click && metrics.category_scores.zero_click < 1.5) {
    recommendations.push('🎪 Optimize for zero-click searches and AI answer engines')
  }

  const categoryInsights: Record<string, string> = {}
  Object.entries(metrics.category_scores).forEach(([category, score]) => {
    if (score >= 3.0) {
      categoryInsights[category] = `✅ Excellent performance (${score.toFixed(1)})`
    } else if (score >= 2.0) {
      categoryInsights[category] = `👍 Good performance (${score.toFixed(1)})`
    } else if (score >= 1.0) {
      categoryInsights[category] = `⚠️ Needs improvement (${score.toFixed(1)})`
    } else {
      categoryInsights[category] = `❌ Poor performance (${score.toFixed(1)})`
    }
  })

  return {
    summary,
    recommendations,
    category_insights,
    score_grade: scoreGrade,
  }
}

export function getScoreGrade(score: number): string {
  if (score >= 4.0) return 'A+'
  if (score >= 3.5) return 'A'
  if (score >= 3.0) return 'B+'
  if (score >= 2.5) return 'B'
  if (score >= 2.0) return 'C+'
  if (score >= 1.5) return 'C'
  if (score >= 1.0) return 'D'
  return 'F'
}

export function mockVisibilityData(): VisibilityMetrics {
  return {
    overall_score: 2.4,
    category_scores: {
      visibility_audit: 2.8,
      reputation: 1.9,
      zero_click: 2.1,
      local_seo: 3.2,
      competitive: 2.0,
      crisis: 1.5,
      service: 2.6,
      ux: 2.2,
      operations: 2.4,
    },
    total_prompts: 40,
    prompts_with_visibility: 32,
    top_performing_prompts: [
      'local_seo_reality_check',
      'visibility_basic_top5',
      'service_top_choices',
      'map_pack_verdict',
      'customer_journey_simulator',
    ],
    improvement_areas: ['crisis', 'reputation', 'competitive'],
    competitive_advantage: 1.2,
    local_presence_score: 2.8,
  }
}