import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { queueLogger, logRequest } from '@/lib/logger'
import { apiRateLimit, createRateLimitHeaders } from '@/lib/rate-limit'
import { Cache } from '@/lib/cache'

const JobQuerySchema = z.object({
  state: z.enum(['waiting', 'active', 'completed', 'failed', 'delayed', 'retry']).optional(),
  limit: z.string().transform(val => parseInt(val, 10)).pipe(z.number().min(1).max(100)).optional().default(20),
  offset: z.string().transform(val => parseInt(val, 10)).pipe(z.number().min(0)).optional().default(0),
})

function getClientIdentifier(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  return forwardedFor?.split(',')[0] || realIp || 'anonymous'
}

function generateMockJob(id: string, state: string) {
  const now = Date.now()
  const createdAt = now - Math.floor(Math.random() * 3600000) // Up to 1 hour ago

  return {
    id,
    name: 'batch-test',
    state,
    data: {
      batch_id: `batch_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      prompt_count: Math.floor(Math.random() * 20) + 5,
      engines: ['perplexity', 'openai', 'anthropic'].slice(0, Math.floor(Math.random() * 3) + 1),
      priority: ['low', 'normal', 'high'][Math.floor(Math.random() * 3)],
    },
    progress: state === 'completed' ? 100 : state === 'failed' ? Math.floor(Math.random() * 80) + 10 : Math.floor(Math.random() * 50),
    created_at: new Date(createdAt).toISOString(),
    started_at: state !== 'waiting' ? new Date(createdAt + 60000).toISOString() : null,
    completed_at: state === 'completed' ? new Date(createdAt + 300000).toISOString() :
                   state === 'failed' ? new Date(createdAt + 180000).toISOString() : null,
    failed_reason: state === 'failed' ? ['Timeout', 'API Error', 'Rate Limit'][Math.floor(Math.random() * 3)] : null,
    attempts: state === 'retry' ? Math.floor(Math.random() * 3) + 1 : 1,
    delay: state === 'delayed' ? Math.floor(Math.random() * 300000) + 60000 : 0,
  }
}

async function getQueueJobs(state?: string, limit: number = 20, offset: number = 0) {
  try {
    // Try to get real jobs from cache/queue system
    const cacheKey = `queue:jobs:${state || 'all'}:${limit}:${offset}`
    const cachedJobs = await Cache.get(cacheKey)

    if (cachedJobs) {
      return JSON.parse(cachedJobs)
    }

    // Generate mock jobs
    const states = state ? [state] : ['waiting', 'active', 'completed', 'failed', 'retry']
    const mockJobs = []

    let jobId = 1000 + offset

    for (let i = 0; i < limit; i++) {
      const selectedState = states[Math.floor(Math.random() * states.length)]
      mockJobs.push(generateMockJob((jobId++).toString(), selectedState))
    }

    const result = {
      jobs: mockJobs,
      pagination: {
        limit,
        offset,
        total: 150 + Math.floor(Math.random() * 50), // Mock total
        has_more: offset + limit < 200,
      },
      summary: {
        total_jobs: mockJobs.length,
        by_state: mockJobs.reduce((acc: Record<string, number>, job) => {
          acc[job.state] = (acc[job.state] || 0) + 1
          return acc
        }, {}),
      },
      last_updated: new Date().toISOString(),
    }

    // Cache for a short time
    await Cache.set(cacheKey, JSON.stringify(result), 30)

    return result
  } catch (error) {
    queueLogger.error({ error }, 'Failed to get queue jobs')
    return {
      jobs: [],
      pagination: { limit, offset, total: 0, has_more: false },
      summary: { total_jobs: 0, by_state: {} },
      error: 'Jobs unavailable',
    }
  }
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
            ...createRateLimitHeaders(rateLimitResult, 100),
          },
        }
      )
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const queryResult = JobQuerySchema.safeParse({
      state: searchParams.get('state'),
      limit: searchParams.get('limit') || '20',
      offset: searchParams.get('offset') || '0',
    })

    if (!queryResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: queryResult.error.errors },
        { status: 400 }
      )
    }

    const { state, limit, offset } = queryResult.data

    // Get queue jobs
    const jobsData = await getQueueJobs(state, limit, offset)

    const responseData = {
      ...jobsData,
      system_info: {
        redis_connected: Cache.isConnected(),
        queue_available: Cache.isConnected(),
        simulation_mode: !Cache.isConnected(),
      },
      filters: {
        state: state || 'all',
        limit,
        offset,
      },
    }

    const response = NextResponse.json(responseData)

    // Add rate limit headers
    response.headers.set('X-RateLimit-Limit', '100')
    response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString())
    response.headers.set('X-RateLimit-Reset', rateLimitResult.reset.toString())

    queueLogger.debug({
      state,
      limit,
      offset,
      jobCount: jobsData.jobs?.length || 0,
    }, 'Queue jobs retrieved')

    logRequest(request, startTime)
    return response

  } catch (error) {
    queueLogger.error({ error }, 'Error in /api/queue/jobs GET')
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