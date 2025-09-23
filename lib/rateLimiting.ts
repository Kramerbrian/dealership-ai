import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface DealerTier {
  tier: 1 | 2 | 3 | 4;
  name: string;
  monthlyPrice: number;
  limits: {
    // Core AI Assistant Limits
    halMessages: {
      perHour: number;
      perDay: number;
      perMonth: number;
    };

    // Agent Task Limits
    agentTasks: {
      perHour: number;
      perDay: number;
      perMonth: number;
    };

    // Feature-Specific Limits
    features: {
      searchQueries: number;        // Web search integration
      voiceMinutes: number;         // Voice input per month
      ugcScans: number;            // UGC monitoring scans per day
      schemaAudits: number;        // Schema audits per month
      exportReports: number;       // Data exports per month
      realTimeMonitoring: boolean; // Live UGC/competitive monitoring
      apiAccess: boolean;          // Direct API access
      whiteLabel: boolean;         // Custom branding
      multiLocation: number;       // Number of dealership locations
    };

    // Resource Limits
    resources: {
      storageGB: number;           // Data storage
      bandwidthGB: number;         // Monthly data transfer
      concurrentUsers: number;     // Simultaneous dashboard users
      retentionDays: number;       // Data retention period
    };
  };

  // What happens when limits are exceeded
  overagePolicy: {
    gracePeriod: number;          // Minutes before hard cutoff
    overage: {
      halMessages: number;        // Cost per message over limit
      agentTasks: number;         // Cost per task over limit
      searchQueries: number;      // Cost per search over limit
    };
  };
}

// Tier Configurations
export const DEALER_TIERS: Record<1 | 2 | 3 | 4, DealerTier> = {
  1: {
    tier: 1,
    name: "Starter",
    monthlyPrice: 99,
    limits: {
      halMessages: {
        perHour: 50,
        perDay: 500,
        perMonth: 10000
      },
      agentTasks: {
        perHour: 20,
        perDay: 200,
        perMonth: 4000
      },
      features: {
        searchQueries: 100,
        voiceMinutes: 30,
        ugcScans: 5,
        schemaAudits: 2,
        exportReports: 10,
        realTimeMonitoring: false,
        apiAccess: false,
        whiteLabel: false,
        multiLocation: 1
      },
      resources: {
        storageGB: 10,
        bandwidthGB: 50,
        concurrentUsers: 3,
        retentionDays: 30
      }
    },
    overagePolicy: {
      gracePeriod: 5,
      overage: {
        halMessages: 0.05,
        agentTasks: 0.10,
        searchQueries: 0.02
      }
    }
  },

  2: {
    tier: 2,
    name: "Professional",
    monthlyPrice: 299,
    limits: {
      halMessages: {
        perHour: 200,
        perDay: 2000,
        perMonth: 40000
      },
      agentTasks: {
        perHour: 100,
        perDay: 1000,
        perMonth: 20000
      },
      features: {
        searchQueries: 500,
        voiceMinutes: 120,
        ugcScans: 20,
        schemaAudits: 10,
        exportReports: 50,
        realTimeMonitoring: true,
        apiAccess: false,
        whiteLabel: false,
        multiLocation: 3
      },
      resources: {
        storageGB: 50,
        bandwidthGB: 200,
        concurrentUsers: 10,
        retentionDays: 90
      }
    },
    overagePolicy: {
      gracePeriod: 10,
      overage: {
        halMessages: 0.04,
        agentTasks: 0.08,
        searchQueries: 0.015
      }
    }
  },

  3: {
    tier: 3,
    name: "Enterprise",
    monthlyPrice: 699,
    limits: {
      halMessages: {
        perHour: 500,
        perDay: 5000,
        perMonth: 100000
      },
      agentTasks: {
        perHour: 300,
        perDay: 3000,
        perMonth: 60000
      },
      features: {
        searchQueries: 2000,
        voiceMinutes: 500,
        ugcScans: 100,
        schemaAudits: 50,
        exportReports: 200,
        realTimeMonitoring: true,
        apiAccess: true,
        whiteLabel: true,
        multiLocation: 10
      },
      resources: {
        storageGB: 200,
        bandwidthGB: 1000,
        concurrentUsers: 25,
        retentionDays: 365
      }
    },
    overagePolicy: {
      gracePeriod: 15,
      overage: {
        halMessages: 0.03,
        agentTasks: 0.06,
        searchQueries: 0.01
      }
    }
  },

  4: {
    tier: 4,
    name: "Enterprise Plus",
    monthlyPrice: 1499,
    limits: {
      halMessages: {
        perHour: 2000,
        perDay: 20000,
        perMonth: 500000
      },
      agentTasks: {
        perHour: 1000,
        perDay: 10000,
        perMonth: 200000
      },
      features: {
        searchQueries: 10000,
        voiceMinutes: 2000,
        ugcScans: 500,
        schemaAudits: 200,
        exportReports: 1000,
        realTimeMonitoring: true,
        apiAccess: true,
        whiteLabel: true,
        multiLocation: 50
      },
      resources: {
        storageGB: 1000,
        bandwidthGB: 5000,
        concurrentUsers: 100,
        retentionDays: 1095 // 3 years
      }
    },
    overagePolicy: {
      gracePeriod: 30,
      overage: {
        halMessages: 0.02,
        agentTasks: 0.04,
        searchQueries: 0.008
      }
    }
  }
};

