import { useState, useEffect, useCallback } from 'react';
import { logger } from '@/lib/logger';

interface QueueMetrics {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
  avgProcessingTime: number;
}

interface QueueHealth {
  status: 'active' | 'idle' | 'empty' | 'error';
  utilization: number;
  successRate: number;
}

interface QueueMetricsResponse {
  metrics: QueueMetrics;
  health: QueueHealth;
  timestamp: string;
}

export function useQueueMetrics(autoRefresh: boolean = false, refreshInterval: number = 5000) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<QueueMetricsResponse | null>(null);

  const fetchMetrics = useCallback(async (): Promise<QueueMetricsResponse | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/queue/metrics');
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch queue metrics');
      }

      setData(result);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      logger.error('Queue metrics fetch error', new Error(errorMessage));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchMetrics, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchMetrics]);

  return {
    metrics: data?.metrics,
    health: data?.health,
    timestamp: data?.timestamp,
    loading,
    error,
    refresh: fetchMetrics,
    clearError: () => setError(null),
  };
}