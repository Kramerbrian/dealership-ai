import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { rbac } from '@/lib/rbac';
import { queue } from '@/queue';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authenticate request
    const user = await rbac.authenticateRequest(request);
    if (!user || !rbac.hasPermission(user, 'read:queue')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const jobId = params.id;
    const job = await queue.get(jobId);

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // Check if user can access this job
    if (user.role !== 'admin' &&
        job.metadata.userId !== user.id &&
        job.metadata.dealerId !== user.dealerId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      job,
    });
  } catch (error) {
    logger.error('Queue job details API error', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authenticate request
    const user = await rbac.authenticateRequest(request);
    if (!user || !rbac.hasPermission(user, 'write:queue')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const jobId = params.id;
    const job = await queue.get(jobId);

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // Check if user can modify this job
    if (user.role !== 'admin' &&
        job.metadata.userId !== user.id &&
        job.metadata.dealerId !== user.dealerId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    const cancelled = await queue.cancel(jobId);

    if (!cancelled) {
      return NextResponse.json(
        { error: 'Job cannot be cancelled (already processing or completed)' },
        { status: 400 }
      );
    }

    logger.info('Job cancelled via API', {
      jobId,
      userId: user.id,
    });

    return NextResponse.json({
      success: true,
      message: 'Job cancelled successfully',
    });
  } catch (error) {
    logger.error('Queue job cancellation error', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      {
        error: 'Failed to cancel job',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authenticate request
    const user = await rbac.authenticateRequest(request);
    if (!user || !rbac.hasPermission(user, 'write:queue')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { action } = await request.json();

    if (!action) {
      return NextResponse.json(
        { error: 'action is required' },
        { status: 400 }
      );
    }

    const jobId = params.id;
    const job = await queue.get(jobId);

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // Check if user can modify this job
    if (user.role !== 'admin' &&
        job.metadata.userId !== user.id &&
        job.metadata.dealerId !== user.dealerId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    let result;
    let message;

    switch (action) {
      case 'retry':
        result = await queue.retry(jobId);
        message = result ? 'Job queued for retry' : 'Job cannot be retried';
        break;

      case 'cancel':
        result = await queue.cancel(jobId);
        message = result ? 'Job cancelled successfully' : 'Job cannot be cancelled';
        break;

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    if (result) {
      logger.info('Job action executed', {
        jobId,
        action,
        userId: user.id,
      });
    }

    return NextResponse.json({
      success: result,
      message,
    });
  } catch (error) {
    logger.error('Queue job action error', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      {
        error: 'Failed to execute job action',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}