import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { globalPromptPack, DEFAULT_DEALER_DEFAULTS, DealerDefaults } from '@/lib/promptPack'
import { apiLogger, logRequest } from '@/lib/logger'
import { batchRateLimit, createRateLimitHeaders } from '@/lib/rate-limit'
import { readFileSync } from 'fs'
import { join } from 'path'

const BatchPreviewSchema = z.object({
  prompt_ids: z.array(z.string()).min(1).max(40),
  dealer_defaults: z.record(z.string()).optional(),
  filters: z.object({
    intent: z.string().optional(),
    language: z.string().optional(),
    category: z.string().optional(),
  }).optional(),
  include_cost_estimate: z.boolean().default(true),
})

function getClientIdentifier(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  return forwardedFor?.split(',')[0] || realIp || 'anonymous'
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Rate limiting
    const clientId = getClientIdentifier(request)
    const rateLimitResult = await batchRateLimit.checkLimit(clientId)

    if (!rateLimitResult.allowed) {
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          retryAfter: rateLimitResult.retryAfter,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            ...createRateLimitHeaders(rateLimitResult, 5),
          },
        }
      )
    }

    // Load prompt pack if not already loaded
    if (!globalPromptPack['promptPack']) {
      const promptPackPath = join(process.cwd(), 'data/prompt-packs/dealershipai_prompt_pack_v1.json')
      try {
        const data = readFileSync(promptPackPath, 'utf-8')
        globalPromptPack.loadFromString(data)
        apiLogger.info('Prompt pack loaded successfully')
      } catch (error) {
        apiLogger.error({ error }, 'Failed to load prompt pack')
        return NextResponse.json(
          { error: 'Failed to load prompt pack' },
          { status: 500 }
        )
      }
    }

    // Parse request body
    const body = await request.json()
    const parseResult = BatchPreviewSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parseResult.error.errors },
        { status: 400 }
      )
    }

    const { prompt_ids, dealer_defaults, filters, include_cost_estimate } = parseResult.data

    // Merge dealer defaults
    const mergedDefaults: DealerDefaults = {
      ...DEFAULT_DEALER_DEFAULTS,
      ...dealer_defaults,
    }

    // Hydrate prompts
    const hydratedPrompts = globalPromptPack.hydrateMultiplePrompts(
      prompt_ids,
      mergedDefaults,
      filters || {}
    )

    // Calculate totals
    let totalEstimatedCost = 0
    const missingVariablesByPrompt: Record<string, string[]> = {}

    hydratedPrompts.forEach(prompt => {
      if (include_cost_estimate) {
        totalEstimatedCost += prompt.cost_estimate_cents
      }

      if (prompt.missing_variables.length > 0) {
        missingVariablesByPrompt[prompt.id] = prompt.missing_variables
      }
    })

    // Prepare response
    const responseData = {
      preview: {
        total_prompts: hydratedPrompts.length,
        requested_prompts: prompt_ids.length,
        filtered_prompts: prompt_ids.length - hydratedPrompts.length,
        total_estimated_cost_cents: include_cost_estimate ? totalEstimatedCost : undefined,
        missing_variables_count: Object.keys(missingVariablesByPrompt).length,
      },
      prompts: hydratedPrompts.map(prompt => ({
        id: prompt.id,
        title: prompt.title,
        category: prompt.category,
        intent: prompt.intent,
        language: prompt.language,
        template_length: prompt.hydrated_template.length,
        cost_estimate_cents: include_cost_estimate ? prompt.cost_estimate_cents : undefined,
        missing_variables: prompt.missing_variables,
        engines: prompt.engine_defaults.engines,
        timeout_ms: prompt.engine_defaults.timeout_ms,
      })),
      missing_variables: missingVariablesByPrompt,
      dealer_defaults_used: mergedDefaults,
      filters_applied: filters || {},
    }

    const response = NextResponse.json(responseData)

    // Add rate limit headers
    response.headers.set('X-RateLimit-Limit', '5')
    response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString())
    response.headers.set('X-RateLimit-Reset', rateLimitResult.reset.toString())

    apiLogger.info({
      promptCount: hydratedPrompts.length,
      totalCost: totalEstimatedCost,
      missingVariables: Object.keys(missingVariablesByPrompt).length,
    }, 'Batch preview generated')

    logRequest(request, startTime)
    return response

  } catch (error) {
    apiLogger.error({ error }, 'Error in /api/batch/preview POST')
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}