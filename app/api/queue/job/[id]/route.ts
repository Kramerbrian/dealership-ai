import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { queueLogger, logRequest } from '@/lib/logger'
import { apiRateLimit, createRateLimitHeaders } from '@/lib/rate-limit'
import { Cache } from '@/lib/cache'

interface RouteParams {
  params: {
    id: string
  }
}

const JobActionSchema = z.object({
  action: z.enum(['retry', 'remove', 'promote']),
})

function getClientIdentifier(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  return forwardedFor?.split(',')[0] || realIp || 'anonymous'
}

function generateMockJobDetails(jobId: string) {
  const now = Date.now()
  const createdAt = now - Math.floor(Math.random() * 3600000) // Up to 1 hour ago
  const state = ['waiting', 'active', 'completed', 'failed'][Math.floor(Math.random() * 4)]

  return {
    id: jobId,
    name: 'batch-test',
    state,
    data: {
      batch_id: `batch_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      prompts: [
        {
          id: 'visibility_basic_top5',
          template: 'Search for "Toyota dealership near Naples FL" and list the top 5 results...',
          engines: ['perplexity', 'openai'],
        },
        {
          id: 'competition_crusher_compare',
          template: 'Compare Germain Toyota of Naples directly against Toyota of North Naples...',
          engines: ['anthropic', 'openai'],
        },
      ],
      dealer_defaults: {
        dealer: 'Germain Toyota of Naples',
        brand: 'Toyota',
        city: 'Naples',
        state: 'FL',
      },
      priority: 'normal',
      webhook_url: null,
    },
    progress: state === 'completed' ? 100 : state === 'failed' ? Math.floor(Math.random() * 80) + 10 : Math.floor(Math.random() * 50),
    created_at: new Date(createdAt).toISOString(),
    started_at: state !== 'waiting' ? new Date(createdAt + 60000).toISOString() : null,
    completed_at: state === 'completed' ? new Date(createdAt + 300000).toISOString() :
                   state === 'failed' ? new Date(createdAt + 180000).toISOString() : null,
    failed_reason: state === 'failed' ? 'AI API timeout' : null,
    attempts: Math.floor(Math.random() * 3) + 1,
    delay: 0,
    logs: [
      {
        timestamp: new Date(createdAt).toISOString(),
        level: 'info',
        message: 'Job created and queued',
      },
      ...(state !== 'waiting' ? [{
        timestamp: new Date(createdAt + 60000).toISOString(),
        level: 'info',
        message: 'Job processing started',
      }] : []),
      ...(state === 'completed' ? [{
        timestamp: new Date(createdAt + 300000).toISOString(),
        level: 'info',
        message: 'Job completed successfully',
      }] : []),
      ...(state === 'failed' ? [{
        timestamp: new Date(createdAt + 180000).toISOString(),
        level: 'error',
        message: 'Job failed: AI API timeout',
      }] : []),
    ],
    results: state === 'completed' ? {
      total_executions: 4,
      successful_executions: 4,
      failed_executions: 0,
      avg_score: 2.3,
      best_prompt: 'visibility_basic_top5',
      worst_prompt: null,
    } : null,
  }
}

async function getJobDetails(jobId: string) {
  try {
    // Try to get real job from cache/queue system
    const cachedJob = await Cache.get(`job:${jobId}`)

    if (cachedJob) {
      return JSON.parse(cachedJob)
    }

    // Generate mock job details
    const mockJob = generateMockJobDetails(jobId)

    // Cache for retrieval
    await Cache.set(`job:${jobId}`, JSON.stringify(mockJob), 3600)

    return mockJob
  } catch (error) {
    queueLogger.error({ error, jobId }, 'Failed to get job details')
    return null
  }
}

async function performJobAction(jobId: string, action: string) {
  try {
    queueLogger.info({ jobId, action }, 'Performing job action')

    // In a real implementation, this would interact with the queue system
    // For now, simulate the action
    const result = {
      job_id: jobId,
      action,
      success: true,
      message: `Job ${action} action completed successfully`,
      timestamp: new Date().toISOString(),
    }

    // Update cached job state if it exists
    const cachedJob = await Cache.get(`job:${jobId}`)
    if (cachedJob) {
      const job = JSON.parse(cachedJob)

      switch (action) {
        case 'retry':
          job.state = 'waiting'
          job.attempts += 1
          job.failed_reason = null
          break
        case 'remove':
          // In real implementation, job would be removed from queue
          job.state = 'removed'
          break
        case 'promote':
          job.data.priority = 'high'
          break
      }

      await Cache.set(`job:${jobId}`, JSON.stringify(job), 3600)
    }

    return result
  } catch (error) {
    queueLogger.error({ error, jobId, action }, 'Failed to perform job action')
    return {
      job_id: jobId,
      action,
      success: false,
      message: 'Action failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
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

    const { id: jobId } = params

    // Get job details
    const jobDetails = await getJobDetails(jobId)

    if (!jobDetails) {
      return NextResponse.json(
        { error: `Job not found: ${jobId}` },
        { status: 404 }
      )
    }

    const responseData = {
      job: jobDetails,
      system_info: {
        redis_connected: Cache.isConnected(),
        queue_available: Cache.isConnected(),
        simulation_mode: !Cache.isConnected(),
      },
    }

    const response = NextResponse.json(responseData)

    // Add rate limit headers
    response.headers.set('X-RateLimit-Limit', '100')
    response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString())
    response.headers.set('X-RateLimit-Reset', rateLimitResult.reset.toString())

    queueLogger.debug({ jobId }, 'Job details retrieved')

    logRequest(request, startTime)
    return response

  } catch (error) {
    queueLogger.error({ error }, 'Error in /api/queue/job/[id] GET')
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
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

    const { id: jobId } = params

    // Parse request body
    const body = await request.json()
    const parseResult = JobActionSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parseResult.error.errors },
        { status: 400 }
      )
    }

    const { action } = parseResult.data

    // Perform job action
    const actionResult = await performJobAction(jobId, action)

    const responseData = {
      result: actionResult,
      system_info: {
        redis_connected: Cache.isConnected(),
        queue_available: Cache.isConnected(),
        simulation_mode: !Cache.isConnected(),
      },
    }

    const response = NextResponse.json(responseData)

    // Add rate limit headers
    response.headers.set('X-RateLimit-Limit', '100')
    response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString())
    response.headers.set('X-RateLimit-Reset', rateLimitResult.reset.toString())

    queueLogger.info({ jobId, action, success: actionResult.success }, 'Job action performed')

    logRequest(request, startTime)
    return response

  } catch (error) {
    queueLogger.error({ error }, 'Error in /api/queue/job/[id] POST')
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
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}