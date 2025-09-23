export const GEOGRAPHIC_POOLS: Record<string, string> = {
  'Naples, FL': 'southwest_florida',
  'Cape Coral, FL': 'southwest_florida',
  'Fort Myers, FL': 'southwest_florida',
  'Miami, FL': 'southeast_florida',
  'Tampa, FL': 'central_florida'
};

export function addDealerVariance(baseData: any, dealerId: string) {
  const seed = dealerId.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  const variance = ((seed % 100) / 1000) - 0.05; // ±5% variance

  return {
    ...baseData,
    riskScore: Math.max(0, Math.min(100, baseData.riskScore + (baseData.riskScore * variance))),
    aiVisibilityScore: Math.max(0, Math.min(100, baseData.aiVisibilityScore + (baseData.aiVisibilityScore * variance))),
    sovPercentage: Math.max(0, Math.min(100, baseData.sovPercentage + (baseData.sovPercentage * variance * 0.5))),
    monthlyLossRisk: Math.max(0, baseData.monthlyLossRisk + (baseData.monthlyLossRisk * variance)),
    aiPlatformScores: Object.keys(baseData.aiPlatformScores || {}).reduce((acc, platform) => {
      acc[platform] = Math.max(0, Math.min(100, baseData.aiPlatformScores[platform] + (baseData.aiPlatformScores[platform] * variance * 0.3)));
      return acc;
    }, {} as Record<string, number>)
  };
}

export class IntelligenceEngine {
  private realDataRatio = 0.1;
  private cacheHitRate = 0.95;
  private syntheticVariance = 0.05;
  private cache = new Map();

  async analyze(dealerId: string, location: string) {
    const geographicPool = GEOGRAPHIC_POOLS[location] || 'default';
    const cacheKey = `${geographicPool}_${Date.now().toString().slice(0, -7)}`;

    let pooledData = this.cache.get(cacheKey);

    if (!pooledData || Math.random() > this.cacheHitRate) {
      pooledData = this.generatePooledData(geographicPool, location);
      this.cache.set(cacheKey, pooledData);
    }

    return addDealerVariance(pooledData, dealerId);
  }

  private generatePooledData(pool: string, location: string) {
    const regionMultipliers: Record<string, { competition: number; visibility: number; risk: number }> = {
      'southwest_florida': { competition: 1.2, visibility: 0.9, risk: 1.1 },
      'southeast_florida': { competition: 1.5, visibility: 0.8, risk: 1.3 },
      'central_florida': { competition: 1.3, visibility: 0.85, risk: 1.2 },
      'default': { competition: 1.0, visibility: 1.0, risk: 1.0 }
    };

    const multiplier = regionMultipliers[pool] || regionMultipliers['default'];

    return {
      riskScore: Math.round(72 * (1 + (Math.random() * 0.3 - 0.15))),
      monthlyLossRisk: Math.round(15800 * multiplier.risk * (1 + (Math.random() * 0.4 - 0.2))),
      aiVisibilityScore: Math.round(34 * multiplier.visibility * (1 + (Math.random() * 0.5 - 0.25))),
      invisiblePercentage: Math.round(66 * (1 + (Math.random() * 0.3 - 0.15))),
      marketPosition: Math.ceil(8 * multiplier.competition),
      totalCompetitors: Math.round(12 * multiplier.competition),
      sovPercentage: Math.round(23.4 * (1 + (Math.random() * 0.4 - 0.2))),
      aiPlatformScores: {
        chatgpt: Math.round(28 * multiplier.visibility * (1 + (Math.random() * 0.6 - 0.3))),
        claude: Math.round(31 * multiplier.visibility * (1 + (Math.random() * 0.5 - 0.25))),
        perplexity: Math.round(22 * multiplier.visibility * (1 + (Math.random() * 0.7 - 0.35))),
        gemini: Math.round(25 * multiplier.visibility * (1 + (Math.random() * 0.6 - 0.3)))
      }
    };
  }
}