// Rate Limiting Implementation
export class RateLimiter {
  private dealerId: string;
  private tier: DealerTier;

  constructor(dealerId: string, tier: 1 | 2 | 3 | 4) {
    this.dealerId = dealerId;
    this.tier = DEALER_TIERS[tier];
  }

  async checkLimit(
    action: 'halMessages' | 'agentTasks' | 'searchQueries' | 'ugcScans' | 'schemaAudits' | 'exportReports',
    window: 'hour' | 'day' | 'month' = 'hour'
  ): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: Date;
    inGracePeriod?: boolean;
  }> {
    const now = new Date();
    const windowStart = this.getWindowStart(window, now);

    // Get current usage from Supabase
    const { data: usage, error } = await supabase
      .from('rate_limit_usage')
      .select('count')
      .eq('dealer_id', this.dealerId)
      .eq('action', action)
      .eq('window', window)
      .gte('created_at', windowStart.toISOString())
      .single();

    if (error && error.code !== 'PGRST116') { // Not found is OK
      console.error('Rate limit check error:', error);
      return { allowed: false, remaining: 0, resetTime: this.getWindowEnd(window, now) };
    }

    const currentCount = usage?.count || 0;
    const limit = this.getLimit(action, window);
    const remaining = Math.max(0, limit - currentCount);
    const resetTime = this.getWindowEnd(window, now);

    // Check if within normal limits
    if (currentCount < limit) {
      return { allowed: true, remaining, resetTime };
    }

    // Check grace period for overages
    const graceLimit = limit + Math.floor(limit * 0.1); // 10% grace
    const inGracePeriod = currentCount < graceLimit;

    return {
      allowed: inGracePeriod,
      remaining: inGracePeriod ? graceLimit - currentCount : 0,
      resetTime,
      inGracePeriod
    };
  }

  async recordUsage(
    action: 'halMessages' | 'agentTasks' | 'searchQueries' | 'ugcScans' | 'schemaAudits' | 'exportReports',
    window: 'hour' | 'day' | 'month' = 'hour',
    cost?: number
  ): Promise<void> {
    const now = new Date();
    const windowStart = this.getWindowStart(window, now);

    // Update or insert usage record
    await supabase
      .from('rate_limit_usage')
      .upsert({
        dealer_id: this.dealerId,
        action,
        window,
        window_start: windowStart.toISOString(),
        count: 1,
        cost: cost || 0,
        updated_at: now.toISOString()
      }, {
        onConflict: 'dealer_id,action,window,window_start',
        ignoreDuplicates: false
      });

    // Also log individual usage for billing
    await supabase
      .from('usage_log')
      .insert({
        dealer_id: this.dealerId,
        action,
        cost: cost || 0,
        tier: this.tier.tier,
        created_at: now.toISOString()
      });
  }

  private getLimit(action: string, window: string): number {
    switch (action) {
      case 'halMessages':
        return this.tier.limits.halMessages[window as keyof typeof this.tier.limits.halMessages];
      case 'agentTasks':
        return this.tier.limits.agentTasks[window as keyof typeof this.tier.limits.agentTasks];
      case 'searchQueries':
        return window === 'month' ? this.tier.limits.features.searchQueries : Math.floor(this.tier.limits.features.searchQueries / 30);
      case 'ugcScans':
        return window === 'day' ? this.tier.limits.features.ugcScans : Math.floor(this.tier.limits.features.ugcScans * 30);
      case 'schemaAudits':
        return window === 'month' ? this.tier.limits.features.schemaAudits : Math.floor(this.tier.limits.features.schemaAudits / 30);
      case 'exportReports':
        return window === 'month' ? this.tier.limits.features.exportReports : Math.floor(this.tier.limits.features.exportReports / 30);
      default:
        return 0;
    }
  }

  private getWindowStart(window: string, now: Date): Date {
    const start = new Date(now);
    switch (window) {
      case 'hour':
        start.setMinutes(0, 0, 0);
        break;
      case 'day':
        start.setHours(0, 0, 0, 0);
        break;
      case 'month':
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        break;
    }
    return start;
  }

  private getWindowEnd(window: string, now: Date): Date {
    const end = new Date(now);
    switch (window) {
      case 'hour':
        end.setHours(end.getHours() + 1, 0, 0, 0);
        break;
      case 'day':
        end.setDate(end.getDate() + 1);
        end.setHours(0, 0, 0, 0);
        break;
      case 'month':
        end.setMonth(end.getMonth() + 1, 1);
        end.setHours(0, 0, 0, 0);
        break;
    }
    return end;
  }

  // Get tier information
  getTierInfo(): DealerTier {
    return this.tier;
  }

  // Check if feature is available
  hasFeature(feature: keyof DealerTier['limits']['features']): boolean {
    const featureValue = this.tier.limits.features[feature];
    return typeof featureValue === 'boolean' ? featureValue : featureValue > 0;
  }

  // Get upgrade recommendations
  getUpgradeRecommendations(): { nextTier: DealerTier; benefits: string[] } | null {
    if (this.tier.tier >= 4) return null;

    const nextTier = DEALER_TIERS[(this.tier.tier + 1) as 1 | 2 | 3 | 4];
    const benefits = [];

    // Compare limits and features
    if (nextTier.limits.halMessages.perMonth > this.tier.limits.halMessages.perMonth) {
      const increase = Math.round((nextTier.limits.halMessages.perMonth / this.tier.limits.halMessages.perMonth - 1) * 100);
      benefits.push(`${increase}% more Hal messages (${nextTier.limits.halMessages.perMonth.toLocaleString()}/month)`);
    }

    if (nextTier.limits.features.searchQueries > this.tier.limits.features.searchQueries) {
      benefits.push(`${nextTier.limits.features.searchQueries} search queries (vs ${this.tier.limits.features.searchQueries})`);
    }

    if (!this.tier.limits.features.realTimeMonitoring && nextTier.limits.features.realTimeMonitoring) {
      benefits.push('Real-time UGC monitoring');
    }

    if (!this.tier.limits.features.apiAccess && nextTier.limits.features.apiAccess) {
      benefits.push('Direct API access');
    }

    if (!this.tier.limits.features.whiteLabel && nextTier.limits.features.whiteLabel) {
      benefits.push('White-label branding');
    }

    return { nextTier, benefits };
  }
}

