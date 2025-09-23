// Visibility score calculation and merging utilities
import { logger } from './logger';
import { cache } from './cache';

export interface VisibilityScore {
  overall: number;
  breakdown: {
    seo: number;
    aeo: number;
    geo: number;
  };
  sources: string[];
  confidence: number;
  lastUpdated: Date;
}

export interface ScoreSource {
  name: string;
  weight: number;
  data: any;
  reliability: number;
}

export interface SyntheticParams {
  dealerId: string;
  location: string;
  industry?: string;
  competitorCount?: number;
  marketSize?: 'small' | 'medium' | 'large';
}

class VisibilityScoreCalculator {
  private weights = {
    seo: 0.40,      // Traditional SEO still foundational
    aeo: 0.35,      // AI answer engines growing rapidly
    geo: 0.25,      // Generative engine optimization emerging
  };

  calculateOverallScore(breakdown: { seo: number; aeo: number; geo: number }): number {
    return Math.round(
      breakdown.seo * this.weights.seo +
      breakdown.aeo * this.weights.aeo +
      breakdown.geo * this.weights.geo
    );
  }

  // Merge multiple score sources with weighted averaging
  mergeScores(sources: ScoreSource[]): VisibilityScore {
    if (sources.length === 0) {
      throw new Error('Cannot merge empty sources array');
    }

    // Calculate weighted averages for each score type
    let totalWeight = 0;
    let seoSum = 0, aeoSum = 0, geoSum = 0;
    let confidenceSum = 0;

    for (const source of sources) {
      const effectiveWeight = source.weight * source.reliability;
      totalWeight += effectiveWeight;

      if (source.data.seo !== undefined) {
        seoSum += source.data.seo * effectiveWeight;
      }
      if (source.data.aeo !== undefined) {
        aeoSum += source.data.aeo * effectiveWeight;
      }
      if (source.data.geo !== undefined) {
        geoSum += source.data.geo * effectiveWeight;
      }

      confidenceSum += source.reliability * source.weight;
    }

    const breakdown = {
      seo: Math.round(seoSum / totalWeight),
      aeo: Math.round(aeoSum / totalWeight),
      geo: Math.round(geoSum / totalWeight),
    };

    return {
      overall: this.calculateOverallScore(breakdown),
      breakdown,
      sources: sources.map(s => s.name),
      confidence: Math.round((confidenceSum / sources.length) * 100),
      lastUpdated: new Date(),
    };
  }

  // Generate synthetic but realistic scores based on dealer parameters
  generateSyntheticScore(params: SyntheticParams): VisibilityScore {
    const { dealerId, location, industry = 'automotive', competitorCount = 5, marketSize = 'medium' } = params;

    // Create deterministic but varied scores based on dealer ID
    const seed = this.hashString(dealerId);
    const rng = this.seededRandom(seed);

    // Base scores influenced by market characteristics
    const marketMultipliers = {
      small: { seo: 0.85, aeo: 0.90, geo: 0.80 },
      medium: { seo: 1.0, aeo: 1.0, geo: 1.0 },
      large: { seo: 1.15, aeo: 0.95, geo: 1.20 },
    };

    const competitionEffect = Math.max(0.7, 1.0 - (competitorCount * 0.05));
    const multiplier = marketMultipliers[marketSize];

    // Generate base scores with realistic ranges
    const baseSEO = 45 + (rng() * 35); // 45-80 range
    const baseAEO = 25 + (rng() * 40); // 25-65 range
    const baseGEO = 15 + (rng() * 35); // 15-50 range

    const breakdown = {
      seo: Math.round(Math.min(95, baseSEO * multiplier.seo * competitionEffect)),
      aeo: Math.round(Math.min(95, baseAEO * multiplier.aeo * competitionEffect)),
      geo: Math.round(Math.min(95, baseGEO * multiplier.geo * competitionEffect)),
    };

    logger.debug('Generated synthetic visibility score', {
      dealerId,
      location,
      marketSize,
      competitorCount,
      breakdown,
    });

    return {
      overall: this.calculateOverallScore(breakdown),
      breakdown,
      sources: ['synthetic-generator'],
      confidence: 85, // Synthetic scores have decent confidence for demos
      lastUpdated: new Date(),
    };
  }

