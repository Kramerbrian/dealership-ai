import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { rbac } from '@/lib/rbac';
import { queue } from '@/queue';

export async function GET(request: NextRequest) {
  try {
    // Authenticate request
    const user = await rbac.authenticateRequest(request);
    if (!user || !rbac.hasPermission(user, 'read:queue')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const metrics = await queue.getMetrics();

    // Add additional queue health information
    const healthInfo = {
      status: metrics.processing > 0 ? 'active' :
              metrics.pending > 0 ? 'idle' : 'empty',
      utilization: metrics.total > 0 ?
        Math.round((metrics.processing / metrics.total) * 100) : 0,
      successRate: metrics.total > 0 ?
        Math.round((metrics.completed / (metrics.completed + metrics.failed)) * 100) : 100,
    };

    return NextResponse.json({
      metrics,
      health: healthInfo,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Queue metrics API error', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}