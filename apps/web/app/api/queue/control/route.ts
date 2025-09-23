import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { rbac } from '@/lib/rbac';
import { queue } from '@/queue';

export async function POST(request: NextRequest) {
  try {
    // Authenticate request
    const user = await rbac.authenticateRequest(request);
    if (!user || !rbac.hasPermission(user, 'write:admin')) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const { action, options = {} } = await request.json();

    if (!action) {
      return NextResponse.json(
        { error: 'action is required' },
        { status: 400 }
      );
    }

    let result;
    let message;

    switch (action) {
      case 'pause':
        await queue.pause();
        result = true;
        message = 'Queue paused';
        break;

      case 'resume':
        await queue.resume();
        result = true;
        message = 'Queue resumed';
        break;

      case 'clear':
        const cleared = await queue.clear(options.status);
        result = true;
        message = `Cleared ${cleared} jobs`;
        break;

      case 'stats':
        result = await queue.getMetrics();
        message = 'Queue statistics retrieved';
        break;

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    logger.info('Queue control action executed', {
      action,
      userId: user.id,
      options,
    });

    return NextResponse.json({
      success: true,
      result,
      message,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Queue control error', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      {
        error: 'Failed to execute queue control action',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}