  // Create realistic variance for the same dealer over time
  addTemporalVariance(baseScore: VisibilityScore, timeOffset: number = 0): VisibilityScore {
    const variance = 0.05; // ±5% variance
    const timeEffect = Math.sin(timeOffset * 0.1) * variance;

    const breakdown = {
      seo: Math.round(Math.max(0, Math.min(100, baseScore.breakdown.seo * (1 + timeEffect)))),
      aeo: Math.round(Math.max(0, Math.min(100, baseScore.breakdown.aeo * (1 + timeEffect * 1.2)))), // AEO more volatile
      geo: Math.round(Math.max(0, Math.min(100, baseScore.breakdown.geo * (1 + timeEffect * 1.5)))), // GEO most volatile
    };

    return {
      ...baseScore,
      overall: this.calculateOverallScore(breakdown),
      breakdown,
      lastUpdated: new Date(),
    };
  }

  // Simulate score progression over time
  generateScoreProgression(params: SyntheticParams, months: number = 4): VisibilityScore[] {
    const baseScore = this.generateSyntheticScore(params);
    const progression: VisibilityScore[] = [];

    for (let i = 0; i < months; i++) {
      const monthlyScore = this.addTemporalVariance(baseScore, i);

      // Add gradual improvement trend
      const improvement = i * 0.02; // 2% improvement per month
      monthlyScore.breakdown.seo = Math.round(Math.min(95, monthlyScore.breakdown.seo * (1 + improvement)));
      monthlyScore.breakdown.aeo = Math.round(Math.min(95, monthlyScore.breakdown.aeo * (1 + improvement * 1.5)));
      monthlyScore.breakdown.geo = Math.round(Math.min(95, monthlyScore.breakdown.geo * (1 + improvement * 2)));
      monthlyScore.overall = this.calculateOverallScore(monthlyScore.breakdown);

      progression.push(monthlyScore);
    }

    return progression;
  }

  // Helper to create deterministic randomness from dealer ID
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private seededRandom(seed: number): () => number {
    let x = seed;
    return function() {
      x = Math.sin(x) * 10000;
      return x - Math.floor(x);
    };
  }

  // Cache-friendly score retrieval
  async getCachedScore(dealerId: string, location: string): Promise<VisibilityScore | null> {
    const key = cache.key('visibility', dealerId, location);
    return await cache.get<VisibilityScore>(key);
  }

  async setCachedScore(dealerId: string, location: string, score: VisibilityScore): Promise<void> {
    const key = cache.key('visibility', dealerId, location);
    await cache.set(key, score, 60 * 60); // Cache for 1 hour
  }

  // Main entry point for getting visibility scores
  async getVisibilityScore(params: SyntheticParams): Promise<VisibilityScore> {
    const cached = await this.getCachedScore(params.dealerId, params.location);
    if (cached) {
      logger.debug('Retrieved cached visibility score', { dealerId: params.dealerId });
      return cached;
    }

    // In a real implementation, you would:
    // 1. Fetch from multiple real data sources (SEMrush, Ahrefs, etc.)
    // 2. Merge the results using mergeScores()
    // 3. Fall back to synthetic if needed

    const score = this.generateSyntheticScore(params);
    await this.setCachedScore(params.dealerId, params.location, score);

    logger.info('Generated new visibility score', {
      dealerId: params.dealerId,
      location: params.location,
      overall: score.overall,
    });

    return score;
  }

  // Batch scoring for multiple dealers
  async getBatchVisibilityScores(dealerParams: SyntheticParams[]): Promise<Map<string, VisibilityScore>> {
    const results = new Map<string, VisibilityScore>();

    // Process in parallel with some concurrency limit
    const batchSize = 5;
    for (let i = 0; i < dealerParams.length; i += batchSize) {
      const batch = dealerParams.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (params) => {
          const score = await this.getVisibilityScore(params);
          return [params.dealerId, score] as const;
        })
      );

      batchResults.forEach(([dealerId, score]) => {
        results.set(dealerId, score);
      });
    }

    return results;
  }

  // Score comparison utilities
  compareScores(scoreA: VisibilityScore, scoreB: VisibilityScore): {
    overallDiff: number;
    breakdown: { seo: number; aeo: number; geo: number };
    winner: 'A' | 'B' | 'tie';
  } {
    return {
      overallDiff: scoreA.overall - scoreB.overall,
      breakdown: {
        seo: scoreA.breakdown.seo - scoreB.breakdown.seo,
        aeo: scoreA.breakdown.aeo - scoreB.breakdown.aeo,
        geo: scoreA.breakdown.geo - scoreB.breakdown.geo,
      },
      winner: scoreA.overall > scoreB.overall ? 'A' :
               scoreB.overall > scoreA.overall ? 'B' : 'tie',
    };
  }
}

export const visibilityCalculator = new VisibilityScoreCalculator();
export default visibilityCalculator;