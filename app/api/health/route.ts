import { NextRequest, NextResponse } from 'next/server'
import { telemetry } from '@/lib/telemetry'
import { sentry } from '@/lib/sentry'

interface HealthCheck {
  service: string
  status: 'healthy' | 'unhealthy' | 'degraded'
  responseTime?: number
  error?: string
  details?: Record<string, any>
}

interface SystemHealth {
  status: 'healthy' | 'unhealthy' | 'degraded'
  timestamp: string
  uptime: number
  version: string
  environment: string
  checks: HealthCheck[]
  system: {
    memory: {
      used: number
      free: number
      total: number
      usage: number
    }
    cpu: {
      usage: number
    }
    node: {
      version: string
      uptime: number
    }
  }
}

async function checkDatabase(): Promise<HealthCheck> {
  const startTime = Date.now()

  try {
    // Try to import Prisma client
    const { PrismaClient } = await import('@prisma/client')
    const prisma = new PrismaClient()

    // Simple query to test connection
    await prisma.$queryRaw`SELECT 1`
    await prisma.$disconnect()

    return {
      service: 'database',
      status: 'healthy',
      responseTime: Date.now() - startTime,
      details: {
        provider: 'sqlite', // or 'postgresql' in production
      }
    }
  } catch (error) {
    return {
      service: 'database',
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

async function checkRedis(): Promise<HealthCheck> {
  const startTime = Date.now()

  try {
    // Try to import Redis
    const Redis = await import('ioredis')
    const redis = new Redis.default(process.env.UPSTASH_REDIS_URL || process.env.REDIS_URL || 'redis://localhost:6379')

    // Simple ping test
    const result = await redis.ping()
    await redis.disconnect()

    if (result === 'PONG') {
      return {
        service: 'redis',
        status: 'healthy',
        responseTime: Date.now() - startTime,
      }
    } else {
      return {
        service: 'redis',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: 'Redis ping failed',
      }
    }
  } catch (error) {
    return {
      service: 'redis',
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Redis connection failed',
    }
  }
}

async function checkPromptPack(): Promise<HealthCheck> {
  const startTime = Date.now()

  try {
    const { globalPromptPack } = await import('@/lib/promptPack')

    // Check if prompts are loaded
    const prompts = globalPromptPack.getPrompts()
    const stats = globalPromptPack.getStats()

    if (prompts.length > 0) {
      return {
        service: 'prompt_pack',
        status: 'healthy',
        responseTime: Date.now() - startTime,
        details: {
          total_prompts: prompts.length,
          categories: Object.keys(stats.by_category).length,
        }
      }
    } else {
      return {
        service: 'prompt_pack',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: 'No prompts loaded',
      }
    }
  } catch (error) {
    return {
      service: 'prompt_pack',
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Prompt pack error',
    }
  }
}

async function checkExternalAPIs(): Promise<HealthCheck[]> {
  const checks: HealthCheck[] = []
  const apis = [
    { name: 'openai', url: 'https://api.openai.com/v1/models', key: process.env.OPENAI_API_KEY },
    { name: 'anthropic', url: 'https://api.anthropic.com/v1/messages', key: process.env.ANTHROPIC_API_KEY },
  ]

  for (const api of apis) {
    const startTime = Date.now()

    try {
      if (!api.key) {
        checks.push({
          service: `api_${api.name}`,
          status: 'degraded',
          responseTime: Date.now() - startTime,
          error: 'API key not configured',
        })
        continue
      }

      // Simple HEAD request to check if API is reachable
      const response = await fetch(api.url, {
        method: 'HEAD',
        headers: api.name === 'openai'
          ? { 'Authorization': `Bearer ${api.key}` }
          : { 'x-api-key': api.key },
        signal: AbortSignal.timeout(5000), // 5 second timeout
      })

      checks.push({
        service: `api_${api.name}`,
        status: response.ok ? 'healthy' : 'degraded',
        responseTime: Date.now() - startTime,
        details: {
          status_code: response.status,
        }
      })
    } catch (error) {
      checks.push({
        service: `api_${api.name}`,
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'API check failed',
      })
    }
  }

  return checks
}

function getSystemMetrics() {
  const memoryUsage = process.memoryUsage()

  return {
    memory: {
      used: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
      free: Math.round((memoryUsage.heapTotal - memoryUsage.heapUsed) / 1024 / 1024), // MB
      total: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
      usage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100), // %
    },
    cpu: {
      usage: Math.round(process.cpuUsage().user / 1000), // Simplified CPU usage
    },
    node: {
      version: process.version,
      uptime: Math.round(process.uptime()),
    }
  }
}

export async function GET(request: NextRequest) {
  const requestId = telemetry.startRequest(request)
  const startTime = Date.now()

  try {
    // Run all health checks in parallel
    const [
      databaseCheck,
      redisCheck,
      promptPackCheck,
      ...apiChecks
    ] = await Promise.all([
      checkDatabase(),
      checkRedis(),
      checkPromptPack(),
      ...await checkExternalAPIs(),
    ])

    const allChecks = [databaseCheck, redisCheck, promptPackCheck, ...apiChecks]

    // Determine overall system status
    const hasUnhealthy = allChecks.some(check => check.status === 'unhealthy')
    const hasDegraded = allChecks.some(check => check.status === 'degraded')

    const overallStatus = hasUnhealthy ? 'unhealthy' : hasDegraded ? 'degraded' : 'healthy'

    const healthData: SystemHealth = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      checks: allChecks,
      system: getSystemMetrics(),
    }

    // Log health check results
    telemetry.endRequest(requestId, 200, undefined, {
      health_status: overallStatus,
      checks_count: allChecks.length,
      duration: Date.now() - startTime,
    })

    // Set appropriate HTTP status code
    const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503

    return NextResponse.json(healthData, { status: statusCode })

  } catch (error) {
    const healthData: SystemHealth = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      checks: [{
        service: 'health_check',
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Health check failed',
      }],
      system: getSystemMetrics(),
    }

    telemetry.endRequest(requestId, 503, error instanceof Error ? error : new Error('Health check failed'))
    sentry.captureError(error instanceof Error ? error : new Error('Health check failed'))

    return NextResponse.json(healthData, { status: 503 })
  }
}

// Simple readiness check for load balancers
export async function HEAD(request: NextRequest) {
  const requestId = telemetry.startRequest(request)

  try {
    // Quick check - just verify the app is running
    telemetry.endRequest(requestId, 200)
    return new NextResponse(null, { status: 200 })
  } catch (error) {
    telemetry.endRequest(requestId, 503, error instanceof Error ? error : new Error('Readiness check failed'))
    return new NextResponse(null, { status: 503 })
  }
}