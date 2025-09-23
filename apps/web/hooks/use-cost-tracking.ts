import { useState, useEffect, useCallback } from 'react';
import { logger } from '@/lib/logger';

interface CostUsage {
  provider: 'openai' | 'anthropic';
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalCost: number;
  requestCount: number;
}

interface CostSummary {
  daily: CostUsage[];
  monthly: CostUsage[];
  total: CostUsage[];
  dailyTotal: number;
  monthlyTotal: number;
  grandTotal: number;
  lastUpdated: string;
}

interface BudgetLimits {
  daily: number;
  monthly: number;
  userId?: string;
  dealerId?: string;
}

export function useCostTracking() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<CostSummary | null>(null);
  const [budgetLimits, setBudgetLimits] = useState<BudgetLimits | null>(null);

  const fetchUsage = useCallback(async (): Promise<CostSummary | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/cost/usage');
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch cost usage');
      }

      setUsage(result);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      logger.error('Cost usage fetch error', new Error(errorMessage));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchBudgetLimits = useCallback(async (): Promise<BudgetLimits | null> => {
    try {
      const response = await fetch('/api/cost/budget');
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch budget limits');
      }

      setBudgetLimits(result);
      return result;
    } catch (err) {
      logger.error('Budget limits fetch error', err instanceof Error ? err : new Error(String(err)));
      return null;
    }
  }, []);

  const updateBudgetLimits = useCallback(async (limits: Partial<BudgetLimits>): Promise<boolean> => {
    try {
      const response = await fetch('/api/cost/budget', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(limits),
      });

      const result = await response.json();

      if (result.success) {
        await fetchBudgetLimits();
      }

      return result.success;
    } catch (err) {
      logger.error('Budget limits update error', err instanceof Error ? err : new Error(String(err)));
      return false;
    }
  }, [fetchBudgetLimits]);

  const checkBudget = useCallback(async (
    provider: string,
    model: string,
    inputTokens: number,
    outputTokens: number
  ): Promise<{ canProceed: boolean; reason?: string }> => {
    try {
      const response = await fetch('/api/cost/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ provider, model, inputTokens, outputTokens }),
      });

      const result = await response.json();
      return result;
    } catch (err) {
      logger.error('Budget check error', err instanceof Error ? err : new Error(String(err)));
      return { canProceed: false, reason: 'Budget check failed' };
    }
  }, []);

  useEffect(() => {
    fetchUsage();
    fetchBudgetLimits();
  }, [fetchUsage, fetchBudgetLimits]);

  const getBudgetUtilization = useCallback(() => {
    if (!usage || !budgetLimits) return null;

    return {
      daily: {
        used: usage.dailyTotal,
        limit: budgetLimits.daily,
        percentage: Math.round((usage.dailyTotal / budgetLimits.daily) * 100),
        remaining: budgetLimits.daily - usage.dailyTotal,
      },
      monthly: {
        used: usage.monthlyTotal,
        limit: budgetLimits.monthly,
        percentage: Math.round((usage.monthlyTotal / budgetLimits.monthly) * 100),
        remaining: budgetLimits.monthly - usage.monthlyTotal,
      },
    };
  }, [usage, budgetLimits]);

  return {
    usage,
    budgetLimits,
    budgetUtilization: getBudgetUtilization(),
    loading,
    error,
    fetchUsage,
    fetchBudgetLimits,
    updateBudgetLimits,
    checkBudget,
    clearError: () => setError(null),
  };
}