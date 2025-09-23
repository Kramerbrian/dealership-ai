// AI cost tracking and management
import { logger } from './logger';
import { cache } from './cache';

export interface CostEntry {
  timestamp: Date;
  provider: 'openai' | 'anthropic' | 'google';
  model: string;
  operation: 'completion' | 'embedding' | 'image' | 'audio';
  inputTokens: number;
  outputTokens: number;
  cost: number;
  userId?: string;
  dealerId?: string;
  batchId?: string;
}

export interface CostSummary {
  totalCost: number;
  totalTokens: number;
  operationCounts: Record<string, number>;
  providerBreakdown: Record<string, { cost: number; tokens: number }>;
  period: string;
}

export interface CostLimits {
  daily: number;
  weekly: number;
  monthly: number;
  perUser?: number;
  perDealer?: number;
}

// Model pricing (per 1K tokens)
const MODEL_PRICING = {
  'gpt-4o': { input: 0.005, output: 0.015 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'gpt-3.5-turbo': { input: 0.0015, output: 0.002 },
  'claude-3-5-sonnet': { input: 0.003, output: 0.015 },
  'claude-3-opus': { input: 0.015, output: 0.075 },
  'claude-3-haiku': { input: 0.00025, output: 0.00125 },
  'gemini-pro': { input: 0.000125, output: 0.000375 },
  'gemini-flash': { input: 0.000075, output: 0.0003 },
} as const;

class CostTracker {
  private costs: CostEntry[] = [];
  private limits: CostLimits;

  constructor(limits?: Partial<CostLimits>) {
    this.limits = {
      daily: parseFloat(process.env.MAX_DAILY_SPEND || '100'),
      weekly: parseFloat(process.env.MAX_WEEKLY_SPEND || '500'),
      monthly: parseFloat(process.env.MAX_MONTHLY_SPEND || '1000'),
      perUser: parseFloat(process.env.MAX_PER_USER_SPEND || '50'),
      perDealer: parseFloat(process.env.MAX_PER_DEALER_SPEND || '200'),
      ...limits,
    };
  }

  calculateCost(
    provider: CostEntry['provider'],
    model: string,
    inputTokens: number,
    outputTokens: number
  ): number {
    const pricing = MODEL_PRICING[model as keyof typeof MODEL_PRICING];
    if (!pricing) {
      logger.warn('Unknown model pricing', { provider, model });
      return 0;
    }

    return (inputTokens / 1000 * pricing.input) + (outputTokens / 1000 * pricing.output);
  }

  async recordCost(entry: Omit<CostEntry, 'timestamp' | 'cost'> & { cost?: number }): Promise<void> {
    const cost = entry.cost || this.calculateCost(
      entry.provider,
      entry.model,
      entry.inputTokens,
      entry.outputTokens
    );

    const costEntry: CostEntry = {
      ...entry,
      cost,
      timestamp: new Date(),
    };

    this.costs.push(costEntry);

    // Store in cache for persistence
    const key = cache.key('costs', new Date().toISOString().split('T')[0]);
    const dailyCosts = await cache.get<CostEntry[]>(key) || [];
    dailyCosts.push(costEntry);
    await cache.set(key, dailyCosts, 24 * 60 * 60); // 24 hours

    logger.info('Cost recorded', {
      provider: entry.provider,
      model: entry.model,
      cost,
      inputTokens: entry.inputTokens,
      outputTokens: entry.outputTokens,
    });

    // Check limits after recording
    await this.checkLimits(costEntry);
  }

  async checkLimits(entry: CostEntry): Promise<void> {
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    // Daily limit check
    const dailyCosts = await this.getCostSummary('daily', today);
    if (dailyCosts.totalCost > this.limits.daily) {
      logger.warn('Daily cost limit exceeded', {
        current: dailyCosts.totalCost,
        limit: this.limits.daily,
      });
    }

    // Per-user limit check
    if (entry.userId && this.limits.perUser) {
      const userCosts = await this.getUserCosts(entry.userId, 'daily', today);
      if (userCosts > this.limits.perUser) {
        logger.warn('User daily cost limit exceeded', {
          userId: entry.userId,
          current: userCosts,
          limit: this.limits.perUser,
        });
      }
    }

    // Per-dealer limit check
    if (entry.dealerId && this.limits.perDealer) {
      const dealerCosts = await this.getDealerCosts(entry.dealerId, 'daily', today);
      if (dealerCosts > this.limits.perDealer) {
        logger.warn('Dealer daily cost limit exceeded', {
          dealerId: entry.dealerId,
          current: dealerCosts,
          limit: this.limits.perDealer,
        });
      }
    }
  }

  async getCostSummary(
    period: 'daily' | 'weekly' | 'monthly',
    date?: string
  ): Promise<CostSummary> {
    const key = cache.key('cost-summary', period, date || new Date().toISOString().split('T')[0]);
    const cached = await cache.get<CostSummary>(key);
    if (cached) return cached;

    const costs = await this.getCostsForPeriod(period, date);

    const summary: CostSummary = {
      totalCost: costs.reduce((sum, entry) => sum + entry.cost, 0),
      totalTokens: costs.reduce((sum, entry) => sum + entry.inputTokens + entry.outputTokens, 0),
      operationCounts: {},
      providerBreakdown: {},
      period: `${period}-${date || new Date().toISOString().split('T')[0]}`,
    };

    // Calculate operation counts
    for (const entry of costs) {
      summary.operationCounts[entry.operation] = (summary.operationCounts[entry.operation] || 0) + 1;
    }

    // Calculate provider breakdown
    for (const entry of costs) {
      if (!summary.providerBreakdown[entry.provider]) {
        summary.providerBreakdown[entry.provider] = { cost: 0, tokens: 0 };
      }
      summary.providerBreakdown[entry.provider].cost += entry.cost;
      summary.providerBreakdown[entry.provider].tokens += entry.inputTokens + entry.outputTokens;
    }

    // Cache for 1 hour
    await cache.set(key, summary, 60 * 60);
    return summary;
  }

  async getUserCosts(userId: string, period: 'daily' | 'weekly' | 'monthly', date?: string): Promise<number> {
    const costs = await this.getCostsForPeriod(period, date);
    return costs
      .filter(entry => entry.userId === userId)
      .reduce((sum, entry) => sum + entry.cost, 0);
  }

  async getDealerCosts(dealerId: string, period: 'daily' | 'weekly' | 'monthly', date?: string): Promise<number> {
    const costs = await this.getCostsForPeriod(period, date);
    return costs
      .filter(entry => entry.dealerId === dealerId)
      .reduce((sum, entry) => sum + entry.cost, 0);
  }

  private async getCostsForPeriod(
    period: 'daily' | 'weekly' | 'monthly',
    date?: string
  ): Promise<CostEntry[]> {
    const targetDate = date ? new Date(date) : new Date();
    const costs: CostEntry[] = [];

    if (period === 'daily') {
      const key = cache.key('costs', targetDate.toISOString().split('T')[0]);
      const dailyCosts = await cache.get<CostEntry[]>(key) || [];
      costs.push(...dailyCosts);
    } else if (period === 'weekly') {
      // Get costs for the last 7 days
      for (let i = 0; i < 7; i++) {
        const date = new Date(targetDate);
        date.setDate(date.getDate() - i);
        const key = cache.key('costs', date.toISOString().split('T')[0]);
        const dailyCosts = await cache.get<CostEntry[]>(key) || [];
        costs.push(...dailyCosts);
      }
    } else if (period === 'monthly') {
      // Get costs for the last 30 days
      for (let i = 0; i < 30; i++) {
        const date = new Date(targetDate);
        date.setDate(date.getDate() - i);
        const key = cache.key('costs', date.toISOString().split('T')[0]);
        const dailyCosts = await cache.get<CostEntry[]>(key) || [];
        costs.push(...dailyCosts);
      }
    }

    return costs;
  }

  async canProceed(
    provider: CostEntry['provider'],
    model: string,
    inputTokens: number,
    outputTokens: number,
    userId?: string,
    dealerId?: string
  ): Promise<{ allowed: boolean; reason?: string; currentCost?: number; limit?: number }> {
    const estimatedCost = this.calculateCost(provider, model, inputTokens, outputTokens);
    const today = new Date().toISOString().split('T')[0];

    // Check daily limit
    const dailyCosts = await this.getCostSummary('daily', today);
    if (dailyCosts.totalCost + estimatedCost > this.limits.daily) {
      return {
        allowed: false,
        reason: 'Daily cost limit would be exceeded',
        currentCost: dailyCosts.totalCost,
        limit: this.limits.daily,
      };
    }

    // Check user limit
    if (userId && this.limits.perUser) {
      const userCosts = await this.getUserCosts(userId, 'daily', today);
      if (userCosts + estimatedCost > this.limits.perUser) {
        return {
          allowed: false,
          reason: 'User daily cost limit would be exceeded',
          currentCost: userCosts,
          limit: this.limits.perUser,
        };
      }
    }

    // Check dealer limit
    if (dealerId && this.limits.perDealer) {
      const dealerCosts = await this.getDealerCosts(dealerId, 'daily', today);
      if (dealerCosts + estimatedCost > this.limits.perDealer) {
        return {
          allowed: false,
          reason: 'Dealer daily cost limit would be exceeded',
          currentCost: dealerCosts,
          limit: this.limits.perDealer,
        };
      }
    }

    return { allowed: true };
  }

  async getTopSpenders(period: 'daily' | 'weekly' | 'monthly', limit = 10): Promise<Array<{
    id: string;
    type: 'user' | 'dealer';
    cost: number;
    operations: number;
  }>> {
    const costs = await this.getCostsForPeriod(period);
    const spenders = new Map<string, { cost: number; operations: number; type: 'user' | 'dealer' }>();

    for (const entry of costs) {
      if (entry.userId) {
        const key = `user:${entry.userId}`;
        const current = spenders.get(key) || { cost: 0, operations: 0, type: 'user' as const };
        spenders.set(key, {
          cost: current.cost + entry.cost,
          operations: current.operations + 1,
          type: 'user',
        });
      }

      if (entry.dealerId) {
        const key = `dealer:${entry.dealerId}`;
        const current = spenders.get(key) || { cost: 0, operations: 0, type: 'dealer' as const };
        spenders.set(key, {
          cost: current.cost + entry.cost,
          operations: current.operations + 1,
          type: 'dealer',
        });
      }
    }

    return Array.from(spenders.entries())
      .map(([id, data]) => ({ id: id.split(':')[1], ...data }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, limit);
  }
}

export const costTracker = new CostTracker();
export default costTracker;