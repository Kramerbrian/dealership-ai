// Dealership AI Scoring Algorithms
// Research-based formulas for SEO/AEO/GEO visibility measurement

export interface SEOMetrics {
  techSEO: number;
  schema: number;
  content: number;
  backlinks: number;
  reviews: number;
}

export interface AEOMetrics {
  citations: number;
  relevance: number;
  faqSchema: number;
  authority: number;
  sentiment: number;
}

export interface GEOMetrics {
  presence: number;
  schemaMatch: number;
  freshness: number;
  accuracy: number;
  competition: number;
}

export interface TechnicalSEOData {
  lcp: number;
  fid: number;
  cls: number;
  mobileScore: number;
  desktopScore: number;
}

export interface SchemaData {
  totalPages: number;
  pagesWithSchema: number;
  schemaTypes: string[];
}

export interface CitationData {
  totalMentions: number;
  queryVolume: number;
  competitorAverage: number;
}

export interface PresenceData {
  triggeredQueries: number;
  totalTrackedQueries: number;
  position: number;
}

export interface Recommendation {
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  category: string;
  action: string;
  impact: string;
  effort: string;
}

export interface CompetitorData {
  avgSEO: number;
  avgAEO: number;
  avgGEO: number;
  topPerformer: {
    seo: number;
    aeo: number;
    geo: number;
  };
}

export interface ScoreSuite {
  seo: number;
  aeo: number;
  geo: number;
}

/**
 * SEO Score Algorithm
 * Measures traditional search engine optimization effectiveness
 *
 * Weights based on 2024-2025 Google ranking factor studies:
 * - Technical factors increasingly critical (Core Web Vitals mandate)
 * - Schema markup now table stakes for rich snippets
 * - Content quality > keyword density
 * - Backlink quality > quantity (E-E-A-T focus)
 * - Review signals crucial for local businesses
 */
export const calculateSEOScore = (metrics: SEOMetrics): number => {
  const weights = {
    techSEO: 0.30,    // Core Web Vitals, page speed, mobile, crawlability
    schema: 0.25,     // Structured data coverage (LocalBusiness, FAQ, Product)
    content: 0.20,    // Title optimization, meta descriptions, internal linking
    backlinks: 0.15,  // Domain authority, citation strength, link quality
    reviews: 0.10     // Google Business Profile reviews, aggregator signals
  };

  const { techSEO, schema, content, backlinks, reviews } = metrics;

  return (
    techSEO * weights.techSEO +
    schema * weights.schema +
    content * weights.content +
    backlinks * weights.backlinks +
    reviews * weights.reviews
  );
};

/**
 * AEO Score Algorithm
 * Measures visibility in AI-powered answer engines (ChatGPT, Perplexity, etc.)
 *
 * Weights based on LLM citation behavior research:
 * - Citation frequency is primary signal
 * - Context relevance prevents gaming with irrelevant mentions
 * - FAQ schema crucial for conversational queries
 * - Authority domains get preferential treatment
 * - Sentiment affects recommendation likelihood
 */
export const calculateAEOScore = (metrics: AEOMetrics): number => {
  const weights = {
    citations: 0.30,    // Frequency of mentions across AI models
    relevance: 0.25,    // Context alignment with dealership intent
    faqSchema: 0.20,    // FAQ/HowTo structured data coverage
    authority: 0.15,    // Mentions on high E-E-A-T domains
    sentiment: 0.10     // Positive vs neutral mention ratio
  };

  const { citations, relevance, faqSchema, authority, sentiment } = metrics;

  return (
    citations * weights.citations +
    relevance * weights.relevance +
    faqSchema * weights.faqSchema +
    authority * weights.authority +
    sentiment * weights.sentiment
  );
};

/**
 * GEO Score Algorithm
 * Measures visibility in Google AI Overviews (SGE/Generative Engine results)
 *
 * Weights based on AI Overview appearance pattern analysis:
 * - Presence is king - you can't optimize what doesn't appear
 * - Schema matching is critical for structured answer extraction
 * - Freshness beats stale content in dynamic categories
 * - NAP accuracy prevents AI hallucinations
 * - Local competition share indicates market dominance
 */
export const calculateGEOScore = (metrics: GEOMetrics): number => {
  const weights = {
    presence: 0.35,     // Appearance frequency in AI Overview answer sets
    schemaMatch: 0.25,  // FAQ, HowTo, LocalBusiness schema alignment
    freshness: 0.20,    // Content recency and update frequency
    accuracy: 0.10,     // NAP consistency across citations
    competition: 0.10   // Share of voice vs local competitors
  };

  const { presence, schemaMatch, freshness, accuracy, competition } = metrics;

  return (
    presence * weights.presence +
    schemaMatch * weights.schemaMatch +
    freshness * weights.freshness +
    accuracy * weights.accuracy +
    competition * weights.competition
  );
};

/**
 * Metric Normalization Utilities
 * Convert raw data into 0-100 normalized scores
 */
