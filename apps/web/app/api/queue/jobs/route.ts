import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { rbac } from '@/lib/rbac';
import { queue } from '@/queue';
import { processBatchTest } from '@/queue/processors/batch-test';

// Register processors
queue.registerProcessor('batch-test', processBatchTest);

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

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as any;
    const type = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const jobs = await queue.listJobs({
      status,
      type: type || undefined,
      limit,
      offset,
    });

    // Filter jobs based on user permissions
    const filteredJobs = jobs.filter(job => {
      // Admins can see all jobs
      if (user.role === 'admin') return true;

      // Users can only see their own jobs or jobs for their dealer
      return job.metadata.userId === user.id ||
             job.metadata.dealerId === user.dealerId;
    });

    return NextResponse.json({
      jobs: filteredJobs,
      total: filteredJobs.length,
      filters: {
        status,
        type,
        limit,
        offset,
      },
    });
  } catch (error) {
    logger.error('Queue jobs API error', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate request
    const user = await rbac.authenticateRequest(request);
    if (!user || !rbac.hasPermission(user, 'write:queue')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { type, payload, priority = 'normal', maxAttempts = 3 } = await request.json();

    if (!type || !payload) {
      return NextResponse.json(
        { error: 'type and payload are required' },
        { status: 400 }
      );
    }

    const jobId = await queue.add(type, payload, {
      priority,
      maxAttempts,
      metadata: {
        userId: user.id,
        dealerId: user.dealerId,
        createdBy: user.email,
      },
    });

    logger.info('Job queued via API', {
      jobId,
      type,
      priority,
      userId: user.id,
    });

    return NextResponse.json({
      success: true,
      jobId,
      message: 'Job queued for processing',
    });
  } catch (error) {
    logger.error('Queue job creation error', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      {
        error: 'Failed to queue job',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}