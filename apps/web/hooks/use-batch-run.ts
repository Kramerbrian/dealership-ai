import { useState } from 'react';
import { logger } from '@/lib/logger';

interface BatchRunRequest {
  templateId: string;
  variables: Record<string, any>;
  settings?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    provider?: 'openai' | 'anthropic';
  };
  options?: {
    priority?: 'low' | 'normal' | 'high';
    maxAttempts?: number;
  };
}

interface BatchRunResponse {
  success: boolean;
  jobId: string;
  message: string;
  estimatedCost?: number;
  queuePosition?: number;
  error?: string;
}

export function useBatchRun() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<BatchRunResponse | null>(null);

  const run = async (request: BatchRunRequest): Promise<BatchRunResponse | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/batch/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to queue batch job');
      }

      setData(result);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      logger.error('Batch run error', new Error(errorMessage));
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    run,
    loading,
    error,
    data,
    clearError: () => setError(null),
  };
}