// Middleware for API endpoints
export async function withRateLimit(
  req: any,
  res: any,
  dealerId: string,
  tier: 1 | 2 | 3 | 4,
  action: 'halMessages' | 'agentTasks' | 'searchQueries' | 'ugcScans' | 'schemaAudits' | 'exportReports'
) {
  const rateLimiter = new RateLimiter(dealerId, tier);
  const check = await rateLimiter.checkLimit(action);

  if (!check.allowed) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      tier,
      remaining: check.remaining,
      resetTime: check.resetTime,
      upgradeRecommendation: rateLimiter.getUpgradeRecommendations()
    });
  }

  // Record usage
  await rateLimiter.recordUsage(action);

  // Add rate limit headers
  res.setHeader('X-RateLimit-Limit', rateLimiter.getLimit(action, 'hour'));
  res.setHeader('X-RateLimit-Remaining', check.remaining);
  res.setHeader('X-RateLimit-Reset', check.resetTime.getTime());
  res.setHeader('X-RateLimit-Tier', tier);

  return true;
}

// Supabase table schemas (run in SQL editor)
export const RATE_LIMIT_TABLES = `
-- Rate limit tracking
CREATE TABLE rate_limit_usage (
  id SERIAL PRIMARY KEY,
  dealer_id TEXT NOT NULL,
  action TEXT NOT NULL,
  window TEXT NOT NULL, -- 'hour', 'day', 'month'
  window_start TIMESTAMPTZ NOT NULL,
  count INTEGER DEFAULT 1,
  cost DECIMAL(10,6) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(dealer_id, action, window, window_start)
);

-- Usage logging for billing
CREATE TABLE usage_log (
  id SERIAL PRIMARY KEY,
  dealer_id TEXT NOT NULL,
  action TEXT NOT NULL,
  cost DECIMAL(10,6) DEFAULT 0,
  tier INTEGER NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dealer tier assignments
CREATE TABLE dealer_tiers (
  dealer_id TEXT PRIMARY KEY,
  tier INTEGER NOT NULL CHECK (tier >= 1 AND tier <= 4),
  subscription_start TIMESTAMPTZ DEFAULT NOW(),
  subscription_end TIMESTAMPTZ,
  auto_renew BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_rate_limit_dealer_action ON rate_limit_usage(dealer_id, action);
CREATE INDEX idx_rate_limit_window ON rate_limit_usage(window_start);
CREATE INDEX idx_usage_log_dealer_date ON usage_log(dealer_id, created_at);
CREATE INDEX idx_dealer_tiers_tier ON dealer_tiers(tier);
`;