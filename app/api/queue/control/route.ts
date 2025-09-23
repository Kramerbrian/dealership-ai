import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { queueLogger, logRequest } from '@/lib/logger'
import { apiRateLimit, createRateLimitHeaders } from '@/lib/rate-limit'
import { Cache } from '@/lib/cache'

const QueueControlSchema = z.object({
  action: z.enum(['pause', 'resume', 'drain']),
})

function getClientIdentifier(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  return forwardedFor?.split(',')[0] || realIp || 'anonymous'
}

async function getQueueStatus() {
  try {
    const cachedStatus = await Cache.get('queue:status')
    if (cachedStatus) {
      return JSON.parse(cachedStatus)
    }

    // Default status
    const status = {
      paused: false,
      draining: false,
      last_action: null,
      last_action_timestamp: null,
    }

    await Cache.set('queue:status', JSON.stringify(status), 86400) // 24 hours
    return status
  } catch (error) {
    return {
      paused: false,
      draining: false,
      last_action: null,
      last_action_timestamp: null,
      error: 'Status unavailable',
    }
  }
}

async function performQueueAction(action: string) {
  try {
    queueLogger.info({ action }, 'Performing queue control action')

    // Get current status
    const currentStatus = await getQueueStatus()

    // Update status based on action
    let newStatus = { ...currentStatus }

    switch (action) {
      case 'pause':
        newStatus.paused = true
        newStatus.draining = false
        break
      case 'resume':
        newStatus.paused = false
        newStatus.draining = false
        break
      case 'drain':
        newStatus.paused = false
        newStatus.draining = true
        break
    }

    newStatus.last_action = action
    newStatus.last_action_timestamp = new Date().toISOString()

    // Save new status
    await Cache.set('queue:status', JSON.stringify(newStatus), 86400)

    // In a real implementation, this would interact with BullMQ
    // For simulation, we just update the cached status

    const result = {
      action,
      success: true,
      previous_state: {
        paused: currentStatus.paused,
        draining: currentStatus.draining,
      },
      new_state: {
        paused: newStatus.paused,
        draining: newStatus.draining,
      },
      message: `Queue ${action} action completed successfully`,
      timestamp: newStatus.last_action_timestamp,
      estimated_effect: getActionEffect(action),
    }

    queueLogger.info({ action, result }, 'Queue control action completed')
    return result

  } catch (error) {
    queueLogger.error({ error, action }, 'Failed to perform queue control action')
    return {
      action,
      success: false,
      message: 'Control action failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }
  }
}

function getActionEffect(action: string): string {
  switch (action) {
    case 'pause':
      return 'Queue will stop processing new jobs. Active jobs will continue to completion.'
    case 'resume':
      return 'Queue will resume processing jobs normally.'
    case 'drain':
      return 'Queue will complete all active jobs and stop accepting new ones until resumed.'
    default:
      return 'Unknown action effect'
  }
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

    // Parse request body
    const body = await request.json()
    const parseResult = QueueControlSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parseResult.error.errors },
        { status: 400 }
      )
    }

    const { action } = parseResult.data

    // Perform queue control action
    const actionResult = await performQueueAction(action)

    const responseData = {
      result: actionResult,
      system_info: {
        redis_connected: Cache.isConnected(),
        queue_available: Cache.isConnected(),
        simulation_mode: !Cache.isConnected(),
      },
      queue_status: await getQueueStatus(),
    }

    const response = NextResponse.json(responseData)

    // Add rate limit headers
    response.headers.set('X-RateLimit-Limit', '100')
    response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString())
    response.headers.set('X-RateLimit-Reset', rateLimitResult.reset.toString())

    logRequest(request, startTime)
    return response

  } catch (error) {
    queueLogger.error({ error }, 'Error in /api/queue/control POST')
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
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

    // Get current queue status
    const queueStatus = await getQueueStatus()

    const responseData = {
      queue_status: queueStatus,
      available_actions: {
        pause: !queueStatus.paused && !queueStatus.draining,
        resume: queueStatus.paused || queueStatus.draining,
        drain: !queueStatus.draining,
      },
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

    logRequest(request, startTime)
    return response

  } catch (error) {
    queueLogger.error({ error }, 'Error in /api/queue/control GET')
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