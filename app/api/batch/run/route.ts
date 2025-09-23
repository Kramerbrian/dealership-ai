import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { globalPromptPack, DEFAULT_DEALER_DEFAULTS, DealerDefaults } from '@/lib/promptPack'
import { apiLogger, queueLogger, logRequest } from '@/lib/logger'
import { batchRateLimit, createRateLimitHeaders } from '@/lib/rate-limit'
import { Cache } from '@/lib/cache'
import { readFileSync } from 'fs'
import { join } from 'path'

const BatchRunSchema = z.object({
  prompt_ids: z.array(z.string()).min(1).max(40),
  dealer_defaults: z.record(z.string()).optional(),
  filters: z.object({
    intent: z.string().optional(),
    language: z.string().optional(),
    category: z.string().optional(),
  }).optional(),
  engines: z.array(z.string()).optional(),
  simulation_mode: z.boolean().default(false),
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
  webhook_url: z.string().url().optional(),
})

function getClientIdentifier(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  return forwardedFor?.split(',')[0] || realIp || 'anonymous'
}

function generateBatchId(): string {
  return `batch_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
}

async function simulateBatchExecution(
  batchId: string,
  hydratedPrompts: any[],
  engines: string[]
) {
  // Simulate batch execution with mock results
  const simulationResults = {
    batch_id: batchId,
    status: 'completed',
    total_prompts: hydratedPrompts.length,
    total_engines: engines.length,
    total_executions: hydratedPrompts.length * engines.length,
    estimated_duration_minutes: Math.ceil((hydratedPrompts.length * engines.length * 30) / 60),
    estimated_cost_cents: hydratedPrompts.reduce((sum, p) => sum + p.cost_estimate_cents, 0) * engines.length,
    simulation: true,
    started_at: new Date().toISOString(),
    completed_at: new Date(Date.now() + 1000).toISOString(),
    results_preview: hydratedPrompts.slice(0, 3).map(prompt => ({
      prompt_id: prompt.id,
      engines: engines.map(engine => ({
        engine,
        status: 'completed',
        mock_score: Math.random() * 3 + 1,
        mock_positions: [1, 3, 5],
        mock_citations: 2,
      })),
    })),
  }

  // Store simulation results in cache for retrieval
  await Cache.set(`batch_result:${batchId}`, JSON.stringify(simulationResults), 3600)

  queueLogger.info({
    batchId,
    promptCount: hydratedPrompts.length,
    engines,
    simulation: true,
  }, 'Batch execution simulated')

  return simulationResults
}

async function enqueueBatchJob(
  batchId: string,
  hydratedPrompts: any[],
  engines: string[],
  priority: string,
  webhookUrl?: string
) {
  // In a real implementation, this would enqueue to BullMQ
  // For now, we'll simulate the job creation
  const jobData = {
    batch_id: batchId,
    prompts: hydratedPrompts.map(p => ({
      id: p.id,
      template: p.hydrated_template,
      engines: engines,
      rate_limit: p.rate_limit,
      eval_signals: p.eval_signals,
    })),
    priority,
    webhook_url: webhookUrl,
    created_at: new Date().toISOString(),
  }

  // Store job data in cache
  await Cache.set(`batch_job:${batchId}`, JSON.stringify(jobData), 86400) // 24 hours

  // Create a mock job result that would be processed by the worker
  const mockJobResult = {
    batch_id: batchId,
    status: 'queued',
    position_in_queue: Math.floor(Math.random() * 5) + 1,
    estimated_start_time: new Date(Date.now() + 60000).toISOString(),
    estimated_completion_time: new Date(Date.now() + 300000).toISOString(),
  }

  queueLogger.info({
    batchId,
    promptCount: hydratedPrompts.length,
    engines,
    priority,
  }, 'Batch job enqueued')

  return mockJobResult
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
    const parseResult = BatchRunSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parseResult.error.errors },
        { status: 400 }
      )
    }

    const {
      prompt_ids,
      dealer_defaults,
      filters,
      engines,
      simulation_mode,
      priority,
      webhook_url
    } = parseResult.data

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

    if (hydratedPrompts.length === 0) {
      return NextResponse.json(
        { error: 'No prompts match the specified criteria' },
        { status: 400 }
      )
    }

    // Determine engines to use
    const selectedEngines = engines || ['perplexity', 'openai', 'anthropic', 'gemini']

    // Generate batch ID
    const batchId = generateBatchId()

    let responseData: any

    if (simulation_mode) {
      // Run simulation
      responseData = await simulateBatchExecution(batchId, hydratedPrompts, selectedEngines)
    } else {
      // Enqueue real job (or simulate queue if Redis unavailable)
      const isRedisAvailable = Cache.isConnected()

      if (isRedisAvailable) {
        responseData = await enqueueBatchJob(batchId, hydratedPrompts, selectedEngines, priority, webhook_url)
        responseData.queued = true
      } else {
        // Fall back to simulation if no queue available
        responseData = await simulateBatchExecution(batchId, hydratedPrompts, selectedEngines)
        responseData.note = 'Simulation mode: No queue available'
      }
    }

    const response = NextResponse.json(responseData)

    // Add rate limit headers
    response.headers.set('X-RateLimit-Limit', '5')
    response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString())
    response.headers.set('X-RateLimit-Reset', rateLimitResult.reset.toString())

    apiLogger.info({
      batchId,
      promptCount: hydratedPrompts.length,
      engines: selectedEngines,
      simulation: simulation_mode,
      priority,
    }, 'Batch run initiated')

    logRequest(request, startTime)
    return response

  } catch (error) {
    apiLogger.error({ error }, 'Error in /api/batch/run POST')
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