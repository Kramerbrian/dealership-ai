// Advanced Metrics API for Production Monitoring
// Provides custom application metrics for monitoring systems

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { headers } from 'next/headers';
import { reportError } from '@/lib/monitoring/sentry.config';

// Prometheus-style metrics formatting
interface Metric {
  name: string;
  value: number;
  labels?: Record<string, string>;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  help: string;
}

// Application metrics
const appMetrics = {
  // User activity metrics
  async getUserMetrics() {
    // In a real implementation, this would query your database
    // For now, we'll return mock data
    return [
      {
        name: 'dealershipai_active_users_total',
        value: 150,
        labels: { role: 'dealer' },
        type: 'gauge' as const,
        help: 'Total number of active dealer users'
      },
      {
        name: 'dealershipai_active_users_total',
        value: 25,
        labels: { role: 'admin' },
        type: 'gauge' as const,
        help: 'Total number of active admin users'
      },
      {
        name: 'dealershipai_active_users_total',
        value: 1200,
        labels: { role: 'user' },
        type: 'gauge' as const,
        help: 'Total number of active regular users'
      }
    ];
  },

  // AI service metrics
  async getAIMetrics() {
    return [
      {
        name: 'dealershipai_ai_requests_total',
        value: 2500,
        labels: { provider: 'openai', status: 'success' },
        type: 'counter' as const,
        help: 'Total AI API requests'
      },
      {
        name: 'dealershipai_ai_requests_total',
        value: 15,
        labels: { provider: 'openai', status: 'error' },
        type: 'counter' as const,
        help: 'Total AI API requests'
      },
      {
        name: 'dealershipai_ai_response_time_seconds',
        value: 1.2,
        labels: { provider: 'openai' },
        type: 'gauge' as const,
        help: 'Average AI API response time in seconds'
      }
    ];
  },

  // Database metrics
  async getDatabaseMetrics() {
    return [
      {
        name: 'dealershipai_db_connections_active',
        value: 8,
        type: 'gauge' as const,
        help: 'Number of active database connections'
      },
      {
        name: 'dealershipai_db_query_duration_seconds',
        value: 0.045,
        type: 'gauge' as const,
        help: 'Average database query duration'
      },
      {
        name: 'dealershipai_db_queries_total',
        value: 15000,
        labels: { status: 'success' },
        type: 'counter' as const,
        help: 'Total database queries executed'
      }
    ];
  },

  // Business metrics
  async getBusinessMetrics() {
    return [
      {
        name: 'dealershipai_dealerships_total',
        value: 45,
        labels: { status: 'active' },
        type: 'gauge' as const,
        help: 'Total number of active dealerships'
      },
      {
        name: 'dealershipai_revenue_usd',
        value: 12500.50,
        labels: { period: 'monthly' },
        type: 'gauge' as const,
        help: 'Monthly recurring revenue in USD'
      },
      {
        name: 'dealershipai_chat_sessions_total',
        value: 890,
        labels: { date: new Date().toISOString().split('T')[0] },
        type: 'counter' as const,
        help: 'Total chat sessions today'
      }
    ];
  }
};

// System health metrics
async function getSystemMetrics() {
  const startTime = Date.now();

  return [
    {
      name: 'dealershipai_uptime_seconds',
      value: process.uptime(),
      type: 'counter' as const,
      help: 'Application uptime in seconds'
    },
    {
      name: 'dealershipai_memory_usage_bytes',
      value: process.memoryUsage().heapUsed,
      type: 'gauge' as const,
      help: 'Memory usage in bytes'
    },
    {
      name: 'dealershipai_response_time_seconds',
      value: (Date.now() - startTime) / 1000,
      type: 'gauge' as const,
      help: 'API response time for metrics endpoint'
    }
  ];
}

// Format metrics in Prometheus format
function formatPrometheusMetrics(metrics: Metric[]): string {
  const grouped = new Map<string, Metric[]>();

  // Group metrics by name
  metrics.forEach(metric => {
    if (!grouped.has(metric.name)) {
      grouped.set(metric.name, []);
    }
    grouped.get(metric.name)!.push(metric);
  });

  let output = '';

  grouped.forEach((metricGroup, name) => {
    // Add help comment
    output += `# HELP ${name} ${metricGroup[0].help}\n`;
    output += `# TYPE ${name} ${metricGroup[0].type}\n`;

    metricGroup.forEach(metric => {
      const labels = metric.labels
        ? `{${Object.entries(metric.labels).map(([k, v]) => `${k}="${v}"`).join(',')}}`
        : '';

      output += `${metric.name}${labels} ${metric.value}\n`;
    });

    output += '\n';
  });

  return output;
}

// Main metrics endpoint
export async function GET(request: NextRequest) {
  const headersList = headers();
  const userAgent = headersList.get('user-agent') || '';

  try {
    // Check authentication for sensitive metrics
    const session = await getServerSession(authOptions);

    // Allow Prometheus scrapers and monitoring tools
    const isMonitoringRequest = userAgent.includes('Prometheus') ||
                               userAgent.includes('curl') ||
                               userAgent.includes('wget') ||
                               request.headers.get('authorization')?.includes('Bearer');

    if (!session && !isMonitoringRequest) {
      return NextResponse.json(
        { error: 'Authentication required for metrics access' },
        { status: 401 }
      );
    }

    // Collect all metrics
    const [userMetrics, aiMetrics, dbMetrics, businessMetrics, systemMetrics] = await Promise.all([
      appMetrics.getUserMetrics(),
      appMetrics.getAIMetrics(),
      appMetrics.getDatabaseMetrics(),
      appMetrics.getBusinessMetrics(),
      getSystemMetrics()
    ]);

    const allMetrics = [
      ...userMetrics,
      ...aiMetrics,
      ...dbMetrics,
      ...businessMetrics,
      ...systemMetrics
    ];

    // Return format based on Accept header
    const acceptHeader = request.headers.get('accept') || '';

    if (acceptHeader.includes('application/json')) {
      return NextResponse.json({
        timestamp: new Date().toISOString(),
        metrics: allMetrics
      });
    }

    // Default to Prometheus format
    const prometheusOutput = formatPrometheusMetrics(allMetrics);

    return new Response(prometheusOutput, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

  } catch (error) {
    console.error('Metrics endpoint error:', error);

    reportError(error as Error, {
      tag: 'API_ERROR',
      extra: {
        endpoint: '/api/monitoring/metrics',
        userAgent,
        timestamp: new Date().toISOString()
      }
    });

    return NextResponse.json(
      {
        error: 'Failed to collect metrics',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// Health check for the metrics endpoint
export async function HEAD() {
  return new Response(null, {
    status: 200,
    headers: {
      'Cache-Control': 'no-cache',
      'Content-Type': 'text/plain'
    }
  });
}