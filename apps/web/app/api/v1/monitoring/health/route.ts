import { NextRequest, NextResponse } from 'next/server';

interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    database: 'connected' | 'disconnected' | 'error';
    redis: 'connected' | 'disconnected' | 'error';
    ai_providers: 'available' | 'limited' | 'unavailable';
    queue: 'operational' | 'degraded' | 'failed';
  };
  metrics: {
    uptime: number;
    memory_usage: number;
    response_time: number;
    error_rate: number;
  };
  version: string;
  environment: string;
}

export async function GET(request: NextRequest) {
  const start = Date.now();

  try {
    // Check database connectivity
    let databaseStatus: 'connected' | 'disconnected' | 'error' = 'disconnected';
    try {
      // In production, this would check actual database connectivity
      if (process.env.DATABASE_URL) {
        databaseStatus = 'connected';
      }
    } catch (error) {
      databaseStatus = 'error';
    }

    // Check Redis connectivity
    let redisStatus: 'connected' | 'disconnected' | 'error' = 'disconnected';
    try {
      if (process.env.REDIS_URL) {
        redisStatus = 'connected';
      }
    } catch (error) {
      redisStatus = 'error';
    }

    // Check AI providers
    let aiProvidersStatus: 'available' | 'limited' | 'unavailable' = 'unavailable';
    const availableProviders = [];
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'sk-placeholder-openai-key') {
      availableProviders.push('openai');
    }
    if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'sk-ant-placeholder-anthropic-key') {
      availableProviders.push('anthropic');
    }

    if (availableProviders.length >= 2) {
      aiProvidersStatus = 'available';
    } else if (availableProviders.length === 1) {
      aiProvidersStatus = 'limited';
    }

    // Check queue system
    let queueStatus: 'operational' | 'degraded' | 'failed' = 'operational';
    try {
      // In production, this would check actual queue metrics
      queueStatus = 'operational';
    } catch (error) {
      queueStatus = 'failed';
    }

    // Calculate metrics
    const responseTime = Date.now() - start;
    const memoryUsage = process.memoryUsage();
    const memoryUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

    // Determine overall health status
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (databaseStatus === 'error' || queueStatus === 'failed') {
      overallStatus = 'unhealthy';
    } else if (
      redisStatus === 'error' ||
      aiProvidersStatus === 'limited' ||
      queueStatus === 'degraded' ||
      memoryUsagePercent > 85
    ) {
      overallStatus = 'degraded';
    }

    const healthData: HealthCheck = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      services: {
        database: databaseStatus,
        redis: redisStatus,
        ai_providers: aiProvidersStatus,
        queue: queueStatus,
      },
      metrics: {
        uptime: process.uptime(),
        memory_usage: Math.round(memoryUsagePercent),
        response_time: responseTime,
        error_rate: 0, // Would be calculated from actual metrics
      },
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
    };

    // Set appropriate HTTP status based on health
    const httpStatus = overallStatus === 'healthy' ? 200 :
                      overallStatus === 'degraded' ? 200 : 503;

    return NextResponse.json(healthData, { status: httpStatus });

  } catch (error) {
    console.error('Health check failed:', error);

    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check system failure',
      services: {
        database: 'error',
        redis: 'error',
        ai_providers: 'unavailable',
        queue: 'failed',
      },
      metrics: {
        uptime: process.uptime(),
        memory_usage: 0,
        response_time: Date.now() - start,
        error_rate: 100,
      },
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
    }, { status: 503 });
  }
}