import { z } from 'zod'
import { createLogger } from './logger'

const logger = createLogger('prompt-pack')

export const PromptVariableSchema = z.object({
  name: z.string(),
  description: z.string(),
  type: z.enum(['string', 'number', 'boolean', 'array']),
  required: z.boolean().default(true),
  default: z.any().optional(),
  options: z.array(z.string()).optional(),
})

export const EngineDefaultsSchema = z.object({
  engines: z.array(z.string()).default(['openai', 'anthropic', 'perplexity', 'gemini']),
  temperature: z.number().min(0).max(2).default(0.7),
  top_p: z.number().min(0).max(1).default(0.9),
  max_tokens: z.number().min(100).max(8000).default(2000),
  timeout_ms: z.number().min(5000).max(120000).default(30000),
})

export const RateLimitSchema = z.object({
  min_delay_ms: z.number().min(0).default(1000),
  per_run_budget_cents: z.number().min(0).default(500),
})

export const EvalSignalsSchema = z.object({
  position_weights: z.array(z.number()).default([1.0, 0.6, 0.3]),
  citation_bonus: z.number().default(0.2),
  locality_bonus_within_miles: z.number().default(30),
  competitor_penalty_when_absent: z.number().default(-0.2),
})

export const OutputSchemaHintSchema = z.object({
  type: z.literal('object'),
  properties: z.record(z.any()),
  required: z.array(z.string()).optional(),
})

export const PromptSchema = z.object({
  id: z.string(),
  title: z.string(),
  category: z.enum([
    'visibility_audit',
    'reputation',
    'zero_click',
    'local_seo',
    'competitive',
    'crisis',
    'service',
    'ux',
    'operations',
  ]),
  intent: z.enum(['buy', 'sell', 'service', 'finance', 'meta']),
  personas: z.array(z.string()),
  language: z.enum(['en', 'es']).default('en'),
  template: z.string(),
  variables: z.array(PromptVariableSchema),
  engine_defaults: EngineDefaultsSchema,
  rate_limit: RateLimitSchema,
  eval_signals: EvalSignalsSchema,
  output_schema_hint: OutputSchemaHintSchema,
  tags: z.array(z.string()).default([]),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
})

export const PromptPackSchema = z.object({
  version: z.string(),
  name: z.string(),
  description: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  prompts: z.array(PromptSchema),
})

export type PromptVariable = z.infer<typeof PromptVariableSchema>
export type EngineDefaults = z.infer<typeof EngineDefaultsSchema>
export type RateLimit = z.infer<typeof RateLimitSchema>
export type EvalSignals = z.infer<typeof EvalSignalsSchema>
export type OutputSchemaHint = z.infer<typeof OutputSchemaHintSchema>
export type Prompt = z.infer<typeof PromptSchema>
export type PromptPack = z.infer<typeof PromptPackSchema>

export interface ValidationError {
  promptId: string
  field: string
  error: string
}

export interface HydratedPrompt extends Prompt {
  hydrated_template: string
  missing_variables: string[]
  cost_estimate_cents: number
}

export interface DealerDefaults {
  dealer: string
  brand: string
  city: string
  state: string
  competitor_1: string
  competitor_2: string
  competitor_3: string
  issue: string
  topic: string
  model: string
  [key: string]: string
}

export const DEFAULT_DEALER_DEFAULTS: DealerDefaults = {
  dealer: 'Germain Toyota of Naples',
  brand: 'Toyota',
  city: 'Naples',
  state: 'FL',
  competitor_1: 'Toyota of North Naples',
  competitor_2: 'Fort Myers Toyota',
  competitor_3: 'Hendrick Toyota Naples',
  issue: 'hidden fees',
  topic: 'hybrid maintenance',
  model: 'RAV4 Hybrid',
}

export class PromptPackManager {
  private promptPack: PromptPack | null = null
  private validationErrors: ValidationError[] = []

