import { NextRequest, NextResponse } from 'next/server';

interface SystemMetrics {
  timestamp: string;
  system: {
    uptime: number;
    memory: {
      heap_used: number;
      heap_total: number;
      heap_usage_percent: number;
      rss: number;
      external: number;
    };
    cpu: {
      user: number;
      system: number;
    };
  };
  application: {
    requests_per_minute: number;
    average_response_time: number;
    error_rate: number;
    active_connections: number;
  };
  business: {
    active_dealers: number;
    daily_ai_requests: number;
    cost_tracking: {
      daily_spend: number;
      monthly_spend: number;
      budget_utilization: number;
    };
    queue_metrics: {
      pending_jobs: number;
      processing_jobs: number;
      completed_today: number;
      failed_today: number;
    };
  };
}

export async function GET(request: NextRequest) {
  try {
    // System metrics
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    // Application metrics (would be collected from actual monitoring)
    const applicationMetrics = {
      requests_per_minute: 0, // Would be calculated from request logs
      average_response_time: 0, // Would be calculated from request logs
      error_rate: 0, // Would be calculated from error logs
      active_connections: 0, // Would be tracked from connection pool
    };

    // Business metrics (would be queried from database)
    const businessMetrics = {
      active_dealers: 1, // Placeholder - would query from database
      daily_ai_requests: 0, // Would be calculated from usage logs
      cost_tracking: {
        daily_spend: 0.00,
        monthly_spend: 0.00,
        budget_utilization: 0,
      },
      queue_metrics: {
        pending_jobs: 0,
        processing_jobs: 0,
        completed_today: 0,
        failed_today: 0,
      },
    };

    const metrics: SystemMetrics = {
      timestamp: new Date().toISOString(),
      system: {
        uptime: process.uptime(),
        memory: {
          heap_used: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
          heap_total: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
          heap_usage_percent: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100),
          rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
          external: Math.round(memoryUsage.external / 1024 / 1024), // MB
        },
        cpu: {
          user: Math.round(cpuUsage.user / 1000), // milliseconds
          system: Math.round(cpuUsage.system / 1000), // milliseconds
        },
      },
      application: applicationMetrics,
      business: businessMetrics,
    };

    return NextResponse.json(metrics);

  } catch (error) {
    console.error('Failed to collect metrics:', error);

    return NextResponse.json({
      error: 'Failed to collect system metrics',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}