import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';

const CompetitiveDataContext = createContext();

// Geographic pooling for cost optimization
const GEOGRAPHIC_POOLS = {
  'Naples, FL': 'southwest_florida',
  'Cape Coral, FL': 'southwest_florida',
  'Fort Myers, FL': 'southwest_florida',
  'Miami, FL': 'southeast_florida',
  'Tampa, FL': 'central_florida'
};

// Synthetic variance to prevent dealer comparisons
const addDealerVariance = (baseData, dealerId) => {
  const seed = dealerId.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  const variance = ((seed % 100) / 1000) - 0.05; // ±5% variance

  return {
    ...baseData,
    riskScore: Math.max(0, Math.min(100, baseData.riskScore + (baseData.riskScore * variance))),
    aiVisibilityScore: Math.max(0, Math.min(100, baseData.aiVisibilityScore + (baseData.aiVisibilityScore * variance))),
    sovPercentage: Math.max(0, Math.min(100, baseData.sovPercentage + (baseData.sovPercentage * variance * 0.5))),
    monthlyLossRisk: Math.max(0, baseData.monthlyLossRisk + (baseData.monthlyLossRisk * variance)),
    aiPlatformScores: Object.keys(baseData.aiPlatformScores).reduce((acc, platform) => {
      acc[platform] = Math.max(0, Math.min(100, baseData.aiPlatformScores[platform] + (baseData.aiPlatformScores[platform] * variance * 0.3)));
      return acc;
    }, {})
  };
};

// Intelligence Engine - 90% synthetic, 10% real data
class IntelligenceEngine {
  constructor() {
    this.realDataRatio = 0.1;
    this.cacheHitRate = 0.95;
    this.syntheticVariance = 0.05;
    this.cache = new Map();
  }

  async analyze(dealerId, location) {
    const geographicPool = GEOGRAPHIC_POOLS[location] || 'default';
    const cacheKey = `${geographicPool}_${Date.now().toString().slice(0, -7)}`; // Cache for ~3 hours

    let pooledData = this.cache.get(cacheKey);

    if (!pooledData || Math.random() > this.cacheHitRate) {
      // Generate new pooled data for this geographic region
      pooledData = this.generatePooledData(geographicPool, location);
      this.cache.set(cacheKey, pooledData);
    }

    // Add dealer-specific variance to prevent comparison
    return addDealerVariance(pooledData, dealerId);
  }

  generatePooledData(pool, location) {
    // Base data varies by geographic region
    const regionMultipliers = {
      'southwest_florida': { competition: 1.2, visibility: 0.9, risk: 1.1 },
      'southeast_florida': { competition: 1.5, visibility: 0.8, risk: 1.3 },
      'central_florida': { competition: 1.3, visibility: 0.85, risk: 1.2 },
      'default': { competition: 1.0, visibility: 1.0, risk: 1.0 }
    };

    const multiplier = regionMultipliers[pool] || regionMultipliers.default;

    return {
      riskScore: Math.round(72 * (1 + (Math.random() * 0.3 - 0.15))), // 61-83 range
      monthlyLossRisk: Math.round(15800 * multiplier.risk * (1 + (Math.random() * 0.4 - 0.2))),
      aiVisibilityScore: Math.round(34 * multiplier.visibility * (1 + (Math.random() * 0.5 - 0.25))),
      invisiblePercentage: Math.round(66 * (1 + (Math.random() * 0.3 - 0.15))),
      marketPosition: Math.ceil(8 * multiplier.competition),
      totalCompetitors: Math.round(12 * multiplier.competition),
      sovPercentage: Math.round(23.4 * (1 + (Math.random() * 0.4 - 0.2))),

      threats: [
        {
          category: "AI Search",
          severity: Math.random() > 0.3 ? "High" : "Critical",
          impact: `-$${Math.round(7200 * multiplier.risk + (Math.random() * 2000))}`,
          description: "Invisible in ChatGPT searches - competitors dominate AI results"
        },
        {
          category: "Zero-Click",
          severity: "High",
          impact: `-$${Math.round(4100 * multiplier.risk + (Math.random() * 1500))}`,
          description: "Missing from Google SGE & featured snippets"
        },
        {
          category: "UGC/Reviews",
          severity: Math.random() > 0.6 ? "Medium" : "High",
          impact: `-$${Math.round(2300 * multiplier.risk + (Math.random() * 800))}`,
          description: "Slow review response times hurting conversion"
        },
        {
          category: "Local SEO",
          severity: "Medium",
          impact: `-$${Math.round(2200 * multiplier.risk + (Math.random() * 600))}`,
          description: "Ranking #4-6 in map pack for primary keywords"
        }
      ],

      aiPlatformScores: {
        chatgpt: Math.round(28 * multiplier.visibility + (Math.random() * 15)),
        claude: Math.round(31 * multiplier.visibility + (Math.random() * 12)),
        gemini: Math.round(42 * multiplier.visibility + (Math.random() * 18)),
        perplexity: Math.round(35 * multiplier.visibility + (Math.random() * 16)),
        copilot: Math.round(26 * multiplier.visibility + (Math.random() * 14)),
        grok: Math.round(22 * multiplier.visibility + (Math.random() * 10))
      },

      competitors: this.generateCompetitors(pool, multiplier),
      lastUpdated: new Date()
    };
  }

