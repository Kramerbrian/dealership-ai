import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { globalPromptPack, DEFAULT_DEALER_DEFAULTS, DealerDefaults } from '@/lib/promptPack'
import { apiLogger, logRequest } from '@/lib/logger'
import { apiRateLimit, createRateLimitHeaders } from '@/lib/rate-limit'
import { readFileSync } from 'fs'
import { join } from 'path'

const ExpandPromptSchema = z.object({
  prompt_id: z.string(),
  dealer_defaults: z.record(z.string()).optional(),
  variable_overrides: z.record(z.any()).optional(),
  include_metadata: z.boolean().default(true),
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
    const rateLimitResult = await apiRateLimit.checkLimit(clientId)

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
            ...createRateLimitHeaders(rateLimitResult, 100),
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
    const parseResult = ExpandPromptSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parseResult.error.errors },
        { status: 400 }
      )
    }

    const { prompt_id, dealer_defaults, variable_overrides, include_metadata } = parseResult.data

    // Merge dealer defaults
    const mergedDefaults: DealerDefaults = {
      ...DEFAULT_DEALER_DEFAULTS,
      ...dealer_defaults,
      ...(variable_overrides || {}),
    }

    // Expand the prompt
    const expandedResult = globalPromptPack.expandPrompt(prompt_id, mergedDefaults)

    if (!expandedResult) {
      return NextResponse.json(
        { error: `Prompt not found: ${prompt_id}` },
        { status: 404 }
      )
    }

    const { prompt, metadata } = expandedResult

    // Prepare response
    const responseData = {
      prompt: {
        id: prompt.id,
        title: prompt.title,
        category: prompt.category,
        intent: prompt.intent,
        language: prompt.language,
        personas: prompt.personas,
        hydrated_template: prompt.hydrated_template,
        missing_variables: prompt.missing_variables,
        engine_defaults: prompt.engine_defaults,
        rate_limit: prompt.rate_limit,
        eval_signals: prompt.eval_signals,
        tags: prompt.tags || [],
      },
      ...(include_metadata && { metadata }),
      expansion_details: {
        template_original_length: prompt.template.length,
        template_expanded_length: prompt.hydrated_template.length,
        variables_substituted: Object.keys(metadata.variables_used).length,
        missing_variables_count: prompt.missing_variables.length,
        expansion_timestamp: new Date().toISOString(),
      },
    }

    const response = NextResponse.json(responseData)

    // Add rate limit headers
    response.headers.set('X-RateLimit-Limit', '100')
    response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString())
    response.headers.set('X-RateLimit-Reset', rateLimitResult.reset.toString())

    apiLogger.info({
      promptId: prompt_id,
      templateLength: prompt.hydrated_template.length,
      missingVariables: prompt.missing_variables.length,
      costEstimate: metadata.estimated_cost_cents,
    }, 'Prompt expanded successfully')

    logRequest(request, startTime)
    return response

  } catch (error) {
    apiLogger.error({ error }, 'Error in /api/batch/expand POST')
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