  async loadFromFile(filePath: string): Promise<boolean> {
    try {
      const fs = await import('fs/promises')
      const data = await fs.readFile(filePath, 'utf-8')
      return this.loadFromString(data)
    } catch (error) {
      logger.error({ error, filePath }, 'Failed to load prompt pack from file')
      return false
    }
  }

  loadFromString(jsonString: string): boolean {
    try {
      const data = JSON.parse(jsonString)
      return this.loadFromObject(data)
    } catch (error) {
      logger.error({ error }, 'Failed to parse prompt pack JSON')
      return false
    }
  }

  loadFromObject(data: any): boolean {
    try {
      this.promptPack = PromptPackSchema.parse(data)
      this.validationErrors = this.validatePrompts()

      logger.info({
        version: this.promptPack.version,
        promptCount: this.promptPack.prompts.length,
        validationErrors: this.validationErrors.length,
      }, 'Prompt pack loaded')

      return true
    } catch (error) {
      logger.error({ error }, 'Failed to validate prompt pack schema')
      return false
    }
  }

  private validatePrompts(): ValidationError[] {
    if (!this.promptPack) return []

    const errors: ValidationError[] = []

    for (const prompt of this.promptPack.prompts) {
      // Check if template variables match declared variables
      const templateVars = this.extractTemplateVariables(prompt.template)
      const declaredVars = prompt.variables.map(v => v.name)

      for (const templateVar of templateVars) {
        if (!declaredVars.includes(templateVar)) {
          errors.push({
            promptId: prompt.id,
            field: 'template',
            error: `Template uses undeclared variable: {{${templateVar}}}`,
          })
        }
      }

      for (const declaredVar of declaredVars) {
        if (!templateVars.includes(declaredVar)) {
          errors.push({
            promptId: prompt.id,
            field: 'variables',
            error: `Declared variable '${declaredVar}' is not used in template`,
          })
        }
      }

      // Validate required variables have defaults or are in dealer defaults
      for (const variable of prompt.variables) {
        if (variable.required && !variable.default) {
          const hasDefault = Object.keys(DEFAULT_DEALER_DEFAULTS).includes(variable.name)
          if (!hasDefault) {
            errors.push({
              promptId: prompt.id,
              field: 'variables',
              error: `Required variable '${variable.name}' has no default value`,
            })
          }
        }
      }
    }

    return errors
  }

  private extractTemplateVariables(template: string): string[] {
    const regex = /\{\{(\w+)\}\}/g
    const variables: string[] = []
    let match

    while ((match = regex.exec(template)) !== null) {
      variables.push(match[1])
    }

    return [...new Set(variables)]
  }

  getPrompts(): Prompt[] {
    return this.promptPack?.prompts || []
  }

  getPromptById(id: string): Prompt | null {
    return this.promptPack?.prompts.find(p => p.id === id) || null
  }

  getPromptsByCategory(category: string): Prompt[] {
    return this.promptPack?.prompts.filter(p => p.category === category) || []
  }

  getPromptsByIntent(intent: string): Prompt[] {
    return this.promptPack?.prompts.filter(p => p.intent === intent) || []
  }

  getPromptsByLanguage(language: string): Prompt[] {
    return this.promptPack?.prompts.filter(p => p.language === language) || []
  }

  getValidationErrors(): ValidationError[] {
    return this.validationErrors
  }

