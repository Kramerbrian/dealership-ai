// Queue management system for background job processing
import { logger } from '@/lib/logger';
import { cache } from '@/lib/cache';

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type JobPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface Job {
  id: string;
  type: string;
  payload: any;
  status: JobStatus;
  priority: JobPriority;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  result?: any;
  metadata: {
    userId?: string;
    dealerId?: string;
    batchId?: string;
    estimatedDuration?: number;
    [key: string]: any;
  };
}

export interface QueueOptions {
  concurrency?: number;
  defaultPriority?: JobPriority;
  defaultMaxAttempts?: number;
  jobTimeout?: number;
}

export interface QueueMetrics {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
  avgProcessingTime?: number;
  throughputPerHour?: number;
}

class JobQueue {
  private jobs = new Map<string, Job>();
  private processors = new Map<string, (job: Job) => Promise<any>>();
  private processing = new Set<string>();
  private options: Required<QueueOptions>;
  private isRunning = false;
  private metrics = {
    processedJobs: 0,
    totalProcessingTime: 0,
    startTime: Date.now(),
  };

  constructor(options: QueueOptions = {}) {
    this.options = {
      concurrency: options.concurrency || parseInt(process.env.QUEUE_CONCURRENCY || '5'),
      defaultPriority: options.defaultPriority || 'normal',
      defaultMaxAttempts: options.defaultMaxAttempts || 3,
      jobTimeout: options.jobTimeout || 5 * 60 * 1000, // 5 minutes
    };

    // Auto-start processing
    this.start();

    // Cleanup completed jobs every hour
    setInterval(() => this.cleanup(), 60 * 60 * 1000);
  }

  registerProcessor(jobType: string, processor: (job: Job) => Promise<any>): void {
    this.processors.set(jobType, processor);
    logger.info('Job processor registered', { jobType });
  }

  async add(
    type: string,
    payload: any,
    options: {
      priority?: JobPriority;
      maxAttempts?: number;
      metadata?: Record<string, any>;
      delay?: number;
    } = {}
  ): Promise<string> {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const job: Job = {
      id: jobId,
      type,
      payload,
      status: 'pending',
      priority: options.priority || this.options.defaultPriority,
      attempts: 0,
      maxAttempts: options.maxAttempts || this.options.defaultMaxAttempts,
      createdAt: new Date(),
      metadata: options.metadata || {},
    };

    this.jobs.set(jobId, job);

    // Store in cache for persistence
    await cache.set(cache.queueKey('job', jobId), job, 24 * 60 * 60);

    logger.info('Job added to queue', {
      jobId,
      type,
      priority: job.priority,
      queueSize: this.jobs.size,
    });

    // Start processing if not already running
    if (!this.isRunning) {
      this.start();
    }

    return jobId;
  }

  async get(jobId: string): Promise<Job | null> {
    let job = this.jobs.get(jobId);
    if (!job) {
      // Try to load from cache
      job = await cache.get<Job>(cache.queueKey('job', jobId));
      if (job) {
        this.jobs.set(jobId, job);
      }
    }
    return job || null;
  }

  async cancel(jobId: string): Promise<boolean> {
    const job = await this.get(jobId);
    if (!job) return false;

    if (job.status === 'pending') {
      job.status = 'cancelled';
      job.completedAt = new Date();
      await cache.set(cache.queueKey('job', jobId), job, 24 * 60 * 60);
      logger.info('Job cancelled', { jobId });
      return true;
    }

    return false;
  }

