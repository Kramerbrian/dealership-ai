import { useState } from 'react';
import { logger } from '@/lib/logger';

interface ExpandRequest {
  templateId: string;
  variables: Record<string, any>;
  options?: {
    includeMetadata?: boolean;
    validateOnly?: boolean;
  };
}

interface ExpandResponse {
  success: boolean;
  expandedPrompt: string;
  metadata?: {
    templateId: string;
    variables: Record<string, any>;
    expandedAt: string;
    estimatedTokens: number;
    estimatedCost: number;
  };
  validation?: {
    missingVariables: string[];
    invalidVariables: string[];
  };
  error?: string;
}

export function usePromptExpand() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ExpandResponse | null>(null);

  const expand = async (request: ExpandRequest): Promise<ExpandResponse | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/batch/expand', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to expand prompt');
      }

      setData(result);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      logger.error('Prompt expansion error', new Error(errorMessage));
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    expand,
    loading,
    error,
    data,
    clearError: () => setError(null),
  };
}