import { useState } from 'react';
import { logger } from '@/lib/logger';

interface PreviewRequest {
  templateId: string;
  variables: Record<string, any>;
}

interface PreviewResponse {
  success: boolean;
  expandedPrompt: string;
  estimatedTokens: number;
  estimatedCost: number;
  error?: string;
}

export function usePromptPreview() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PreviewResponse | null>(null);

  const preview = async (request: PreviewRequest): Promise<PreviewResponse | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/batch/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to generate preview');
      }

      setData(result);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      logger.error('Prompt preview error', new Error(errorMessage));
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    preview,
    loading,
    error,
    data,
    clearError: () => setError(null),
  };
}