export const normalizeMetrics = {
  // Technical SEO normalization (Core Web Vitals, PageSpeed, etc.)
  techSEO: (rawData: TechnicalSEOData): number => {
    const { lcp, fid, cls, mobileScore, desktopScore } = rawData;

    // Core Web Vitals scoring (Google thresholds)
    const lcpScore = lcp <= 2.5 ? 100 : lcp <= 4.0 ? 75 : 50;
    const fidScore = fid <= 100 ? 100 : fid <= 300 ? 75 : 50;
    const clsScore = cls <= 0.1 ? 100 : cls <= 0.25 ? 75 : 50;

    // PageSpeed scores are already 0-100
    return Math.round(
      (lcpScore * 0.3) +
      (fidScore * 0.2) +
      (clsScore * 0.2) +
      (mobileScore * 0.2) +
      (desktopScore * 0.1)
    );
  },

  // Schema coverage normalization
  schema: (rawData: SchemaData): number => {
    const { totalPages, pagesWithSchema, schemaTypes } = rawData;
    const coverage = (pagesWithSchema / totalPages) * 100;
    const typeBonus = Math.min(schemaTypes.length * 10, 30); // Bonus for variety
    return Math.min(100, coverage + typeBonus);
  },

  // Citation frequency normalization (mentions per query sample)
  citations: (rawData: CitationData): number => {
    const { totalMentions, queryVolume, competitorAverage } = rawData;
    const mentionRate = (totalMentions / queryVolume) * 100;
    const competitiveIndex = (mentionRate / competitorAverage) * 50;
    return Math.min(100, competitiveIndex);
  },

  // AI Presence normalization (appearance in AI Overviews)
  presence: (rawData: PresenceData): number => {
    const { triggeredQueries, totalTrackedQueries, position } = rawData;
    const appearanceRate = (triggeredQueries / totalTrackedQueries) * 100;
    const positionBonus = position <= 3 ? 20 : position <= 5 ? 10 : 0;
    return Math.min(100, appearanceRate + positionBonus);
  }
};

/**
 * Competitive Analysis Utilities
 * Compare scores against local market
 */
export const benchmarkAgainstCompetitors = (yourScores: ScoreSuite, competitorData: CompetitorData) => {
  const { seo, aeo, geo } = yourScores;
  const { avgSEO, avgAEO, avgGEO, topPerformer } = competitorData;

  return {
    seoPercentile: calculatePercentile(seo, avgSEO),
    aeoPercentile: calculatePercentile(aeo, avgAEO),
    geoPercentile: calculatePercentile(geo, avgGEO),
    gapToLeader: {
      seo: topPerformer.seo - seo,
      aeo: topPerformer.aeo - aeo,
      geo: topPerformer.geo - geo
    }
  };
};

const calculatePercentile = (yourScore: number, marketAverage: number): number => {
  return Math.round((yourScore / marketAverage) * 50 + 50);
};

/**
 * Action Recommendations Engine
 * Suggest improvements based on score analysis
 */
export const generateRecommendations = (scores: ScoreSuite, rawMetrics: any): Recommendation[] => {
  const recommendations: Recommendation[] = [];

  // SEO recommendations
  if (scores.seo < 80) {
    if (rawMetrics.seo?.techSEO < 70) {
      recommendations.push({
        priority: 'HIGH',
        category: 'Technical SEO',
        action: 'Fix Core Web Vitals issues',
        impact: 'immediate',
        effort: 'medium'
      });
    }
    if (rawMetrics.seo?.schema < 60) {
      recommendations.push({
        priority: 'HIGH',
        category: 'Schema',
        action: 'Implement LocalBusiness and FAQ schema',
        impact: '2-4 weeks',
        effort: 'low'
      });
    }
  }

  // AEO recommendations
  if (scores.aeo < 75) {
    if (rawMetrics.aeo?.faqSchema < 70) {
      recommendations.push({
        priority: 'MEDIUM',
        category: 'AI Optimization',
        action: 'Add FAQ sections to key pages',
        impact: '4-8 weeks',
        effort: 'medium'
      });
    }
  }

  // GEO recommendations
  if (scores.geo < 70) {
    if (rawMetrics.geo?.freshness < 60) {
      recommendations.push({
        priority: 'MEDIUM',
        category: 'Content Freshness',
        action: 'Update inventory and specials weekly',
        impact: '2-6 weeks',
        effort: 'low'
      });
    }
  }

  return recommendations.sort((a, b) => {
    const priorityOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    return priorityOrder[b.priority] - priorityOrder[a.priority];
  });
};

/**
 * Data Sources Integration Map
 * Map external APIs to internal metrics
 */
export const dataSourceMap = {
  seo: {
    techSEO: ['PageSpeed Insights API', 'Search Console API'],
    schema: ['Schema.org Validator', 'Rich Results Test'],
    content: ['Search Console API', 'Screaming Frog'],
    backlinks: ['Ahrefs API', 'Semrush API'],
    reviews: ['Google My Business API', 'ReviewTrackers']
  },
  aeo: {
    citations: ['Otterly.ai API', 'GenRank tracker'],
    relevance: ['Custom LLM prompting', 'Context analysis'],
    faqSchema: ['Schema validator', 'Rich Results Test'],
    authority: ['Ahrefs API', 'E-A-T scoring'],
    sentiment: ['Custom sentiment analysis', 'Brand monitoring']
  },
  geo: {
    presence: ['seoClarity AIO tracker', 'SE Ranking'],
    schemaMatch: ['Schema validator', 'Markup validator'],
    freshness: ['Content audit tools', 'Site crawlers'],
    accuracy: ['Whitespark', 'Local citation audits'],
    competition: ['Local Falcon', 'BrightLocal']
  }
};

// Export all functions for use in dashboard or API
export default {
  calculateSEOScore,
  calculateAEOScore,
  calculateGEOScore,
  normalizeMetrics,
  benchmarkAgainstCompetitors,
  generateRecommendations,
  dataSourceMap
};