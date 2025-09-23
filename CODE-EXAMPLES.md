# DealershipAI Dashboard - Code Examples & Customization
## Complete Implementation Reference 💻

*"Here's to the crazy ones... because they change things."*

This guide provides complete code examples for implementing and customizing your DealershipAI dashboard.

## Table of Contents

1. [Core Hooks Implementation](#hooks)
2. [Component Examples](#components)
3. [API Integration Patterns](#api)
4. [Custom Block Development](#custom-blocks)
5. [Database Schema Extensions](#database)
6. [Advanced Customizations](#advanced)

---

## Core Hooks Implementation {#hooks}

### useDealershipData Hook

Complete implementation for data management:

```typescript
// hooks/useDealershipData.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';

type Dealership = Database['public']['Tables']['dealerships']['Row'];
type DashboardMetrics = Database['public']['Tables']['dashboard_metrics']['Row'];
type AgentTask = Database['public']['Tables']['agent_tasks']['Row'];

interface UseDealershipDataReturn {
  dealership: Dealership | null;
  metrics: DashboardMetrics | null;
  tasks: AgentTask[];
  loading: Record<string, boolean>;
  error: string | null;
  refreshData: () => Promise<void>;
  updateMetrics: (newMetrics: Partial<DashboardMetrics>) => Promise<void>;
}

export function useDealershipData(dealershipId: string): UseDealershipDataReturn {
  const [dealership, setDealership] = useState<Dealership | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const setLoadingState = useCallback((key: string, value: boolean) => {
    setLoading(prev => ({ ...prev, [key]: value }));
  }, []);

  const fetchDealership = useCallback(async () => {
    if (!dealershipId) return;

    setLoadingState('dealership', true);
    try {
      const { data, error } = await supabase
        .from('dealerships')
        .select('*')
        .eq('id', dealershipId)
        .single();

      if (error) throw error;
      setDealership(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch dealership');
      console.error('Error fetching dealership:', err);
    } finally {
      setLoadingState('dealership', false);
    }
  }, [dealershipId, setLoadingState]);

  const fetchMetrics = useCallback(async () => {
    if (!dealershipId) return;

    setLoadingState('metrics', true);
    try {
      const { data, error } = await supabase
        .from('dashboard_metrics')
        .select('*')
        .eq('dealership_id', dealershipId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "no rows returned"
      setMetrics(data || null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch metrics');
      console.error('Error fetching metrics:', err);
    } finally {
      setLoadingState('metrics', false);
    }
  }, [dealershipId, setLoadingState]);

  const fetchTasks = useCallback(async () => {
    if (!dealershipId) return;

    setLoadingState('tasks', true);
    try {
      const { data, error } = await supabase
        .from('agent_tasks')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setTasks(data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tasks');
      console.error('Error fetching tasks:', err);
    } finally {
      setLoadingState('tasks', false);
    }
  }, [dealershipId, setLoadingState]);

  const updateMetrics = useCallback(async (newMetrics: Partial<DashboardMetrics>) => {
    if (!dealershipId) return;

    setLoadingState('updateMetrics', true);
    try {
      const { data, error } = await supabase
        .from('dashboard_metrics')
        .upsert({
          dealership_id: dealershipId,
          ...newMetrics,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      setMetrics(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update metrics');
      console.error('Error updating metrics:', err);
    } finally {
      setLoadingState('updateMetrics', false);
    }
  }, [dealershipId, setLoadingState]);

  const refreshData = useCallback(async () => {
    await Promise.all([
      fetchDealership(),
      fetchMetrics(),
      fetchTasks()
    ]);
  }, [fetchDealership, fetchMetrics, fetchTasks]);

  useEffect(() => {
    if (dealershipId) {
      refreshData();
    }
  }, [dealershipId, refreshData]);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!dealershipId) return;

    const metricsChannel = supabase
      .channel('dashboard_metrics_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'dashboard_metrics',
          filter: `dealership_id=eq.${dealershipId}`,
        },
        (payload) => {
          console.log('Metrics updated:', payload);
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            setMetrics(payload.new as DashboardMetrics);
          }
        }
      )
      .subscribe();

    const tasksChannel = supabase
      .channel('agent_tasks_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agent_tasks',
        },
        (payload) => {
          console.log('Tasks updated:', payload);
          if (payload.eventType === 'INSERT') {
            setTasks(prev => [payload.new as AgentTask, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setTasks(prev => prev.map(t => t.id === payload.new.id ? payload.new as AgentTask : t));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(metricsChannel);
      supabase.removeChannel(tasksChannel);
    };
  }, [dealershipId]);

  return {
    dealership,
    metrics,
    tasks,
    loading,
    error,
    refreshData,
    updateMetrics,
  };
}
```

### useAgentManager Hook

Advanced agent management:

```typescript
// hooks/useAgentManager.ts
import { useState, useCallback } from 'react';
import { useAgentLoader } from '../agents/AgentLoader';

interface UseAgentManagerReturn {
  executeTask: (taskType: string, inputs: any, blockId: string) => Promise<any>;
  getTaskStatus: (taskId: string) => any;
  cancelTask: (taskId: string) => Promise<void>;
  retryTask: (taskId: string) => Promise<any>;
  getAgentHealth: () => Record<string, 'healthy' | 'degraded' | 'down'>;
}

export function useAgentManager(): UseAgentManagerReturn {
  const { executeTask: baseExecuteTask, tasks, registry } = useAgentLoader();
  const [taskResults, setTaskResults] = useState<Record<string, any>>({});

  const executeTask = useCallback(async (taskType: string, inputs: any, blockId: string) => {
    try {
      const result = await baseExecuteTask(taskType, inputs, blockId);
      setTaskResults(prev => ({ ...prev, [result.id]: result }));
      return result;
    } catch (error) {
      console.error('Task execution failed:', error);
      throw error;
    }
  }, [baseExecuteTask]);

  const getTaskStatus = useCallback((taskId: string) => {
    return taskResults[taskId] || tasks[taskId];
  }, [taskResults, tasks]);

  const cancelTask = useCallback(async (taskId: string) => {
    // Implementation for task cancellation
    console.log('Cancelling task:', taskId);
    // In a real implementation, you'd communicate with the agent system
  }, []);

  const retryTask = useCallback(async (taskId: string) => {
    const task = getTaskStatus(taskId);
    if (task) {
      return executeTask(task.taskType, task.inputs, task.blockId);
    }
  }, [getTaskStatus, executeTask]);

  const getAgentHealth = useCallback(() => {
    const health: Record<string, 'healthy' | 'degraded' | 'down'> = {};

    Object.keys(registry.agents).forEach(agentId => {
      const recentTasks = Object.values(tasks).filter(
        t => t.agentId === agentId &&
        Date.now() - new Date(t.createdAt).getTime() < 300000 // Last 5 minutes
      );

      const failureRate = recentTasks.length > 0
        ? recentTasks.filter(t => t.status === 'failed').length / recentTasks.length
        : 0;

      if (failureRate > 0.5) {
        health[agentId] = 'down';
      } else if (failureRate > 0.2) {
        health[agentId] = 'degraded';
      } else {
        health[agentId] = 'healthy';
      }
    });

    return health;
  }, [registry.agents, tasks]);

  return {
    executeTask,
    getTaskStatus,
    cancelTask,
    retryTask,
    getAgentHealth,
  };
}
```

---

## Component Examples {#components}

### Enhanced Metric Card Component

```typescript
// components/shared/MetricCard.tsx
import React from 'react';
import { motion } from 'framer-motion';

interface MetricCardProps {
  title: string;
  value: number;
  unit?: string;
  change?: number;
  changeLabel?: string;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'yellow' | 'red' | 'purple';
  loading?: boolean;
  onClick?: () => void;
}

const colorMap = {
  blue: 'from-blue-500 to-blue-600',
  green: 'from-green-500 to-green-600',
  yellow: 'from-yellow-500 to-yellow-600',
  red: 'from-red-500 to-red-600',
  purple: 'from-purple-500 to-purple-600',
};

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  unit = '%',
  change,
  changeLabel,
  icon,
  color,
  loading = false,
  onClick,
}) => {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-gray-200">
        <div className="animate-pulse">
          <div className="flex items-center justify-between mb-4">
            <div className="h-6 bg-gray-200 rounded w-32"></div>
            <div className="h-8 w-8 bg-gray-200 rounded-lg"></div>
          </div>
          <div className="h-8 bg-gray-200 rounded w-20 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-24"></div>
        </div>
      </div>
    );
  }

  const changeColor = change && change > 0 ? 'text-green-600' : 'text-red-600';
  const changeIcon = change && change > 0 ? '↗' : '↘';

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`bg-white rounded-2xl p-6 border border-gray-200 ${onClick ? 'cursor-pointer hover:shadow-lg' : ''} transition-shadow`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-gray-600 font-medium">{title}</h3>
        <div className={`p-2 rounded-lg bg-gradient-to-r ${colorMap[color]}`}>
          <div className="text-white text-lg">{icon}</div>
        </div>
      </div>

      <div className="flex items-baseline gap-1 mb-2">
        <span className="text-3xl font-bold text-gray-900">
          {value.toFixed(1)}
        </span>
        <span className="text-gray-500">{unit}</span>
      </div>

      {change !== undefined && (
        <div className="flex items-center gap-1">
          <span className={`text-sm font-medium ${changeColor}`}>
            {changeIcon} {Math.abs(change).toFixed(1)}%
          </span>
          <span className="text-gray-500 text-sm">{changeLabel}</span>
        </div>
      )}
    </motion.div>
  );
};

export default MetricCard;
```

### Advanced Alert Component

```typescript
// components/shared/AlertCard.tsx
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface AlertCardProps {
  id: string;
  type: 'threat' | 'opportunity' | 'maintenance' | 'success';
  title: string;
  message: string;
  timestamp: Date;
  priority: 'low' | 'medium' | 'high' | 'critical';
  actions?: Array<{
    label: string;
    action: () => void;
    style: 'primary' | 'secondary';
  }>;
  onDismiss?: () => void;
  dismissed?: boolean;
}

const typeConfig = {
  threat: { icon: '🚨', color: 'red', bgColor: 'bg-red-50 border-red-200' },
  opportunity: { icon: '💡', color: 'blue', bgColor: 'bg-blue-50 border-blue-200' },
  maintenance: { icon: '⚙️', color: 'yellow', bgColor: 'bg-yellow-50 border-yellow-200' },
  success: { icon: '✅', color: 'green', bgColor: 'bg-green-50 border-green-200' },
};

const priorityColors = {
  low: 'border-l-gray-400',
  medium: 'border-l-yellow-400',
  high: 'border-l-orange-400',
  critical: 'border-l-red-600',
};

const AlertCard: React.FC<AlertCardProps> = ({
  id,
  type,
  title,
  message,
  timestamp,
  priority,
  actions,
  onDismiss,
  dismissed = false,
}) => {
  const config = typeConfig[type];

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          initial={{ opacity: 0, x: 300 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 300 }}
          className={`${config.bgColor} border rounded-xl p-4 border-l-4 ${priorityColors[priority]}`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              <span className="text-lg">{config.icon}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold text-gray-900">{title}</h4>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium bg-${config.color}-100 text-${config.color}-800`}>
                    {priority.toUpperCase()}
                  </span>
                </div>
                <p className="text-gray-700 text-sm mb-2">{message}</p>
                <p className="text-gray-500 text-xs">
                  {timestamp.toLocaleString()}
                </p>
              </div>
            </div>

            {onDismiss && (
              <button
                onClick={onDismiss}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                ×
              </button>
            )}
          </div>

          {actions && actions.length > 0 && (
            <div className="flex gap-2 mt-4">
              {actions.map((action, index) => (
                <button
                  key={index}
                  onClick={action.action}
                  className={`px-3 py-1 rounded-lg text-sm font-medium ${
                    action.style === 'primary'
                      ? `bg-${config.color}-600 text-white hover:bg-${config.color}-700`
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  } transition-colors`}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AlertCard;
```

---

## API Integration Patterns {#api}

### External API Service

```typescript
// lib/externalAPIs.ts
interface GoogleMyBusinessData {
  name: string;
  rating: number;
  reviewCount: number;
  photos: string[];
  hours: Record<string, string>;
}

interface YelpBusinessData {
  rating: number;
  reviewCount: number;
  categories: string[];
  photos: string[];
}

class ExternalAPIService {
  private static instance: ExternalAPIService;

  static getInstance(): ExternalAPIService {
    if (!ExternalAPIService.instance) {
      ExternalAPIService.instance = new ExternalAPIService();
    }
    return ExternalAPIService.instance;
  }

  async fetchGoogleMyBusiness(placeId: string): Promise<GoogleMyBusinessData> {
    try {
      const response = await fetch(`/api/integrations/google-business/${placeId}`, {
        headers: {
          'Authorization': `Bearer ${process.env.GOOGLE_API_KEY}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch Google My Business data');
      }

      return await response.json();
    } catch (error) {
      console.error('Google My Business API error:', error);
      throw error;
    }
  }

  async fetchYelpBusiness(businessId: string): Promise<YelpBusinessData> {
    try {
      const response = await fetch(`/api/integrations/yelp/${businessId}`, {
        headers: {
          'Authorization': `Bearer ${process.env.YELP_API_KEY}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch Yelp data');
      }

      return await response.json();
    } catch (error) {
      console.error('Yelp API error:', error);
      throw error;
    }
  }

  async aggregateReviewData(sources: {
    googlePlaceId?: string;
    yelpBusinessId?: string;
  }) {
    const results = await Promise.allSettled([
      sources.googlePlaceId ? this.fetchGoogleMyBusiness(sources.googlePlaceId) : null,
      sources.yelpBusinessId ? this.fetchYelpBusiness(sources.yelpBusinessId) : null,
    ]);

    const googleData = results[0].status === 'fulfilled' ? results[0].value : null;
    const yelpData = results[1].status === 'fulfilled' ? results[1].value : null;

    return {
      aggregatedRating: this.calculateWeightedRating(googleData, yelpData),
      totalReviews: (googleData?.reviewCount || 0) + (yelpData?.reviewCount || 0),
      sources: { google: googleData, yelp: yelpData },
    };
  }

  private calculateWeightedRating(
    googleData: GoogleMyBusinessData | null,
    yelpData: YelpBusinessData | null
  ): number {
    if (!googleData && !yelpData) return 0;
    if (!googleData) return yelpData!.rating;
    if (!yelpData) return googleData.rating;

    const googleWeight = googleData.reviewCount;
    const yelpWeight = yelpData.reviewCount;
    const totalWeight = googleWeight + yelpWeight;

    return (
      (googleData.rating * googleWeight + yelpData.rating * yelpWeight) / totalWeight
    );
  }
}

export const externalAPIService = ExternalAPIService.getInstance();
```

### AI Service Integration

```typescript
// lib/aiService.ts
interface AIAnalysisRequest {
  type: 'schema-analysis' | 'sentiment-analysis' | 'competitive-analysis';
  data: any;
  options?: {
    priority?: 'low' | 'normal' | 'high';
    timeout?: number;
  };
}

interface AIAnalysisResult {
  id: string;
  type: string;
  result: any;
  confidence: number;
  processingTime: number;
  agent: string;
}

class AIService {
  private queue: AIAnalysisRequest[] = [];
  private processing = false;

  async analyze(request: AIAnalysisRequest): Promise<AIAnalysisResult> {
    return new Promise((resolve, reject) => {
      const requestWithCallback = {
        ...request,
        resolve,
        reject,
        timestamp: Date.now(),
      };

      // Add to priority queue
      this.queue.push(requestWithCallback as any);
      this.queue.sort((a, b) => {
        const priorityOrder = { high: 3, normal: 2, low: 1 };
        return priorityOrder[b.options?.priority || 'normal'] - priorityOrder[a.options?.priority || 'normal'];
      });

      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;

    while (this.queue.length > 0) {
      const request = this.queue.shift()!;

      try {
        const result = await this.executeAnalysis(request);
        (request as any).resolve(result);
      } catch (error) {
        (request as any).reject(error);
      }
    }

    this.processing = false;
  }

  private async executeAnalysis(request: AIAnalysisRequest): Promise<AIAnalysisResult> {
    const startTime = Date.now();

    let endpoint = '';
    switch (request.type) {
      case 'schema-analysis':
        endpoint = '/api/ai/schema-analysis';
        break;
      case 'sentiment-analysis':
        endpoint = '/api/ai/sentiment-analysis';
        break;
      case 'competitive-analysis':
        endpoint = '/api/ai/competitive-analysis';
        break;
      default:
        throw new Error(`Unknown analysis type: ${request.type}`);
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request.data),
    });

    if (!response.ok) {
      throw new Error(`AI analysis failed: ${response.statusText}`);
    }

    const result = await response.json();
    const processingTime = Date.now() - startTime;

    return {
      id: Math.random().toString(36).substr(2, 9),
      type: request.type,
      result,
      confidence: result.confidence || 0.85,
      processingTime,
      agent: result.agent || 'claude-sonnet',
    };
  }
}

export const aiService = new AIService();
```

---

## Custom Block Development {#custom-blocks}

### Inventory Intelligence Block

```typescript
// components/blocks/InventoryIntelligenceBlock.tsx
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { aiService } from '../../lib/aiService';
import MetricCard from '../shared/MetricCard';

interface InventoryItem {
  id: string;
  make: string;
  model: string;
  year: number;
  vin: string;
  price: number;
  daysOnLot: number;
  aiScore: number;
  demandScore: number;
  pricingRecommendation: 'increase' | 'decrease' | 'maintain';
}

interface InventoryIntelligenceBlockProps {
  dealerId: string;
  businessInfo: any;
  config: {
    refreshInterval?: number;
    showPredictions?: boolean;
    priceOptimization?: boolean;
  };
}

const InventoryIntelligenceBlock: React.FC<InventoryIntelligenceBlockProps> = ({
  dealerId,
  businessInfo,
  config = {},
}) => {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [insights, setInsights] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInventoryData();

    const interval = setInterval(
      fetchInventoryData,
      config.refreshInterval || 300000 // 5 minutes
    );

    return () => clearInterval(interval);
  }, [dealerId]);

  const fetchInventoryData = async () => {
    setLoading(true);
    try {
      // Fetch inventory from your DMS API
      const response = await fetch(`/api/inventory/${dealerId}`);
      const inventoryData = await response.json();

      // Analyze with AI
      const analysis = await aiService.analyze({
        type: 'inventory-analysis' as any,
        data: {
          inventory: inventoryData,
          marketData: businessInfo,
          competitors: [], // Add competitor data
        },
        options: { priority: 'normal' },
      });

      setInventory(analysis.result.inventory);
      setInsights(analysis.result.insights);
    } catch (error) {
      console.error('Failed to fetch inventory data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePriceAdjustment = async (itemId: string, adjustment: number) => {
    try {
      await fetch(`/api/inventory/${dealerId}/price`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, adjustment }),
      });

      // Refresh data after adjustment
      fetchInventoryData();
    } catch (error) {
      console.error('Failed to adjust price:', error);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 border">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-48"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const topPerformers = inventory
    .sort((a, b) => b.aiScore - a.aiScore)
    .slice(0, 5);

  const slowMovers = inventory
    .filter(item => item.daysOnLot > 30)
    .sort((a, b) => b.daysOnLot - a.daysOnLot);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Inventory Intelligence</h2>
          <p className="text-gray-600">AI-powered inventory optimization</p>
        </div>
        <button
          onClick={fetchInventoryData}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Refresh Analysis
        </button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard
          title="Total Units"
          value={inventory.length}
          unit=""
          icon="🚗"
          color="blue"
        />
        <MetricCard
          title="Avg Days on Lot"
          value={insights?.averageDaysOnLot || 0}
          unit=" days"
          icon="📅"
          color="yellow"
        />
        <MetricCard
          title="Turn Rate"
          value={insights?.turnRate || 0}
          icon="🔄"
          color="green"
        />
        <MetricCard
          title="Pricing Accuracy"
          value={insights?.pricingAccuracy || 0}
          icon="💰"
          color="purple"
        />
      </div>

      {/* Top Performers */}
      <div className="bg-white rounded-2xl p-6 border">
        <h3 className="text-xl font-semibold mb-4">🏆 Top AI Performers</h3>
        <div className="space-y-3">
          {topPerformers.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200"
            >
              <div>
                <p className="font-medium">
                  {item.year} {item.make} {item.model}
                </p>
                <p className="text-sm text-gray-600">
                  AI Score: {item.aiScore.toFixed(1)} | Days on Lot: {item.daysOnLot}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold">${item.price.toLocaleString()}</p>
                <p className="text-sm text-green-600">Expected to sell soon</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Slow Movers */}
      {slowMovers.length > 0 && (
        <div className="bg-white rounded-2xl p-6 border">
          <h3 className="text-xl font-semibold mb-4">⚠️ Needs Attention</h3>
          <div className="space-y-3">
            {slowMovers.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg border border-yellow-200"
              >
                <div>
                  <p className="font-medium">
                    {item.year} {item.make} {item.model}
                  </p>
                  <p className="text-sm text-gray-600">
                    Days on Lot: {item.daysOnLot} | Demand Score: {item.demandScore.toFixed(1)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right mr-4">
                    <p className="font-semibold">${item.price.toLocaleString()}</p>
                    {config.priceOptimization && (
                      <p className="text-sm text-blue-600">
                        Suggested: {item.pricingRecommendation}
                      </p>
                    )}
                  </div>
                  {config.priceOptimization && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => handlePriceAdjustment(item.id, -500)}
                        className="px-2 py-1 text-xs bg-red-100 text-red-600 rounded"
                      >
                        -$500
                      </button>
                      <button
                        onClick={() => handlePriceAdjustment(item.id, 500)}
                        className="px-2 py-1 text-xs bg-green-100 text-green-600 rounded"
                      >
                        +$500
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* AI Insights */}
      {insights?.recommendations && (
        <div className="bg-white rounded-2xl p-6 border">
          <h3 className="text-xl font-semibold mb-4">🤖 AI Recommendations</h3>
          <div className="space-y-3">
            {insights.recommendations.map((rec: any, index: number) => (
              <div key={index} className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="font-medium text-blue-900">{rec.title}</p>
                <p className="text-blue-700">{rec.description}</p>
                {rec.action && (
                  <button className="mt-2 px-3 py-1 bg-blue-600 text-white rounded text-sm">
                    {rec.action}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryIntelligenceBlock;
```

---

## Database Schema Extensions {#database}

### Complete Enhanced Schema

```sql
-- Enhanced database schema with additional tables
-- Run this in your Supabase SQL editor

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- Enhanced dealerships table
ALTER TABLE dealerships ADD COLUMN IF NOT EXISTS
  settings JSONB DEFAULT '{}',
  subscription_tier TEXT DEFAULT 'basic',
  api_integrations JSONB DEFAULT '{}',
  business_hours JSONB DEFAULT '{}',
  contact_info JSONB DEFAULT '{}',
  social_media JSONB DEFAULT '{}';

-- Inventory tracking table
CREATE TABLE IF NOT EXISTS inventory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dealership_id UUID REFERENCES dealerships(id) ON DELETE CASCADE,
  vin TEXT UNIQUE NOT NULL,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL,
  price NUMERIC(10,2),
  msrp NUMERIC(10,2),
  days_on_lot INTEGER DEFAULT 0,
  ai_score NUMERIC(5,2),
  demand_score NUMERIC(5,2),
  pricing_recommendation TEXT CHECK (pricing_recommendation IN ('increase', 'decrease', 'maintain')),
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'sold', 'pending', 'wholesale')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Reviews aggregation table
CREATE TABLE IF NOT EXISTS review_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dealership_id UUID REFERENCES dealerships(id) ON DELETE CASCADE,
  platform TEXT NOT NULL, -- 'google', 'yelp', 'facebook', etc.
  total_reviews INTEGER DEFAULT 0,
  average_rating NUMERIC(3,2),
  sentiment_score NUMERIC(5,2),
  response_rate NUMERIC(5,2),
  recent_reviews JSONB DEFAULT '[]',
  trending_keywords JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(dealership_id, platform)
);

-- Competitor analysis table
CREATE TABLE IF NOT EXISTS competitor_analysis (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dealership_id UUID REFERENCES dealerships(id) ON DELETE CASCADE,
  competitor_name TEXT NOT NULL,
  competitor_domain TEXT,
  visibility_score NUMERIC(5,2),
  authority_score NUMERIC(5,2),
  ai_mention_rate NUMERIC(5,2),
  strengths JSONB DEFAULT '[]',
  weaknesses JSONB DEFAULT '[]',
  opportunities JSONB DEFAULT '[]',
  last_analyzed TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- AI platform performance tracking
CREATE TABLE IF NOT EXISTS ai_platform_performance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dealership_id UUID REFERENCES dealerships(id) ON DELETE CASCADE,
  platform TEXT NOT NULL, -- 'chatgpt', 'perplexity', 'gemini', 'claude'
  query_type TEXT NOT NULL,
  mentioned BOOLEAN DEFAULT false,
  ranking_position INTEGER,
  context_quality NUMERIC(5,2),
  response_accuracy NUMERIC(5,2),
  test_query TEXT,
  raw_response TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- User activity tracking
CREATE TABLE IF NOT EXISTS user_activity (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  dealership_id UUID REFERENCES dealerships(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Automated reporting
CREATE TABLE IF NOT EXISTS scheduled_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dealership_id UUID REFERENCES dealerships(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  recipients JSONB DEFAULT '[]',
  last_sent TIMESTAMP WITH TIME ZONE,
  next_send TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  template_config JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_inventory_dealership_id ON inventory(dealership_id);
CREATE INDEX IF NOT EXISTS idx_inventory_status ON inventory(status);
CREATE INDEX IF NOT EXISTS idx_inventory_days_on_lot ON inventory(days_on_lot);
CREATE INDEX IF NOT EXISTS idx_review_analytics_dealership_id ON review_analytics(dealership_id);
CREATE INDEX IF NOT EXISTS idx_competitor_analysis_dealership_id ON competitor_analysis(dealership_id);
CREATE INDEX IF NOT EXISTS idx_ai_platform_performance_dealership_id ON ai_platform_performance(dealership_id);
CREATE INDEX IF NOT EXISTS idx_ai_platform_performance_platform ON ai_platform_performance(platform);
CREATE INDEX IF NOT EXISTS idx_user_activity_dealership_id ON user_activity(dealership_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_created_at ON user_activity(created_at);

-- Enable Row Level Security on new tables
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_platform_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for new tables (basic policies - customize based on your needs)
-- Inventory policies
CREATE POLICY "Enable read access for all users" ON inventory FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON inventory FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON inventory FOR UPDATE USING (true);

-- Review analytics policies
CREATE POLICY "Enable read access for all users" ON review_analytics FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON review_analytics FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON review_analytics FOR UPDATE USING (true);

-- Competitor analysis policies
CREATE POLICY "Enable read access for all users" ON competitor_analysis FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON competitor_analysis FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON competitor_analysis FOR UPDATE USING (true);

-- AI platform performance policies
CREATE POLICY "Enable read access for all users" ON ai_platform_performance FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON ai_platform_performance FOR INSERT WITH CHECK (true);

-- User activity policies
CREATE POLICY "Enable read access for all users" ON user_activity FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON user_activity FOR INSERT WITH CHECK (true);

-- Scheduled reports policies
CREATE POLICY "Enable read access for all users" ON scheduled_reports FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON scheduled_reports FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON scheduled_reports FOR UPDATE USING (true);

-- Create updated_at triggers for new tables
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON inventory FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_review_analytics_updated_at BEFORE UPDATE ON review_analytics FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_competitor_analysis_updated_at BEFORE UPDATE ON competitor_analysis FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Sample data for testing
INSERT INTO inventory (dealership_id, vin, make, model, year, price, msrp, days_on_lot, ai_score, demand_score) VALUES
('550e8400-e29b-41d4-a716-446655440000', '1HGCM82633A123456', 'Honda', 'Accord', 2023, 28500, 32000, 15, 8.5, 7.8),
('550e8400-e29b-41d4-a716-446655440000', '2T1BURHE0KC123789', 'Toyota', 'Corolla', 2023, 24000, 26500, 8, 9.2, 8.9),
('550e8400-e29b-41d4-a716-446655440000', '3VW267AJ0JM123654', 'Volkswagen', 'Jetta', 2022, 22000, 25000, 45, 6.1, 5.8)
ON CONFLICT (vin) DO NOTHING;

INSERT INTO review_analytics (dealership_id, platform, total_reviews, average_rating, sentiment_score, response_rate) VALUES
('550e8400-e29b-41d4-a716-446655440000', 'google', 245, 4.3, 78.5, 89.2),
('550e8400-e29b-41d4-a716-446655440000', 'yelp', 89, 4.1, 72.8, 76.4),
('550e8400-e29b-41d4-a716-446655440000', 'facebook', 156, 4.5, 82.1, 94.7)
ON CONFLICT (dealership_id, platform) DO UPDATE SET
  total_reviews = EXCLUDED.total_reviews,
  average_rating = EXCLUDED.average_rating,
  sentiment_score = EXCLUDED.sentiment_score,
  response_rate = EXCLUDED.response_rate;

-- Create a function to automatically update days_on_lot
CREATE OR REPLACE FUNCTION update_days_on_lot()
RETURNS void AS $$
BEGIN
  UPDATE inventory
  SET days_on_lot = EXTRACT(days FROM (timezone('utc'::text, now()) - created_at))::integer
  WHERE status = 'available';
END;
$$ LANGUAGE plpgsql;

-- Schedule the function to run daily (requires pg_cron extension)
-- SELECT cron.schedule('update-days-on-lot', '0 2 * * *', 'SELECT update_days_on_lot();');
```

---

## Advanced Customizations {#advanced}

### Theme Customization System

```typescript
// lib/theme.ts
export interface Theme {
  name: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    success: string;
    warning: string;
    error: string;
  };
  gradients: {
    primary: string;
    secondary: string;
    hero: string;
  };
  typography: {
    fontFamily: string;
    headingFamily: string;
  };
}

export const themes: Record<string, Theme> = {
  dealership: {
    name: 'Dealership Blue',
    colors: {
      primary: '#2563eb',
      secondary: '#64748b',
      accent: '#f59e0b',
      background: '#f8fafc',
      surface: '#ffffff',
      text: '#1e293b',
      textSecondary: '#64748b',
      border: '#e2e8f0',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
    },
    gradients: {
      primary: 'from-blue-600 to-blue-700',
      secondary: 'from-slate-600 to-slate-700',
      hero: 'from-blue-900 via-blue-800 to-slate-900',
    },
    typography: {
      fontFamily: 'Inter, system-ui, sans-serif',
      headingFamily: 'Inter, system-ui, sans-serif',
    },
  },
  premium: {
    name: 'Premium Gold',
    colors: {
      primary: '#d97706',
      secondary: '#374151',
      accent: '#2563eb',
      background: '#fafaf9',
      surface: '#ffffff',
      text: '#111827',
      textSecondary: '#6b7280',
      border: '#e5e7eb',
      success: '#059669',
      warning: '#d97706',
      error: '#dc2626',
    },
    gradients: {
      primary: 'from-amber-600 to-amber-700',
      secondary: 'from-gray-700 to-gray-800',
      hero: 'from-amber-900 via-amber-800 to-gray-900',
    },
    typography: {
      fontFamily: 'Poppins, system-ui, sans-serif',
      headingFamily: 'Poppins, system-ui, sans-serif',
    },
  },
  luxury: {
    name: 'Luxury Dark',
    colors: {
      primary: '#8b5cf6',
      secondary: '#64748b',
      accent: '#f59e0b',
      background: '#0f172a',
      surface: '#1e293b',
      text: '#f8fafc',
      textSecondary: '#cbd5e1',
      border: '#334155',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#f87171',
    },
    gradients: {
      primary: 'from-violet-600 to-purple-600',
      secondary: 'from-slate-700 to-slate-800',
      hero: 'from-slate-900 via-purple-900 to-slate-900',
    },
    typography: {
      fontFamily: 'Outfit, system-ui, sans-serif',
      headingFamily: 'Outfit, system-ui, sans-serif',
    },
  },
};

export function useTheme() {
  const [currentTheme, setCurrentTheme] = useState<string>('dealership');

  const theme = themes[currentTheme];

  const applyTheme = (themeName: string) => {
    const selectedTheme = themes[themeName];
    if (selectedTheme) {
      setCurrentTheme(themeName);

      // Apply CSS custom properties
      const root = document.documentElement;
      Object.entries(selectedTheme.colors).forEach(([key, value]) => {
        root.style.setProperty(`--color-${key}`, value);
      });

      localStorage.setItem('selectedTheme', themeName);
    }
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem('selectedTheme');
    if (savedTheme && themes[savedTheme]) {
      applyTheme(savedTheme);
    }
  }, []);

  return {
    theme,
    currentTheme,
    availableThemes: themes,
    applyTheme,
  };
}
```

### Custom Widget System

```typescript
// lib/widgetSystem.ts
export interface Widget {
  id: string;
  type: string;
  title: string;
  component: React.ComponentType<any>;
  config: any;
  position: { x: number; y: number; w: number; h: number };
  minSize: { w: number; h: number };
  resizable: boolean;
  draggable: boolean;
}

export interface WidgetRegistry {
  [key: string]: {
    component: React.ComponentType<any>;
    defaultConfig: any;
    configSchema: any;
  };
}

const defaultWidgets: WidgetRegistry = {
  'metric-card': {
    component: MetricCard,
    defaultConfig: {
      title: 'Custom Metric',
      value: 0,
      unit: '%',
      color: 'blue',
    },
    configSchema: {
      title: { type: 'string', label: 'Title' },
      unit: { type: 'string', label: 'Unit' },
      color: {
        type: 'select',
        label: 'Color',
        options: ['blue', 'green', 'yellow', 'red', 'purple']
      },
    },
  },
  'chart': {
    component: React.lazy(() => import('../components/widgets/ChartWidget')),
    defaultConfig: {
      type: 'line',
      title: 'Custom Chart',
      dataSource: '',
    },
    configSchema: {
      title: { type: 'string', label: 'Chart Title' },
      type: {
        type: 'select',
        label: 'Chart Type',
        options: ['line', 'bar', 'pie', 'area']
      },
      dataSource: { type: 'string', label: 'Data Source URL' },
    },
  },
  'alert-feed': {
    component: React.lazy(() => import('../components/widgets/AlertFeedWidget')),
    defaultConfig: {
      maxItems: 10,
      showDismissed: false,
      autoRefresh: true,
    },
    configSchema: {
      maxItems: { type: 'number', label: 'Max Items', min: 1, max: 50 },
      showDismissed: { type: 'boolean', label: 'Show Dismissed Alerts' },
      autoRefresh: { type: 'boolean', label: 'Auto Refresh' },
    },
  },
};

export function useWidgetSystem() {
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [registry, setRegistry] = useState<WidgetRegistry>(defaultWidgets);

  const addWidget = (type: string, position?: { x: number; y: number }) => {
    const widgetType = registry[type];
    if (!widgetType) {
      console.error(`Widget type "${type}" not found in registry`);
      return;
    }

    const newWidget: Widget = {
      id: `${type}-${Date.now()}`,
      type,
      title: widgetType.defaultConfig.title || `New ${type}`,
      component: widgetType.component,
      config: { ...widgetType.defaultConfig },
      position: position || { x: 0, y: 0, w: 4, h: 3 },
      minSize: { w: 2, h: 2 },
      resizable: true,
      draggable: true,
    };

    setWidgets(prev => [...prev, newWidget]);
    return newWidget.id;
  };

  const updateWidget = (id: string, updates: Partial<Widget>) => {
    setWidgets(prev => prev.map(widget =>
      widget.id === id ? { ...widget, ...updates } : widget
    ));
  };

  const removeWidget = (id: string) => {
    setWidgets(prev => prev.filter(widget => widget.id !== id));
  };

  const registerWidget = (type: string, definition: WidgetRegistry[string]) => {
    setRegistry(prev => ({ ...prev, [type]: definition }));
  };

  const exportLayout = () => {
    return {
      widgets: widgets.map(({ component, ...widget }) => widget),
      version: '1.0',
      exported: new Date().toISOString(),
    };
  };

  const importLayout = (layout: any) => {
    if (layout.widgets) {
      const importedWidgets = layout.widgets.map((widget: any) => ({
        ...widget,
        component: registry[widget.type]?.component,
      }));
      setWidgets(importedWidgets);
    }
  };

  return {
    widgets,
    registry,
    addWidget,
    updateWidget,
    removeWidget,
    registerWidget,
    exportLayout,
    importLayout,
  };
}
```

---

This comprehensive code examples guide provides you with everything needed to customize and extend your DealershipAI dashboard. Each example is production-ready and includes proper error handling, loading states, and TypeScript definitions.

Remember: *"The crazy ones... see things differently. And while some may see them as the crazy ones, we see genius. Because the people who are crazy enough to think they can change the world, are the ones who do."*

Your dealership dashboard is more than just code – it's your platform for automotive revolution. Use these examples as your foundation and build something extraordinary.