  async retry(jobId: string): Promise<boolean> {
    const job = await this.get(jobId);
    if (!job || job.status !== 'failed') return false;

    job.status = 'pending';
    job.attempts = 0;
    job.error = undefined;
    job.startedAt = undefined;
    job.completedAt = undefined;

    await cache.set(cache.queueKey('job', jobId), job, 24 * 60 * 60);

    logger.info('Job retried', { jobId });
    return true;
  }

  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.processJobs();
    logger.info('Queue processing started', {
      concurrency: this.options.concurrency,
    });
  }

  stop(): void {
    this.isRunning = false;
    logger.info('Queue processing stopped');
  }

  private async processJobs(): Promise<void> {
    while (this.isRunning) {
      try {
        // Check if we can process more jobs
        if (this.processing.size >= this.options.concurrency) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }

        // Find next job to process
        const nextJob = this.getNextJob();
        if (!nextJob) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }

        // Process the job
        this.processJob(nextJob);
      } catch (error) {
        logger.error('Queue processing error', error instanceof Error ? error : new Error(String(error)));
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  private getNextJob(): Job | null {
    const pendingJobs = Array.from(this.jobs.values())
      .filter(job => job.status === 'pending')
      .sort((a, b) => {
        // Sort by priority first, then by creation time
        const priorityOrder = { urgent: 4, high: 3, normal: 2, low: 1 };
        const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
        if (priorityDiff !== 0) return priorityDiff;

        return a.createdAt.getTime() - b.createdAt.getTime();
      });

    return pendingJobs[0] || null;
  }

  private async processJob(job: Job): Promise<void> {
    const processor = this.processors.get(job.type);
    if (!processor) {
      job.status = 'failed';
      job.error = `No processor registered for job type: ${job.type}`;
      job.completedAt = new Date();
      await cache.set(cache.queueKey('job', job.id), job, 24 * 60 * 60);
      return;
    }

    this.processing.add(job.id);
    job.status = 'processing';
    job.startedAt = new Date();
    job.attempts++;

    await cache.set(cache.queueKey('job', job.id), job, 24 * 60 * 60);

    logger.info('Job processing started', {
      jobId: job.id,
      type: job.type,
      attempt: job.attempts,
    });

    try {
      // Set timeout for job processing
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Job timeout')), this.options.jobTimeout)
      );

      const result = await Promise.race([
        processor(job),
        timeoutPromise,
      ]);

      // Job completed successfully
      job.status = 'completed';
      job.result = result;
      job.completedAt = new Date();

      const processingTime = job.completedAt.getTime() - job.startedAt!.getTime();
      this.metrics.processedJobs++;
      this.metrics.totalProcessingTime += processingTime;

      logger.info('Job completed successfully', {
        jobId: job.id,
        type: job.type,
        processingTime,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (job.attempts >= job.maxAttempts) {
        job.status = 'failed';
        job.error = errorMessage;
        job.completedAt = new Date();

        logger.error('Job failed permanently', error instanceof Error ? error : new Error(String(error)), {
          jobId: job.id,
          type: job.type,
          attempts: job.attempts,
        });
      } else {
        // Retry the job
        job.status = 'pending';
        job.startedAt = undefined;

        logger.warn('Job failed, will retry', {
          jobId: job.id,
          type: job.type,
          attempt: job.attempts,
          maxAttempts: job.maxAttempts,
          error: errorMessage,
        });
      }
    } finally {
      this.processing.delete(job.id);
      await cache.set(cache.queueKey('job', job.id), job, 24 * 60 * 60);
    }
  }

  async getMetrics(): Promise<QueueMetrics> {
    const jobs = Array.from(this.jobs.values());
    const pending = jobs.filter(j => j.status === 'pending').length;
    const processing = jobs.filter(j => j.status === 'processing').length;
    const completed = jobs.filter(j => j.status === 'completed').length;
    const failed = jobs.filter(j => j.status === 'failed').length;

    const avgProcessingTime = this.metrics.processedJobs > 0 ?
      this.metrics.totalProcessingTime / this.metrics.processedJobs : undefined;

    const uptime = Date.now() - this.metrics.startTime;
    const hoursSinceStart = uptime / (1000 * 60 * 60);
    const throughputPerHour = hoursSinceStart > 0 ?
      this.metrics.processedJobs / hoursSinceStart : undefined;

    return {
      pending,
      processing,
      completed,
      failed,
      total: jobs.length,
      avgProcessingTime,
      throughputPerHour,
    };
  }

  async listJobs(options: {
    status?: JobStatus;
    type?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<Job[]> {
    let jobs = Array.from(this.jobs.values());

    if (options.status) {
      jobs = jobs.filter(job => job.status === options.status);
    }

    if (options.type) {
      jobs = jobs.filter(job => job.type === options.type);
    }

    // Sort by creation time (newest first)
    jobs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Apply pagination
    const offset = options.offset || 0;
    const limit = options.limit || 50;
    return jobs.slice(offset, offset + limit);
  }

  async getJobsByStatus(status: JobStatus): Promise<Job[]> {
    return this.listJobs({ status });
  }

  private async cleanup(): Promise<void> {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - 24); // Keep jobs for 24 hours

    const jobsToRemove = Array.from(this.jobs.values())
      .filter(job =>
        (job.status === 'completed' || job.status === 'failed') &&
        job.completedAt &&
        job.completedAt < cutoffTime
      );

    for (const job of jobsToRemove) {
      this.jobs.delete(job.id);
      await cache.del(cache.queueKey('job', job.id));
    }

    if (jobsToRemove.length > 0) {
      logger.info('Cleaned up old jobs', { count: jobsToRemove.length });
    }
  }

  async pause(): Promise<void> {
    this.isRunning = false;
    logger.info('Queue paused');
  }

  async resume(): Promise<void> {
    this.start();
    logger.info('Queue resumed');
  }

  async clear(status?: JobStatus): Promise<number> {
    let jobsToRemove = Array.from(this.jobs.values());

    if (status) {
      jobsToRemove = jobsToRemove.filter(job => job.status === status);
    }

    for (const job of jobsToRemove) {
      this.jobs.delete(job.id);
      await cache.del(cache.queueKey('job', job.id));
    }

    logger.info('Queue cleared', {
      count: jobsToRemove.length,
      status: status || 'all',
    });

    return jobsToRemove.length;
  }
}

// Global queue instance
export const queue = new JobQueue();
export default queue;