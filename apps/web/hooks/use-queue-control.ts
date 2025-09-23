import { useState } from 'react';
import { logger } from '@/lib/logger';

type QueueAction = 'pause' | 'resume' | 'clear' | 'stats';

interface QueueControlOptions {
  status?: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
}

interface QueueControlResponse {
  success: boolean;
  result: any;
  message: string;
  timestamp: string;
}

export function useQueueControl() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const controlQueue = async (action: QueueAction, options: QueueControlOptions = {}): Promise<QueueControlResponse | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/queue/control', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, options }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to control queue');
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      logger.error('Queue control error', new Error(errorMessage));
      return null;
    } finally {
      setLoading(false);
    }
  };

  const pauseQueue = () => controlQueue('pause');
  const resumeQueue = () => controlQueue('resume');
  const clearQueue = (status?: QueueControlOptions['status']) => controlQueue('clear', { status });
  const getStats = () => controlQueue('stats');

  return {
    controlQueue,
    pauseQueue,
    resumeQueue,
    clearQueue,
    getStats,
    loading,
    error,
    clearError: () => setError(null),
  };
}