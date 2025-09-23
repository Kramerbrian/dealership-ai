import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { globalPromptPack } from '@/lib/promptPack'
import { apiLogger, logRequest } from '@/lib/logger'
import { apiRateLimit, createRateLimitHeaders } from '@/lib/rate-limit'
import { readFileSync } from 'fs'
import { join } from 'path'

const QuerySchema = z.object({
  category: z.string().optional(),
  intent: z.string().optional(),
  language: z.string().optional(),
  tags: z.string().optional(),
  validate: z.string().optional().transform(val => val === 'true'),
})

function getClientIdentifier(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  return forwardedFor?.split(',')[0] || realIp || 'anonymous'
}

export async function GET(request: NextRequest) {
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
            'X-RateLimit-Limit': '100',
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': rateLimitResult.reset.toString(),
            'Retry-After': (rateLimitResult.retryAfter || 60).toString(),
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

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const queryResult = QuerySchema.safeParse({
      category: searchParams.get('category'),
      intent: searchParams.get('intent'),
      language: searchParams.get('language'),
      tags: searchParams.get('tags'),
      validate: searchParams.get('validate'),
    })

    if (!queryResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: queryResult.error.errors },
        { status: 400 }
      )
    }

    const { category, intent, language, tags, validate } = queryResult.data

    // Get prompts with optional filtering
    let prompts = globalPromptPack.getPrompts()

    if (category) {
      prompts = prompts.filter(p => p.category === category)
    }

    if (intent) {
      prompts = prompts.filter(p => p.intent === intent)
    }

    if (language) {
      prompts = prompts.filter(p => p.language === language)
    }

    if (tags) {
      const tagList = tags.split(',').map(t => t.trim())
      prompts = prompts.filter(p =>
        tagList.some(tag => p.tags?.includes(tag))
      )
    }

    // Prepare response data
    const responseData = {
      prompts: prompts.map(prompt => ({
        id: prompt.id,
        title: prompt.title,
        category: prompt.category,
        intent: prompt.intent,
        personas: prompt.personas,
        language: prompt.language,
        tags: prompt.tags || [],
        variables: prompt.variables.map(v => ({
          name: v.name,
          description: v.description,
          type: v.type,
          required: v.required,
          default: v.default,
        })),
        engine_defaults: prompt.engine_defaults,
        rate_limit: prompt.rate_limit,
      })),
      stats: globalPromptPack.getStats(),
      ...(validate && {
        validation_errors: globalPromptPack.getValidationErrors(),
      }),
    }

    const response = NextResponse.json(responseData)

    // Add rate limit headers
    const headers = createRateLimitHeaders(rateLimitResult, 100)
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    logRequest(request, startTime)
    return response

  } catch (error) {
    apiLogger.error({ error }, 'Error in /api/prompts GET')
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
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}