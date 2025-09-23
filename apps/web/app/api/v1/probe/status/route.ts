import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { queue } from '@/queue';
import { cache } from '@/lib/cache';
import { withAdminAuth } from '@/lib/auth/middleware';

// Mock Redis interface for cost tracking
const redis = {
  async get(key: string): Promise<string | null> {
    return await cache.get<string>(key);
  },
  async set(key: string, value: string | number): Promise<void> {
    await cache.set(key, String(value), 24 * 60 * 60);
  }
};

// Mock functions for DLQ and probe queue
function getProbeQueue() {
  return {
    async getJobCounts() {
      const metrics = await queue.getMetrics();
      return {
        waiting: metrics.pending,
        active: metrics.processing,
        completed: metrics.completed,
        failed: metrics.failed
      };
    }
  };
}

function getProbeDLQ() {
  return {
    async getJobs(types: string[], start: number, end: number, asc: boolean) {
      // Get failed jobs from the queue as DLQ
      const failedJobs = await queue.getJobsByStatus('failed');

      // Convert to expected format with timestamps
      return failedJobs.slice(start, end + 1).map(job => ({
        id: job.id,
        timestamp: job.createdAt.getTime(),
        data: job.payload
      }));
    }
  };
}

async function getProbeStatus(request: NextRequest) {
  try {
    const q = getProbeQueue();
    const dlq = getProbeDLQ();

    // Get queue counts
    const counts = await q.getJobCounts();

    // Get cost tracking data
    const today = new Date().toISOString().slice(0, 10);
    const thisMonth = new Date().toISOString().slice(0, 7);

    const daily = await redis.get(`probe:cost:daily:${today}`) || '0';
    const monthly = await redis.get(`probe:cost:monthly:${thisMonth}`) || '0';

    // Get DLQ stats (sample up to 500)
    const jobs = await dlq.getJobs(['waiting', 'delayed'], 0, 499, true);
    const agesMin = jobs
      .map(j => Math.max(0, Math.floor((Date.now() - j.timestamp) / 60000)))
      .sort((a, b) => a - b);

    const p95 = agesMin.length
      ? (agesMin[Math.floor(agesMin.length * 0.95) - 1] || agesMin[agesMin.length - 1])
      : 0;
    const oldest = agesMin.length ? agesMin[agesMin.length - 1] : 0;

    return NextResponse.json({
      counts,
      cost: {
        daily: Number(daily),
        monthly: Number(monthly)
      },
      dlq: {
        count: jobs.length,
        age_p95_min: p95,
        oldest_min: oldest
      }
    });

  } catch (error) {
    logger.error('Probe status API error', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export const GET = withAdminAuth(getProbeStatus);