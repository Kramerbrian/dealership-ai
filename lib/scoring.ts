import { createLogger } from './logger'

const logger = createLogger('scoring')

export interface ScoringWeights {
  position: number[]
  citation_bonus: number
  locality_bonus_within_miles: number
  competitor_penalty_when_absent: number
}

export interface SearchResult {
  title: string
  url: string
  snippet: string
  position: number
  domain: string
  isDealer: boolean
  isCompetitor: boolean
  hasLocalSignals: boolean
  distance?: number
}

export interface PromptResult {
  engine: string
  prompt_id: string
  query: string
  results: SearchResult[]
  recommended_dealers?: string[]
  citations?: string[]
  summary?: string
  raw_response?: string
  metadata?: Record<string, any>
}

export interface ScoringResult {
  total_score: number
  position_score: number
  citation_score: number
  locality_score: number
  competitor_score: number
  breakdown: {
    found_positions: number[]
    citations_found: number
    local_signals: number
    competitors_absent: number
  }
}

export const defaultWeights: ScoringWeights = {
  position: [1.0, 0.6, 0.3],
  citation_bonus: 0.2,
  locality_bonus_within_miles: 30,
  competitor_penalty_when_absent: -0.2,
}

export function calculatePromptScore(
  result: PromptResult,
  dealerDomain: string,
  competitorDomains: string[],
  weights: ScoringWeights = defaultWeights
): ScoringResult {
  logger.debug({ prompt_id: result.prompt_id, engine: result.engine }, 'Calculating prompt score')

  let positionScore = 0
  let citationScore = 0
  let localityScore = 0
  let competitorScore = 0

  const foundPositions: number[] = []
  let citationsFound = 0
  let localSignals = 0
  let competitorsAbsent = 0

  // Position scoring
  result.results.forEach((searchResult) => {
    if (searchResult.isDealer && searchResult.domain === dealerDomain) {
      foundPositions.push(searchResult.position)

      if (searchResult.position <= weights.position.length) {
        positionScore += weights.position[searchResult.position - 1]
      }
    }
  })

  // Citation scoring
  if (result.citations) {
    result.citations.forEach((citation) => {
      if (citation.toLowerCase().includes(dealerDomain)) {
        citationsFound++
        citationScore += weights.citation_bonus
      }
    })
  }

  // Locality scoring
  result.results.forEach((searchResult) => {
    if (searchResult.isDealer && searchResult.hasLocalSignals) {
      localSignals++
      if (searchResult.distance && searchResult.distance <= weights.locality_bonus_within_miles) {
        localityScore += weights.citation_bonus // Reuse citation bonus for locality
      }
    }
  })

  // Competitor penalty
  competitorDomains.forEach((competitorDomain) => {
    const competitorFound = result.results.some((r) => r.domain === competitorDomain)
    if (!competitorFound) {
      competitorsAbsent++
      competitorScore += weights.competitor_penalty_when_absent
    }
  })

  const totalScore = Math.max(0, positionScore + citationScore + localityScore + competitorScore)

  const scoringResult: ScoringResult = {
    total_score: Number(totalScore.toFixed(3)),
    position_score: Number(positionScore.toFixed(3)),
    citation_score: Number(citationScore.toFixed(3)),
    locality_score: Number(localityScore.toFixed(3)),
    competitor_score: Number(competitorScore.toFixed(3)),
    breakdown: {
      found_positions: foundPositions,
      citations_found: citationsFound,
      local_signals: localSignals,
      competitors_absent: competitorsAbsent,
    },
  }

  logger.debug({
    prompt_id: result.prompt_id,
    engine: result.engine,
    scoring: scoringResult,
  }, 'Prompt score calculated')

  return scoringResult
}

