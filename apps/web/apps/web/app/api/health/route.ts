import { NextResponse } from 'next/server';

export async function GET() {
  const startTime = Date.now();

  try {
    // Basic health check implementation
    const memoryUsage = process.memoryUsage();
    const heapUsagePercentage = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

    const response = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.VERCEL_GIT_COMMIT_SHA || 'dev',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      responseTime: Date.now() - startTime,
      checks: {
        memory: {
          status: heapUsagePercentage > 90 ? 'unhealthy' : heapUsagePercentage > 80 ? 'degraded' : 'healthy',
          heapUsagePercentage: heapUsagePercentage.toFixed(1),
          heapUsedMB: (memoryUsage.heapUsed / 1024 / 1024).toFixed(2),
          heapTotalMB: (memoryUsage.heapTotal / 1024 / 1024).toFixed(2),
        },
        env: {
          status: process.env.NODE_ENV ? 'healthy' : 'degraded',
          nodeVersion: process.version,
          platform: process.platform,
        }
      }
    };

    return NextResponse.json(response, {
      status: response.checks.memory.status === 'unhealthy' ? 503 : 200
    });

  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime: Date.now() - startTime
    }, { status: 503 });
  }
}
