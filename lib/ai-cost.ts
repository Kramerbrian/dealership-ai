import { createLogger } from './logger'

const logger = createLogger('ai-cost')

export interface TokenCount {
  prompt: number
  completion: number
}

export interface CostCalculation {
  tokens: TokenCount
  cost_cents: number
  provider: string
  model: string
}

export interface ProviderConfig {
  name: string
  models: Record<string, ModelPricing>
  defaultModel: string
  maxTokens: number
  timeout: number
}

export interface ModelPricing {
  prompt_per_1k: number // cents per 1k tokens
  completion_per_1k: number // cents per 1k tokens
  max_tokens: number
}

export const AI_PROVIDERS: Record<string, ProviderConfig> = {
  openai: {
    name: 'OpenAI',
    defaultModel: 'gpt-3.5-turbo',
    maxTokens: 4096,
    timeout: 30000,
    models: {
      'gpt-3.5-turbo': {
        prompt_per_1k: 50, // $0.50 per 1k tokens
        completion_per_1k: 150, // $1.50 per 1k tokens
        max_tokens: 4096,
      },
      'gpt-4': {
        prompt_per_1k: 3000, // $30.00 per 1k tokens
        completion_per_1k: 6000, // $60.00 per 1k tokens
        max_tokens: 8192,
      },
      'gpt-4-turbo': {
        prompt_per_1k: 1000, // $10.00 per 1k tokens
        completion_per_1k: 3000, // $30.00 per 1k tokens
        max_tokens: 128000,
      },
    },
  },
  anthropic: {
    name: 'Anthropic',
    defaultModel: 'claude-3-haiku-20240307',
    maxTokens: 4096,
    timeout: 30000,
    models: {
      'claude-3-haiku-20240307': {
        prompt_per_1k: 25, // $0.25 per 1k tokens
        completion_per_1k: 125, // $1.25 per 1k tokens
        max_tokens: 4096,
      },
      'claude-3-sonnet-20240229': {
        prompt_per_1k: 300, // $3.00 per 1k tokens
        completion_per_1k: 1500, // $15.00 per 1k tokens
        max_tokens: 4096,
      },
      'claude-3-opus-20240229': {
        prompt_per_1k: 1500, // $15.00 per 1k tokens
        completion_per_1k: 7500, // $75.00 per 1k tokens
        max_tokens: 4096,
      },
    },
  },
  perplexity: {
    name: 'Perplexity',
    defaultModel: 'llama-3.1-sonar-small-128k-online',
    maxTokens: 4096,
    timeout: 45000,
    models: {
      'llama-3.1-sonar-small-128k-online': {
        prompt_per_1k: 20, // $0.20 per 1k tokens
        completion_per_1k: 20, // $0.20 per 1k tokens
        max_tokens: 127000,
      },
      'llama-3.1-sonar-large-128k-online': {
        prompt_per_1k: 100, // $1.00 per 1k tokens
        completion_per_1k: 100, // $1.00 per 1k tokens
        max_tokens: 127000,
      },
    },
  },
  gemini: {
    name: 'Google Gemini',
    defaultModel: 'gemini-1.5-flash',
    maxTokens: 8192,
    timeout: 30000,
    models: {
      'gemini-1.5-flash': {
        prompt_per_1k: 75, // $0.75 per 1k tokens
        completion_per_1k: 30, // $0.30 per 1k tokens
        max_tokens: 1000000,
      },
      'gemini-1.5-pro': {
        prompt_per_1k: 350, // $3.50 per 1k tokens
        completion_per_1k: 1050, // $10.50 per 1k tokens
        max_tokens: 2000000,
      },
    },
  },
}

export function calculateCost(
  provider: string,
  model: string,
  tokens: TokenCount
): CostCalculation {
  const providerConfig = AI_PROVIDERS[provider]
  if (!providerConfig) {
    logger.warn({ provider }, 'Unknown AI provider')
    return {
      tokens,
      cost_cents: 0,
      provider,
      model,
    }
  }

  const modelConfig = providerConfig.models[model]
  if (!modelConfig) {
    logger.warn({ provider, model }, 'Unknown model for provider')
    return {
      tokens,
      cost_cents: 0,
      provider,
      model,
    }
  }

  const promptCost = (tokens.prompt / 1000) * modelConfig.prompt_per_1k
  const completionCost = (tokens.completion / 1000) * modelConfig.completion_per_1k
  const totalCost = Math.round(promptCost + completionCost)

  logger.debug({
    provider,
    model,
    tokens,
    promptCost: promptCost.toFixed(2),
    completionCost: completionCost.toFixed(2),
    totalCost,
  }, 'Cost calculated')

  return {
    tokens,
    cost_cents: totalCost,
    provider,
    model,
  }
}