export function aggregateEngineScores(
  engineResults: Record<string, ScoringResult>
): ScoringResult {
  const engines = Object.keys(engineResults)
  if (engines.length === 0) {
    return {
      total_score: 0,
      position_score: 0,
      citation_score: 0,
      locality_score: 0,
      competitor_score: 0,
      breakdown: {
        found_positions: [],
        citations_found: 0,
        local_signals: 0,
        competitors_absent: 0,
      },
    }
  }

  const totalScore = engines.reduce((sum, engine) => sum + engineResults[engine].total_score, 0) / engines.length
  const positionScore = engines.reduce((sum, engine) => sum + engineResults[engine].position_score, 0) / engines.length
  const citationScore = engines.reduce((sum, engine) => sum + engineResults[engine].citation_score, 0) / engines.length
  const localityScore = engines.reduce((sum, engine) => sum + engineResults[engine].locality_score, 0) / engines.length
  const competitorScore = engines.reduce((sum, engine) => sum + engineResults[engine].competitor_score, 0) / engines.length

  const allPositions: number[] = []
  let totalCitations = 0
  let totalLocalSignals = 0
  let totalCompetitorsAbsent = 0

  engines.forEach((engine) => {
    const result = engineResults[engine]
    allPositions.push(...result.breakdown.found_positions)
    totalCitations += result.breakdown.citations_found
    totalLocalSignals += result.breakdown.local_signals
    totalCompetitorsAbsent += result.breakdown.competitors_absent
  })

  return {
    total_score: Number(totalScore.toFixed(3)),
    position_score: Number(positionScore.toFixed(3)),
    citation_score: Number(citationScore.toFixed(3)),
    locality_score: Number(localityScore.toFixed(3)),
    competitor_score: Number(competitorScore.toFixed(3)),
    breakdown: {
      found_positions: [...new Set(allPositions)].sort((a, b) => a - b),
      citations_found: Math.round(totalCitations / engines.length),
      local_signals: Math.round(totalLocalSignals / engines.length),
      competitors_absent: Math.round(totalCompetitorsAbsent / engines.length),
    },
  }
}

export function calculateBatchScore(
  batchResults: Record<string, Record<string, ScoringResult>>
): Record<string, ScoringResult> {
  const promptScores: Record<string, ScoringResult> = {}

  Object.keys(batchResults).forEach((promptId) => {
    promptScores[promptId] = aggregateEngineScores(batchResults[promptId])
  })

  return promptScores
}

export function generateScoreInsights(
  score: ScoringResult,
  promptId: string
): string[] {
  const insights: string[] = []

  if (score.total_score === 0) {
    insights.push(`❌ ${promptId}: No visibility found`)
  } else if (score.total_score >= 2.0) {
    insights.push(`🎯 ${promptId}: Excellent visibility (${score.total_score})`)
  } else if (score.total_score >= 1.0) {
    insights.push(`✅ ${promptId}: Good visibility (${score.total_score})`)
  } else {
    insights.push(`⚠️ ${promptId}: Limited visibility (${score.total_score})`)
  }

  if (score.breakdown.found_positions.length > 0) {
    insights.push(`📊 Found in positions: ${score.breakdown.found_positions.join(', ')}`)
  }

  if (score.breakdown.citations_found > 0) {
    insights.push(`📝 ${score.breakdown.citations_found} citations found`)
  }

  if (score.breakdown.competitors_absent > 0) {
    insights.push(`🚫 ${score.breakdown.competitors_absent} competitors absent (advantage)`)
  }

  return insights
}

export function mockSearchResults(query: string, dealerDomain: string): SearchResult[] {
  const mockResults: SearchResult[] = [
    {
      title: `${dealerDomain} - New & Used Cars`,
      url: `https://${dealerDomain}`,
      snippet: 'Visit our dealership for the best selection of new and used vehicles.',
      position: 1,
      domain: dealerDomain,
      isDealer: true,
      isCompetitor: false,
      hasLocalSignals: true,
      distance: 5,
    },
    {
      title: 'Car Reviews & Ratings',
      url: 'https://cars.com/reviews',
      snippet: 'Independent reviews and ratings for various car models.',
      position: 2,
      domain: 'cars.com',
      isDealer: false,
      isCompetitor: false,
      hasLocalSignals: false,
    },
    {
      title: 'Competitor Dealership',
      url: 'https://competitor.com',
      snippet: 'Another dealership in the area offering similar services.',
      position: 3,
      domain: 'competitor.com',
      isDealer: true,
      isCompetitor: true,
      hasLocalSignals: true,
      distance: 10,
    },
  ]

  logger.debug({ query, dealerDomain, resultCount: mockResults.length }, 'Generated mock search results')
  return mockResults
}