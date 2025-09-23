import { NextRequest, NextResponse } from 'next/server'
import { telemetry } from '@/lib/telemetry'
import { sentry } from '@/lib/sentry'

interface MetricsResponse {
  timestamp: string
  uptime: number
  api_metrics: Array<{
    endpoint: string
    method: string
    average_latency_ms: number
    request_count: number
    error_rate: number
    last_24h: {
      requests: number
      errors: number
      avg_latency_ms: number
    }
  }>
  system_metrics: {
    memory: {
      heap_used_mb: number
      heap_total_mb: number
      external_mb: number
      usage_percentage: number
    }
    cpu: {
      user_time_ms: number
      system_time_ms: number
    }
    node: {
      version: string
      uptime_seconds: number
    }
    event_loop: {
      lag_ms: number
    }
  }
  performance_summary: {
    total_requests: number
    average_response_time_ms: number
    error_rate_percentage: number
    uptime_percentage: number
  }
}

function getSystemMetrics() {
  const memUsage = process.memoryUsage()
  const cpuUsage = process.cpuUsage()

  return {
    memory: {
      heap_used_mb: Math.round(memUsage.heapUsed / 1024 / 1024),
      heap_total_mb: Math.round(memUsage.heapTotal / 1024 / 1024),
      external_mb: Math.round(memUsage.external / 1024 / 1024),
      usage_percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
    },
    cpu: {
      user_time_ms: Math.round(cpuUsage.user / 1000),
      system_time_ms: Math.round(cpuUsage.system / 1000),
    },
    node: {
      version: process.version,
      uptime_seconds: Math.round(process.uptime()),
    },
    event_loop: {
      lag_ms: 0, // Would need additional monitoring for real event loop lag
    }
  }
}

function calculatePerformanceSummary(apiMetrics: any[]) {
  const totalRequests = apiMetrics.reduce((sum, metric) => sum + metric.request_count, 0)
  const totalErrors = apiMetrics.reduce((sum, metric) => sum + metric.last_24h.errors, 0)
  const weightedLatency = apiMetrics.reduce(
    (sum, metric) => sum + (metric.average_latency_ms * metric.request_count),
    0
  )

  return {
    total_requests: totalRequests,
    average_response_time_ms: totalRequests > 0 ? Math.round(weightedLatency / totalRequests) : 0,
    error_rate_percentage: totalRequests > 0 ? Math.round((totalErrors / totalRequests) * 100) : 0,
    uptime_percentage: 99.9, // This would be calculated from historical data
  }
}

export async function GET(request: NextRequest) {
  const requestId = telemetry.startRequest(request)

  try {
    // Get API metrics from telemetry service
    const apiMetrics = telemetry.getAPIMetrics().map(metric => ({
      endpoint: metric.endpoint,
      method: metric.method,
      average_latency_ms: Math.round(metric.averageLatency),
      request_count: metric.requestCount,
      error_rate: Math.round(metric.errorRate * 100) / 100,
      last_24h: {
        requests: metric.last24h.requests,
        errors: metric.last24h.errors,
        avg_latency_ms: Math.round(metric.last24h.avgLatency || 0),
      }
    }))

    const systemMetrics = getSystemMetrics()
    const performanceSummary = calculatePerformanceSummary(apiMetrics)

    const metricsResponse: MetricsResponse = {
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
      api_metrics: apiMetrics,
      system_metrics: systemMetrics,
      performance_summary: performanceSummary,
    }

    telemetry.endRequest(requestId, 200, undefined, {
      metrics_count: apiMetrics.length,
      total_requests: performanceSummary.total_requests,
    })

    return NextResponse.json(metricsResponse)

  } catch (error) {
    telemetry.endRequest(requestId, 500, error instanceof Error ? error : new Error('Metrics fetch failed'))
    sentry.captureError(error instanceof Error ? error : new Error('Metrics fetch failed'))

    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    )
  }
}

// Endpoint for Prometheus-style metrics (text format)
export async function GET_prometheus() {
  const requestId = telemetry.generateRequestId()

  try {
    const apiMetrics = telemetry.getAPIMetrics()
    const systemMetrics = getSystemMetrics()

    let prometheusMetrics = ''

    // API metrics
    prometheusMetrics += '# HELP dealershipai_api_requests_total Total number of API requests\n'
    prometheusMetrics += '# TYPE dealershipai_api_requests_total counter\n'
    apiMetrics.forEach(metric => {
      prometheusMetrics += `dealershipai_api_requests_total{method="${metric.method}",endpoint="${metric.endpoint}"} ${metric.requestCount}\n`
    })

    prometheusMetrics += '\n# HELP dealershipai_api_request_duration_ms Average request duration in milliseconds\n'
    prometheusMetrics += '# TYPE dealershipai_api_request_duration_ms gauge\n'
    apiMetrics.forEach(metric => {
      prometheusMetrics += `dealershipai_api_request_duration_ms{method="${metric.method}",endpoint="${metric.endpoint}"} ${metric.averageLatency}\n`
    })

    prometheusMetrics += '\n# HELP dealershipai_api_error_rate Error rate percentage\n'
    prometheusMetrics += '# TYPE dealershipai_api_error_rate gauge\n'
    apiMetrics.forEach(metric => {
      prometheusMetrics += `dealershipai_api_error_rate{method="${metric.method}",endpoint="${metric.endpoint}"} ${metric.errorRate}\n`
    })

    // System metrics
    prometheusMetrics += '\n# HELP dealershipai_memory_usage_bytes Memory usage in bytes\n'
    prometheusMetrics += '# TYPE dealershipai_memory_usage_bytes gauge\n'
    prometheusMetrics += `dealershipai_memory_usage_bytes{type="heap_used"} ${systemMetrics.memory.heap_used_mb * 1024 * 1024}\n`
    prometheusMetrics += `dealershipai_memory_usage_bytes{type="heap_total"} ${systemMetrics.memory.heap_total_mb * 1024 * 1024}\n`

    prometheusMetrics += '\n# HELP dealershipai_uptime_seconds Application uptime in seconds\n'
    prometheusMetrics += '# TYPE dealershipai_uptime_seconds counter\n'
    prometheusMetrics += `dealershipai_uptime_seconds ${process.uptime()}\n`

    return new NextResponse(prometheusMetrics, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    })

  } catch (error) {
    sentry.captureError(error instanceof Error ? error : new Error('Prometheus metrics failed'))

    return new NextResponse('# Error generating metrics\n', {
      status: 500,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    })
  }
}