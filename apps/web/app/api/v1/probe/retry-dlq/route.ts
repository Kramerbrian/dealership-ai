import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { queue } from '@/queue';
import { withAdminAuth } from '@/lib/auth/middleware';

// Hash function for stable job IDs
function stableHash(obj: any): string {
  const str = JSON.stringify(obj, Object.keys(obj).sort());
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

async function retryDLQJobs(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobIds, limit = 50, force = false } = body;

    let retryCount = 0;

    if (jobIds && Array.isArray(jobIds)) {
      // Retry specific jobs
      for (const jobId of jobIds) {
        const job = await queue.get(jobId);
        if (job && job.status === 'failed') {
          // Create new job ID if force is enabled
          const newJobId = force
            ? undefined
            : `probe:${job.metadata.dealer}:${stableHash({
                queries: job.payload.queries,
                platforms: job.payload.platforms
              })}`;

          // Reset job for retry
          job.status = 'pending';
          job.attempts = 0;
          job.error = undefined;
          job.startedAt = undefined;
          job.completedAt = undefined;

          await queue.add(job.type, job.payload, {
            priority: job.priority,
            maxAttempts: job.maxAttempts,
            metadata: job.metadata
          });

          retryCount++;
          logger.info('Job retried from DLQ', {
            originalJobId: jobId,
            force,
            newJobId: newJobId || 'generated'
          });
        }
      }
    } else if (limit) {
      // Retry up to N failed jobs
      const failedJobs = await queue.getJobsByStatus('failed');
      const jobsToRetry = failedJobs.slice(0, limit);

      for (const job of jobsToRetry) {
        // Create new job ID if force is enabled
        const newJobId = force
          ? undefined
          : `probe:${job.metadata.dealer}:${stableHash({
              queries: job.payload.queries,
              platforms: job.payload.platforms
            })}`;

        // Reset job for retry
        job.status = 'pending';
        job.attempts = 0;
        job.error = undefined;
        job.startedAt = undefined;
        job.completedAt = undefined;

        await queue.add(job.type, job.payload, {
          priority: job.priority,
          maxAttempts: job.maxAttempts,
          metadata: job.metadata
        });

        retryCount++;
        logger.info('Job retried from DLQ', {
          originalJobId: job.id,
          force,
          newJobId: newJobId || 'generated'
        });
      }
    }

    return NextResponse.json({
      success: true,
      retriedCount: retryCount,
      message: `Successfully retried ${retryCount} jobs from DLQ`
    });

  } catch (error) {
    logger.error('DLQ retry API error', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retry jobs from DLQ',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

export const POST = withAdminAuth(retryDLQJobs);