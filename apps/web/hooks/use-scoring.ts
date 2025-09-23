import { useState, useCallback } from 'react';
import { logger } from '@/lib/logger';

interface ScoringRequest {
  content: string;
  url?: string;
  dealerId: string;
  type?: 'seo' | 'aeo' | 'geo';
}

interface ScoringResponse {
  success: boolean;
  scores: {
    seo?: {
      overall: number;
      breakdown: {
        keywords: number;
        structure: number;
        content: number;
        technical: number;
      };
    };
    aeo?: {
      overall: number;
      breakdown: {
        qa_quality: number;
        snippet_optimization: number;
        featured_snippet_potential: number;
        voice_search_readiness: number;
      };
    };
    geo?: {
      overall: number;
      breakdown: {
        local_keywords: number;
        location_relevance: number;
        business_info: number;
        reviews_sentiment: number;
      };
    };
  };
  recommendations: string[];
  metadata: {
    contentLength: number;
    analyzedAt: string;
    processingTime: number;
  };
  error?: string;
}

export function useScoring() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ScoringResponse | null>(null);

  const analyzeContent = useCallback(async (request: ScoringRequest): Promise<ScoringResponse | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/scoring/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to analyze content');
      }

      setData(result);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      logger.error('Content scoring error', new Error(errorMessage));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const analyzeUrl = useCallback(async (url: string, dealerId: string, type?: 'seo' | 'aeo' | 'geo'): Promise<ScoringResponse | null> => {
    return analyzeContent({ content: '', url, dealerId, type });
  }, [analyzeContent]);

  const batchAnalyze = useCallback(async (requests: ScoringRequest[]): Promise<(ScoringResponse | null)[]> => {
    const results = await Promise.allSettled(
      requests.map(request => analyzeContent(request))
    );

    return results.map(result =>
      result.status === 'fulfilled' ? result.value : null
    );
  }, [analyzeContent]);

  return {
    analyzeContent,
    analyzeUrl,
    batchAnalyze,
    loading,
    error,
    data,
    clearError: () => setError(null),
  };
}