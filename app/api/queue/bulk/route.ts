import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { queueLogger, logRequest } from '@/lib/logger'
import { apiRateLimit, createRateLimitHeaders } from '@/lib/rate-limit'
import { Cache } from '@/lib/cache'

const BulkJobActionSchema = z.object({
  action: z.enum(['retry', 'remove', 'promote']),
  job_ids: z.array(z.string()).min(1).max(50),
  filters: z.object({
    state: z.enum(['waiting', 'active', 'completed', 'failed', 'delayed', 'retry']).optional(),
    created_before: z.string().optional(),
    created_after: z.string().optional(),
  }).optional(),
})

function getClientIdentifier(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  return forwardedFor?.split(',')[0] || realIp || 'anonymous'
}

async function performBulkJobAction(action: string, jobIds: string[], filters?: any) {
  try {
    queueLogger.info({ action, jobCount: jobIds.length, filters }, 'Performing bulk job action')

    const results = {
      action,
      requested_jobs: jobIds.length,
      successful: 0,
      failed: 0,
      skipped: 0,
      results: [] as any[],
      errors: [] as any[],
    }

    // Process each job
    for (const jobId of jobIds) {
      try {
        // Check if job exists and meets filter criteria
        const cachedJob = await Cache.get(`job:${jobId}`)

        if (!cachedJob) {
          results.skipped++
          results.results.push({
            job_id: jobId,
            status: 'skipped',
            reason: 'Job not found',
          })
          continue
        }

        const job = JSON.parse(cachedJob)

        // Apply filters
        if (filters?.state && job.state !== filters.state) {
          results.skipped++
          results.results.push({
            job_id: jobId,
            status: 'skipped',
            reason: `Job state ${job.state} does not match filter ${filters.state}`,
          })
          continue
        }

        if (filters?.created_before && new Date(job.created_at) >= new Date(filters.created_before)) {
          results.skipped++
          results.results.push({
            job_id: jobId,
            status: 'skipped',
            reason: 'Job too recent',
          })
          continue
        }

        if (filters?.created_after && new Date(job.created_at) <= new Date(filters.created_after)) {
          results.skipped++
          results.results.push({
            job_id: jobId,
            status: 'skipped',
            reason: 'Job too old',
          })
          continue
        }

        // Perform action on job
        switch (action) {
          case 'retry':
            if (job.state === 'failed' || job.state === 'completed') {
              job.state = 'waiting'
              job.attempts += 1
              job.failed_reason = null
              await Cache.set(`job:${jobId}`, JSON.stringify(job), 3600)
              results.successful++
              results.results.push({
                job_id: jobId,
                status: 'success',
                action: 'retried',
              })
            } else {
              results.skipped++
              results.results.push({
                job_id: jobId,
                status: 'skipped',
                reason: `Cannot retry job in state ${job.state}`,
              })
            }
            break

          case 'remove':
            job.state = 'removed'
            await Cache.set(`job:${jobId}`, JSON.stringify(job), 3600)
            results.successful++
            results.results.push({
              job_id: jobId,
              status: 'success',
              action: 'removed',
            })
            break

          case 'promote':
            if (job.state === 'waiting' || job.state === 'delayed') {
              job.data.priority = 'high'
              await Cache.set(`job:${jobId}`, JSON.stringify(job), 3600)
              results.successful++
              results.results.push({
                job_id: jobId,
                status: 'success',
                action: 'promoted',
              })
            } else {
              results.skipped++
              results.results.push({
                job_id: jobId,
                status: 'skipped',
                reason: `Cannot promote job in state ${job.state}`,
              })
            }
            break
        }

      } catch (error) {
        results.failed++
        results.errors.push({
          job_id: jobId,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        results.results.push({
          job_id: jobId,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    results.timestamp = new Date().toISOString()
    results.summary = `${results.successful} successful, ${results.failed} failed, ${results.skipped} skipped`

    queueLogger.info({
      action,
      successful: results.successful,
      failed: results.failed,
      skipped: results.skipped
    }, 'Bulk job action completed')

    return results

  } catch (error) {
    queueLogger.error({ error, action }, 'Failed to perform bulk job action')
    return {
      action,
      success: false,
      message: 'Bulk action failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }
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
    const parseResult = BulkJobActionSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parseResult.error.errors },
        { status: 400 }
      )
    }

    const { action, job_ids, filters } = parseResult.data

    // Perform bulk job action
    const actionResult = await performBulkJobAction(action, job_ids, filters)

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

    queueLogger.info({
      action,
      jobCount: job_ids.length,
      successful: actionResult.successful || 0,
      failed: actionResult.failed || 0,
    }, 'Bulk job action request completed')

    logRequest(request, startTime)
    return response

  } catch (error) {
    queueLogger.error({ error }, 'Error in /api/queue/bulk POST')
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