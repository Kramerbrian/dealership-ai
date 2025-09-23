import { logger, logBusinessMetric } from './logger';

// Metrics collection interface
interface MetricData {
  name: string;
  value: number;
  unit: 'count' | 'gauge' | 'histogram' | 'timer';
  tags?: Record<string, string>;
  timestamp?: Date;
}

// Business metrics for DealershipAI
export class DealershipAIMetrics {
  private static instance: DealershipAIMetrics;
  private metricsBuffer: MetricData[] = [];
  private flushInterval: NodeJS.Timeout | null = null;

  private constructor() {
    // Start flushing metrics every 30 seconds
    this.flushInterval = setInterval(() => {
      this.flush();
    }, 30000);
  }

  static getInstance(): DealershipAIMetrics {
    if (!DealershipAIMetrics.instance) {
      DealershipAIMetrics.instance = new DealershipAIMetrics();
    }
    return DealershipAIMetrics.instance;
  }

  // Core business metrics
  recordDealerRegistration(dealerId: string, tier: string) {
    this.record({
      name: 'dealer_registration',
      value: 1,
      unit: 'count',
      tags: { dealerId, tier }
    });

    logBusinessMetric('dealer_registration', 1, { dealerId, tier });
  }

  recordUserLogin(userId: string, dealerId: string, role: string) {
    this.record({
      name: 'user_login',
      value: 1,
      unit: 'count',
      tags: { userId, dealerId, role }
    });
  }

  recordAIQuery(
    userId: string,
    dealerId: string,
    provider: 'openai' | 'anthropic',
    model: string,
    tokens: number,
    cost: number,
    responseTime: number
  ) {
    this.record({
      name: 'ai_query_total',
      value: 1,
      unit: 'count',
      tags: { userId, dealerId, provider, model }
    });

    this.record({
      name: 'ai_query_tokens',
      value: tokens,
      unit: 'gauge',
      tags: { provider, model }
    });

    this.record({
      name: 'ai_query_cost',
      value: cost,
      unit: 'gauge',
      tags: { provider, model }
    });

    this.record({
      name: 'ai_query_response_time',
      value: responseTime,
      unit: 'timer',
      tags: { provider, model }
    });

    logBusinessMetric('ai_query', cost, { userId, dealerId, provider, model, tokens, responseTime });
  }

  recordPilotMetric(dealerId: string, metric: string, value: number) {
    this.record({
      name: `pilot_${metric}`,
      value,
      unit: 'gauge',
      tags: { dealerId }
    });

    logBusinessMetric(`pilot_${metric}`, value, { dealerId });
  }

  recordIntegrationUsage(
    dealerId: string,
    integration: 'autotrader' | 'carscom' | 'facebook' | 'instagram' | 'gmb',
    action: string,
    success: boolean
  ) {
    this.record({
      name: 'integration_usage',
      value: 1,
      unit: 'count',
      tags: { dealerId, integration, action, success: success.toString() }
    });
  }

  recordAPIEndpoint(
    endpoint: string,
    method: string,
    statusCode: number,
    responseTime: number,
    userId?: string,
    dealerId?: string
  ) {
    this.record({
      name: 'api_request_total',
      value: 1,
      unit: 'count',
      tags: { endpoint, method, status: statusCode.toString() }
    });

    this.record({
      name: 'api_request_duration',
      value: responseTime,
      unit: 'timer',
      tags: { endpoint, method }
    });

    // Track errors separately
    if (statusCode >= 400) {
      this.record({
        name: 'api_error_total',
        value: 1,
        unit: 'count',
        tags: { endpoint, method, status: statusCode.toString() }
      });
    }
  }

  recordDashboardView(userId: string, dealerId: string, component: string) {
    this.record({
      name: 'dashboard_view',
      value: 1,
      unit: 'count',
      tags: { userId, dealerId, component }
    });
  }

  recordAnalyticsGeneration(dealerId: string, type: string, duration: number) {
    this.record({
      name: 'analytics_generation',
      value: 1,
      unit: 'count',
      tags: { dealerId, type }
    });

    this.record({
      name: 'analytics_generation_time',
      value: duration,
      unit: 'timer',
      tags: { dealerId, type }
    });
  }

  recordPredictionAccuracy(dealerId: string, predictionType: string, accuracy: number) {
    this.record({
      name: 'prediction_accuracy',
      value: accuracy,
      unit: 'gauge',
      tags: { dealerId, predictionType }
    });

    logBusinessMetric('prediction_accuracy', accuracy, { dealerId, predictionType });
  }

