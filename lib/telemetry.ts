// Production-grade telemetry and performance monitoring
import { createLogger } from './logger'
import { NextRequest } from 'next/server'

const telemetryLogger = createLogger('telemetry')

export interface RequestMetrics {
  requestId: string
  method: string
  url: string
  userAgent?: string
  ip?: string
  startTime: number
  endTime?: number
  duration?: number
  statusCode?: number
  error?: Error
  userId?: string
  dealerId?: string
}

export interface APIMetrics {
  endpoint: string
  method: string
  averageLatency: number
  requestCount: number
  errorRate: number
  last24h: {
    requests: number
    errors: number
    avgLatency: number
  }
}

export class TelemetryService {
  private static instance: TelemetryService
  private requestMetrics: Map<string, RequestMetrics> = new Map()
  private apiMetrics: Map<string, APIMetrics> = new Map()

  static getInstance(): TelemetryService {
    if (!TelemetryService.instance) {
      TelemetryService.instance = new TelemetryService()
    }
    return TelemetryService.instance
  }

  generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  startRequest(request: NextRequest): string {
    const requestId = this.generateRequestId()
    const metrics: RequestMetrics = {
      requestId,
      method: request.method,
      url: request.url,
      userAgent: request.headers.get('user-agent') || undefined,
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      startTime: Date.now(),
    }

    this.requestMetrics.set(requestId, metrics)

    telemetryLogger.info({
      requestId,
      method: metrics.method,
      url: metrics.url,
      userAgent: metrics.userAgent,
      ip: metrics.ip,
    }, 'Request started')

    return requestId
  }

  endRequest(requestId: string, statusCode: number, error?: Error, metadata?: Record<string, any>) {
    const metrics = this.requestMetrics.get(requestId)
    if (!metrics) return

    metrics.endTime = Date.now()
    metrics.duration = metrics.endTime - metrics.startTime
    metrics.statusCode = statusCode
    metrics.error = error

    // Log request completion
    const logData = {
      requestId,
      method: metrics.method,
      url: metrics.url,
      duration: metrics.duration,
      statusCode,
      ...metadata,
    }

    if (error) {
      telemetryLogger.error({
        ...logData,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
      }, 'Request failed')
    } else {
      telemetryLogger.info(logData, 'Request completed')
    }

    // Update API metrics
    this.updateAPIMetrics(metrics)

    // Clean up old metrics (keep last 1000 requests)
    if (this.requestMetrics.size > 1000) {
      const oldestKey = this.requestMetrics.keys().next().value
      this.requestMetrics.delete(oldestKey)
    }
  }

  private updateAPIMetrics(request: RequestMetrics) {
    const endpoint = this.normalizeEndpoint(request.url)
    const key = `${request.method}:${endpoint}`

    const existing = this.apiMetrics.get(key) || {
      endpoint,
      method: request.method,
      averageLatency: 0,
      requestCount: 0,
      errorRate: 0,
      last24h: { requests: 0, errors: 0, avgLatency: 0 }
    }

    existing.requestCount++
    if (request.duration) {
      existing.averageLatency = (existing.averageLatency * (existing.requestCount - 1) + request.duration) / existing.requestCount
    }

    if (request.error || (request.statusCode && request.statusCode >= 400)) {
      existing.last24h.errors++
    }

    existing.errorRate = (existing.last24h.errors / existing.requestCount) * 100
    existing.last24h.requests++

    this.apiMetrics.set(key, existing)
  }

  private normalizeEndpoint(url: string): string {
    try {
      const pathname = new URL(url).pathname
      // Replace dynamic segments with placeholders
      return pathname
        .replace(/\/api\/queue\/job\/[^\/]+/, '/api/queue/job/[id]')
        .replace(/\/api\/batch\/[^\/]+/, '/api/batch/[id]')
        .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, '/[id]')
    } catch {
      return url
    }
  }

  getAPIMetrics(): APIMetrics[] {
    return Array.from(this.apiMetrics.values())
  }

  getRequestMetrics(requestId: string): RequestMetrics | undefined {
    return this.requestMetrics.get(requestId)
  }

  // Performance monitoring
  trackAIProviderCall(provider: string, model: string, tokens: number, latency: number, cost: number) {
    telemetryLogger.info({
      provider,
      model,
      tokens,
      latency,
      cost,
      timestamp: Date.now(),
    }, 'AI provider call completed')
  }

  trackDatabaseQuery(query: string, duration: number, error?: Error) {
    const logData = {
      query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
      duration,
      timestamp: Date.now(),
    }

    if (error) {
      telemetryLogger.error({
        ...logData,
        error: {
          name: error.name,
          message: error.message,
        },
      }, 'Database query failed')
    } else {
      telemetryLogger.info(logData, 'Database query completed')
    }
  }

  trackQueueJob(jobId: string, jobName: string, duration: number, status: 'completed' | 'failed', error?: Error) {
    const logData = {
      jobId,
      jobName,
      duration,
      status,
      timestamp: Date.now(),
    }

    if (error) {
      telemetryLogger.error({
        ...logData,
        error: {
          name: error.name,
          message: error.message,
        },
      }, 'Queue job failed')
    } else {
      telemetryLogger.info(logData, 'Queue job completed')
    }
  }
}

export const telemetry = TelemetryService.getInstance()

// Middleware helper for Next.js API routes
export function withTelemetry<T extends any[], R>(
  handler: (...args: T) => Promise<R>,
  context: { name: string; metadata?: Record<string, any> }
) {
  return async (...args: T): Promise<R> => {
    const startTime = Date.now()

    try {
      const result = await handler(...args)
      const duration = Date.now() - startTime

      telemetryLogger.info({
        handler: context.name,
        duration,
        ...context.metadata,
      }, 'Handler completed successfully')

      return result
    } catch (error) {
      const duration = Date.now() - startTime

      telemetryLogger.error({
        handler: context.name,
        duration,
        error: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack,
        } : error,
        ...context.metadata,
      }, 'Handler failed')

      throw error
    }
  }
}