  hydratePrompt(
    promptId: string,
    dealerDefaults: DealerDefaults,
    overrides: Record<string, any> = {}
  ): HydratedPrompt | null {
    const prompt = this.getPromptById(promptId)
    if (!prompt) {
      logger.warn({ promptId }, 'Prompt not found for hydration')
      return null
    }

    const values = { ...DEFAULT_DEALER_DEFAULTS, ...dealerDefaults, ...overrides }
    let hydratedTemplate = prompt.template
    const missingVariables: string[] = []

    // Replace template variables
    for (const variable of prompt.variables) {
      const placeholder = `{{${variable.name}}}`
      let value = values[variable.name]

      if (value === undefined || value === null) {
        if (variable.default !== undefined) {
          value = variable.default
        } else if (variable.required) {
          missingVariables.push(variable.name)
          value = `[MISSING:${variable.name}]`
        } else {
          value = ''
        }
      }

      hydratedTemplate = hydratedTemplate.replace(
        new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'),
        String(value)
      )
    }

    // Estimate cost (rough approximation)
    const estimatedTokens = Math.ceil(hydratedTemplate.length / 4)
    const costEstimateCents = Math.ceil(estimatedTokens * 0.002) // ~$0.002 per token average

    const result: HydratedPrompt = {
      ...prompt,
      hydrated_template: hydratedTemplate,
      missing_variables: missingVariables,
      cost_estimate_cents: costEstimateCents,
    }

    logger.debug({
      promptId,
      templateLength: hydratedTemplate.length,
      missingVariables: missingVariables.length,
      costEstimate: costEstimateCents,
    }, 'Prompt hydrated')

    return result
  }

  hydrateMultiplePrompts(
    promptIds: string[],
    dealerDefaults: DealerDefaults,
    filters: {
      intent?: string
      language?: string
    } = {}
  ): HydratedPrompt[] {
    let prompts = promptIds.map(id => this.getPromptById(id)).filter(Boolean) as Prompt[]

    // Apply filters
    if (filters.intent) {
      prompts = prompts.filter(p => p.intent === filters.intent)
    }
    if (filters.language) {
      prompts = prompts.filter(p => p.language === filters.language)
    }

    const hydrated: HydratedPrompt[] = []

    for (const prompt of prompts) {
      const hydratedPrompt = this.hydratePrompt(prompt.id, dealerDefaults)
      if (hydratedPrompt) {
        hydrated.push(hydratedPrompt)
      }
    }

    logger.info({
      requested: promptIds.length,
      filtered: prompts.length,
      hydrated: hydrated.length,
    }, 'Multiple prompts hydrated')

    return hydrated
  }

  expandPrompt(promptId: string, dealerDefaults: DealerDefaults): {
    prompt: HydratedPrompt
    metadata: {
      variables_used: Record<string, any>
      estimated_tokens: number
      estimated_cost_cents: number
      engines_configured: string[]
    }
  } | null {
    const hydrated = this.hydratePrompt(promptId, dealerDefaults)
    if (!hydrated) return null

    const variablesUsed: Record<string, any> = {}
    const allValues = { ...DEFAULT_DEALER_DEFAULTS, ...dealerDefaults }

    for (const variable of hydrated.variables) {
      variablesUsed[variable.name] = allValues[variable.name] || variable.default
    }

    return {
      prompt: hydrated,
      metadata: {
        variables_used: variablesUsed,
        estimated_tokens: Math.ceil(hydrated.hydrated_template.length / 4),
        estimated_cost_cents: hydrated.cost_estimate_cents,
        engines_configured: hydrated.engine_defaults.engines,
      },
    }
  }

  getStats(): {
    total_prompts: number
    by_category: Record<string, number>
    by_intent: Record<string, number>
    by_language: Record<string, number>
    validation_errors: number
  } {
    if (!this.promptPack) {
      return {
        total_prompts: 0,
        by_category: {},
        by_intent: {},
        by_language: {},
        validation_errors: 0,
      }
    }

    const stats = {
      total_prompts: this.promptPack.prompts.length,
      by_category: {} as Record<string, number>,
      by_intent: {} as Record<string, number>,
      by_language: {} as Record<string, number>,
      validation_errors: this.validationErrors.length,
    }

    for (const prompt of this.promptPack.prompts) {
      stats.by_category[prompt.category] = (stats.by_category[prompt.category] || 0) + 1
      stats.by_intent[prompt.intent] = (stats.by_intent[prompt.intent] || 0) + 1
      stats.by_language[prompt.language] = (stats.by_language[prompt.language] || 0) + 1
    }

    return stats
  }
}

// Global instance
export const globalPromptPack = new PromptPackManager()