  // System health metrics
  recordDatabaseQuery(operation: string, table: string, duration: number, success: boolean) {
    this.record({
      name: 'db_query_total',
      value: 1,
      unit: 'count',
      tags: { operation, table, success: success.toString() }
    });

    this.record({
      name: 'db_query_duration',
      value: duration,
      unit: 'timer',
      tags: { operation, table }
    });
  }

  recordCacheHit(key: string, hit: boolean) {
    this.record({
      name: 'cache_access',
      value: 1,
      unit: 'count',
      tags: { key, hit: hit.toString() }
    });
  }

  recordMemoryUsage() {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const memory = process.memoryUsage();

      this.record({
        name: 'memory_heap_used',
        value: memory.heapUsed,
        unit: 'gauge',
      });

      this.record({
        name: 'memory_heap_total',
        value: memory.heapTotal,
        unit: 'gauge',
      });

      this.record({
        name: 'memory_external',
        value: memory.external,
        unit: 'gauge',
      });
    }
  }

  // Private methods
  private record(metric: MetricData) {
    metric.timestamp = metric.timestamp || new Date();
    this.metricsBuffer.push(metric);

    // If buffer is getting too large, flush immediately
    if (this.metricsBuffer.length > 1000) {
      this.flush();
    }
  }

  private async flush() {
    if (this.metricsBuffer.length === 0) {
      return;
    }

    const metrics = [...this.metricsBuffer];
    this.metricsBuffer = [];

    try {
      // Send to DataDog if configured
      if (process.env.DATADOG_API_KEY) {
        await this.sendToDataDog(metrics);
      }

      // Log metrics for debugging
      if (process.env.NODE_ENV === 'development') {
        logger.debug({
          metricsCount: metrics.length,
          metrics: metrics.slice(0, 5), // Log first 5 for debugging
        }, 'Flushed metrics');
      }
    } catch (error) {
      logger.error({ error }, 'Failed to flush metrics');
      // Re-add metrics to buffer for retry
      this.metricsBuffer.unshift(...metrics);
    }
  }

  private async sendToDataDog(metrics: MetricData[]) {
    if (!process.env.DATADOG_API_KEY) {
      return;
    }

    const datadogMetrics = metrics.map(metric => ({
      metric: `dealershipai.${metric.name}`,
      points: [[Math.floor(metric.timestamp!.getTime() / 1000), metric.value]],
      type: metric.unit === 'count' ? 'count' : 'gauge',
      tags: metric.tags ? Object.entries(metric.tags).map(([k, v]) => `${k}:${v}`) : [],
    }));

    const response = await fetch('https://api.datadoghq.com/api/v1/series', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'DD-API-KEY': process.env.DATADOG_API_KEY,
      },
      body: JSON.stringify({ series: datadogMetrics }),
    });

    if (!response.ok) {
      throw new Error(`DataDog API error: ${response.status}`);
    }
  }

  // Cleanup
  destroy() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    this.flush(); // Final flush
  }
}

// Singleton instance
export const metrics = DealershipAIMetrics.getInstance();

// Utility functions for common patterns
export const withMetrics = <T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  metricName: string,
  getTags?: (...args: T) => Record<string, string>
) => {
  return async (...args: T): Promise<R> => {
    const start = Date.now();
    const tags = getTags ? getTags(...args) : {};

    try {
      const result = await fn(...args);
      const duration = Date.now() - start;

      metrics.record({
        name: metricName,
        value: 1,
        unit: 'count',
        tags: { ...tags, success: 'true' }
      });

      metrics.record({
        name: `${metricName}_duration`,
        value: duration,
        unit: 'timer',
        tags
      });

      return result;
    } catch (error) {
      const duration = Date.now() - start;

      metrics.record({
        name: metricName,
        value: 1,
        unit: 'count',
        tags: { ...tags, success: 'false' }
      });

      metrics.record({
        name: `${metricName}_duration`,
        value: duration,
        unit: 'timer',
        tags: { ...tags, error: 'true' }
      });

      throw error;
    }
  };
};

// Graceful shutdown
process.on('SIGTERM', () => {
  metrics.destroy();
});

process.on('SIGINT', () => {
  metrics.destroy();
});

export default metrics;