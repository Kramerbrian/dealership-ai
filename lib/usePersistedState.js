// Enhanced persisted state hook with data persistence
import { useState, useEffect } from 'react';

export const usePersistedState = (key, defaultValue) => {
  const [state, setState] = useState(() => {
    if (typeof window === 'undefined') return defaultValue;

    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return defaultValue;
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      window.localStorage.setItem(key, JSON.stringify(state));
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  }, [key, state]);

  return [state, setState];
};

// Enhanced agent execution with persistence
export const usePersistedAIAgent = (dealerId) => {
  const [agentResults, setAgentResults] = usePersistedState(
    `ai-agent-results-${dealerId}`,
    {}
  );

  const [lastExecution, setLastExecution] = usePersistedState(
    `ai-agent-timestamps-${dealerId}`,
    {}
  );

  const executeAIAgent = async (agentType, context = {}) => {
    // Check if we have recent results (cache for 1 hour)
    const lastRun = lastExecution[agentType];
    const oneHourAgo = Date.now() - (60 * 60 * 1000);

    if (lastRun && lastRun > oneHourAgo && agentResults[agentType]) {
      console.log(`Using cached results for ${agentType}`);
      return agentResults[agentType];
    }

    try {
      // Execute AI agent via consensus API
      const response = await fetch('/api/analysis/consensus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: context.domain,
          analysisType: agentType,
          dealerId: dealerId
        })
      });

      const result = await response.json();

      // Persist the results
      setAgentResults(prev => ({ ...prev, [agentType]: result }));
      setLastExecution(prev => ({ ...prev, [agentType]: Date.now() }));

      return result;
    } catch (error) {
      console.error(`AI Agent execution failed for ${agentType}:`, error);
      throw error;
    }
  };

  const clearCache = (agentType) => {
    if (agentType) {
      // Clear specific agent cache
      setAgentResults(prev => {
        const updated = { ...prev };
        delete updated[agentType];
        return updated;
      });
      setLastExecution(prev => {
        const updated = { ...prev };
        delete updated[agentType];
        return updated;
      });
    } else {
      // Clear all cache
      setAgentResults({});
      setLastExecution({});
    }
  };

  const getCachedResult = (agentType) => {
    return agentResults[agentType] || null;
  };

  const isResultCached = (agentType) => {
    const lastRun = lastExecution[agentType];
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    return lastRun && lastRun > oneHourAgo && !!agentResults[agentType];
  };

  return {
    executeAIAgent,
    agentResults,
    clearCache,
    getCachedResult,
    isResultCached,
    lastExecution
  };
};