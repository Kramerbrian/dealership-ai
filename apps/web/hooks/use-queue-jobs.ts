import { useState, useCallback } from 'react';
import { logger } from '@/lib/logger';

interface Job {
  id: string;
  type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  priority: 'low' | 'normal' | 'high';
  payload: any;
  result?: any;
  error?: string;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  processingTime?: number;
  metadata: {
    userId: string;
    dealerId: string;
    createdBy: string;
  };
}

interface JobsResponse {
  jobs: Job[];
  total: number;
  filters: {
    status?: string;
    type?: string;
    limit: number;
    offset: number;
  };
}

interface JobFilters {
  status?: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  type?: string;
  limit?: number;
  offset?: number;
}

export function useQueueJobs() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<JobsResponse | null>(null);

  const fetchJobs = useCallback(async (filters: JobFilters = {}): Promise<JobsResponse | null> => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filters.status) params.set('status', filters.status);
      if (filters.type) params.set('type', filters.type);
      if (filters.limit) params.set('limit', filters.limit.toString());
      if (filters.offset) params.set('offset', filters.offset.toString());

      const response = await fetch(`/api/queue/jobs?${params}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch jobs');
      }

      setData(result);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      logger.error('Queue jobs fetch error', new Error(errorMessage));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const retryJob = useCallback(async (jobId: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/queue/job/${jobId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'retry' }),
      });

      const result = await response.json();
      return result.success;
    } catch (err) {
      logger.error('Job retry error', err instanceof Error ? err : new Error(String(err)));
      return false;
    }
  }, []);

  const cancelJob = useCallback(async (jobId: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/queue/job/${jobId}`, {
        method: 'DELETE',
      });

      const result = await response.json();
      return result.success;
    } catch (err) {
      logger.error('Job cancel error', err instanceof Error ? err : new Error(String(err)));
      return false;
    }
  }, []);

  return {
    jobs: data?.jobs || [],
    total: data?.total || 0,
    filters: data?.filters,
    loading,
    error,
    fetchJobs,
    retryJob,
    cancelJob,
    clearError: () => setError(null),
  };
}