export function estimateTokens(text: string): number {
  // Rough estimation: ~4 characters per token for English text
  // This is a simplification - real tokenization varies by model
  return Math.ceil(text.length / 4)
}

export class CostGuard {
  private maxCostCents: number
  private currentCostCents: number = 0
  private requests: CostCalculation[] = []

  constructor(maxCostCents: number = 1000) { // $10 default limit
    this.maxCostCents = maxCostCents
  }

  checkBudget(estimatedCostCents: number): boolean {
    const wouldExceed = this.currentCostCents + estimatedCostCents > this.maxCostCents

    if (wouldExceed) {
      logger.warn({
        current: this.currentCostCents,
        estimated: estimatedCostCents,
        limit: this.maxCostCents,
      }, 'Cost guard: Request would exceed budget')
    }

    return !wouldExceed
  }

  recordCost(cost: CostCalculation): void {
    this.currentCostCents += cost.cost_cents
    this.requests.push(cost)

    logger.info({
      provider: cost.provider,
      model: cost.model,
      cost: cost.cost_cents,
      running_total: this.currentCostCents,
      budget_remaining: this.maxCostCents - this.currentCostCents,
    }, 'Cost recorded')
  }

  getRemainingBudget(): number {
    return Math.max(0, this.maxCostCents - this.currentCostCents)
  }

  getSpent(): number {
    return this.currentCostCents
  }

  getRequests(): CostCalculation[] {
    return [...this.requests]
  }

  reset(): void {
    this.currentCostCents = 0
    this.requests = []
    logger.info('Cost guard reset')
  }

  getBudgetSummary(): {
    total_budget_cents: number
    spent_cents: number
    remaining_cents: number
    requests_made: number
    average_cost_per_request: number
  } {
    return {
      total_budget_cents: this.maxCostCents,
      spent_cents: this.currentCostCents,
      remaining_cents: this.getRemainingBudget(),
      requests_made: this.requests.length,
      average_cost_per_request: this.requests.length > 0
        ? Math.round(this.currentCostCents / this.requests.length)
        : 0,
    }
  }
}

export function getOptimalProvider(
  estimatedTokens: TokenCount,
  requirements: {
    max_cost_cents?: number
    min_quality?: 'basic' | 'good' | 'premium'
    timeout_ms?: number
  } = {}
): { provider: string; model: string; estimated_cost: number } | null {
  const options: Array<{
    provider: string
    model: string
    estimated_cost: number
    quality_tier: 'basic' | 'good' | 'premium'
  }> = []

  Object.entries(AI_PROVIDERS).forEach(([providerKey, providerConfig]) => {
    Object.entries(providerConfig.models).forEach(([modelKey, modelConfig]) => {
      const cost = calculateCost(providerKey, modelKey, estimatedTokens)

      let qualityTier: 'basic' | 'good' | 'premium' = 'basic'
      if (cost.cost_cents >= 1000) qualityTier = 'premium'
      else if (cost.cost_cents >= 200) qualityTier = 'good'

      options.push({
        provider: providerKey,
        model: modelKey,
        estimated_cost: cost.cost_cents,
        quality_tier: qualityTier,
      })
    })
  })

  // Filter by requirements
  let filtered = options

  if (requirements.max_cost_cents) {
    filtered = filtered.filter(o => o.estimated_cost <= requirements.max_cost_cents!)
  }

  if (requirements.min_quality) {
    const qualityOrder = { basic: 0, good: 1, premium: 2 }
    const minLevel = qualityOrder[requirements.min_quality]
    filtered = filtered.filter(o => qualityOrder[o.quality_tier] >= minLevel)
  }

  if (filtered.length === 0) {
    logger.warn({ requirements }, 'No providers match requirements')
    return null
  }

  // Sort by cost (ascending) and pick the cheapest
  filtered.sort((a, b) => a.estimated_cost - b.estimated_cost)
  const optimal = filtered[0]

  logger.debug({
    chosen: optimal,
    alternatives: filtered.slice(1, 3),
  }, 'Optimal provider selected')

  return {
    provider: optimal.provider,
    model: optimal.model,
    estimated_cost: optimal.estimated_cost,
  }
}