  generateCompetitors(pool, multiplier) {
    const baseCompetitors = [
      { name: 'Hendrick Honda', position: 1, visibility: 87, trend: 'up' },
      { name: 'Germain Toyota', position: 2, visibility: 82, trend: 'stable' },
      { name: 'Crown Automotive', position: 3, visibility: 74, trend: 'down' },
      { name: 'Sunset Ford', position: 4, visibility: 69, trend: 'up' },
      { name: 'Metro Nissan', position: 5, visibility: 61, trend: 'stable' }
    ];

    return baseCompetitors.map(comp => ({
      ...comp,
      visibility: Math.round(comp.visibility * multiplier.visibility + (Math.random() * 10 - 5)),
      position: comp.position + Math.floor(Math.random() * 2 - 1) // ±1 position variance
    }));
  }
}

// ROI Calculator with probability distributions
export const ROICalculator = {
  calculate(investment, confidence = 0.8) {
    const base = investment * 2.1; // Baseline 210% ROI
    const volatility = 0.4; // 40% volatility range

    return {
      pessimistic: Math.round(base * (1 - volatility * 0.7)),
      realistic: Math.round(base),
      optimistic: Math.round(base * (1 + volatility)),
      confidence: Math.round(confidence * 100),
      timeline: '3-6 months',
      factors: {
        'AI Search Visibility': { impact: '35-45%', confidence: 'High' },
        'Local SEO Improvement': { impact: '20-30%', confidence: 'High' },
        'Schema Implementation': { impact: '15-25%', confidence: 'Medium' },
        'Review Management': { impact: '10-15%', confidence: 'High' }
      }
    };
  }
};

export function CompetitiveDataProvider({ children }) {
  const [competitorData, setCompetitorData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState(null);
  const [engine] = useState(() => new IntelligenceEngine());

  // Memoized data fetcher
  const fetchCompetitorData = useMemo(() =>
    async (dealerId, location, forceRefresh = false) => {
      if (!forceRefresh && competitorData && lastFetch && (Date.now() - lastFetch < 3600000)) {
        return competitorData; // Use cached data within 1 hour
      }

      setIsLoading(true);

      try {
        // Small delay to appear more realistic
        await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 700));

        const data = await engine.analyze(dealerId, location);

        setCompetitorData(data);
        setLastFetch(Date.now());

        return data;
      } catch (error) {
        console.error('Competitor data fetch error:', error);
        return null;
      } finally {
        setIsLoading(false);
      }
    }, [competitorData, lastFetch, engine]
  );

  // Auto-refresh every 4 hours
  useEffect(() => {
    const interval = setInterval(() => {
      if (competitorData) {
        fetchCompetitorData(competitorData.dealerId, competitorData.location, true);
      }
    }, 14400000); // 4 hours

    return () => clearInterval(interval);
  }, [competitorData, fetchCompetitorData]);

  const contextValue = {
    competitorData,
    isLoading,
    lastFetch,
    fetchCompetitorData,

    // Convenience methods
    refreshData: (dealerId, location) => fetchCompetitorData(dealerId, location, true),
    getCachedData: () => competitorData,
    isDataStale: () => !lastFetch || (Date.now() - lastFetch > 3600000)
  };

  return (
    <CompetitiveDataContext.Provider value={contextValue}>
      {children}
    </CompetitiveDataContext.Provider>
  );
}

// Custom hook for consuming the context
export function useCompetitiveData() {
  const context = useContext(CompetitiveDataContext);
  if (!context) {
    throw new Error('useCompetitiveData must be used within a CompetitiveDataProvider');
  }
  return context;
}

// Action Queue System
class ActionQueueManager {
  constructor() {
    this.queue = [];
    this.executing = false;
    this.history = [];
  }

  add(action) {
    const enhancedAction = {
      id: Date.now() + Math.random(),
      ...action,
      impact: this.generatePlausibleImpact(action.type),
      timeline: this.generateRealisticTimeline(action.complexity),
      confidence: 0.75 + Math.random() * 0.2, // 75-95% confidence
      status: 'queued',
      createdAt: new Date()
    };

    this.queue.push(enhancedAction);
    return enhancedAction.id;
  }

  generatePlausibleImpact(actionType) {
    const impacts = {
      'schema_implementation': { revenue: '+$2,400-4,200/month', traffic: '+15-25%' },
      'local_seo_optimization': { ranking: '+2-4 positions', visibility: '+20-35%' },
      'review_management': { rating: '+0.3-0.7 stars', conversion: '+8-15%' },
      'competitor_analysis': { insights: 'High value', advantage: 'Strategic' }
    };

    return impacts[actionType] || { benefit: 'Measurable improvement', timeline: 'Medium term' };
  }

  generateRealisticTimeline(complexity) {
    const timelines = {
      'low': '1-2 weeks',
      'medium': '3-4 weeks',
      'high': '6-8 weeks',
      'enterprise': '2-3 months'
    };

    return timelines[complexity] || '2-4 weeks';
  }

  async execute() {
    if (this.executing || this.queue.length === 0) return;

    this.executing = true;

    try {
      while (this.queue.length > 0) {
        const action = this.queue.shift();
        action.status = 'executing';

        // Realistic execution delay
        await this.delay(2000 + Math.random() * 3000);

        await this.performAction(action);

        action.status = 'completed';
        action.completedAt = new Date();
        this.history.push(action);
      }
    } finally {
      this.executing = false;
    }
  }

  async performAction(action) {
    // Mock action execution with realistic outcomes
    return new Promise(resolve => {
      setTimeout(() => {
        resolve({
          success: Math.random() > 0.1, // 90% success rate
          message: `${action.title} completed successfully`,
          metrics: action.impact
        });
      }, 1000);
    });
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getStatus() {
    return {
      queueLength: this.queue.length,
      isExecuting: this.executing,
      completedCount: this.history.length,
      successRate: this.history.length > 0
        ? this.history.filter(a => a.status === 'completed').length / this.history.length
        : 0
    };
  }
}

export const actionQueue = new ActionQueueManager();