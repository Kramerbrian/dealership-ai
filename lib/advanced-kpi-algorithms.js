/**
 * Advanced KPI Scoring Algorithms for Dealership AI Dashboard
 * Implements SEO, AEO, and GEO visibility metrics beyond basic rankings
 */

// ===== SEO VISIBILITY KPIs =====

/**
 * Core Web Vitals Performance Score
 * Measures LCP, FID, and CLS based on Google's thresholds
 */
export function calculateCoreWebVitals(metrics) {
  const { lcp, fid, cls } = metrics;

  // Google's thresholds: LCP < 2.5s, FID < 100ms, CLS < 0.1
  const lcpScore = lcp <= 2.5 ? 100 : lcp <= 4 ? Math.max(0, 100 - ((lcp - 2.5) / 1.5) * 50) : 25;
  const fidScore = fid <= 100 ? 100 : fid <= 300 ? Math.max(0, 100 - ((fid - 100) / 200) * 50) : 25;
  const clsScore = cls <= 0.1 ? 100 : cls <= 0.25 ? Math.max(0, 100 - ((cls - 0.1) / 0.15) * 50) : 25;

  // Weighted average: LCP 40%, FID 30%, CLS 30%
  return Math.round(lcpScore * 0.4 + fidScore * 0.3 + clsScore * 0.3);
}

/**
 * Impression-to-Click Rate Analysis
 * Evaluates content quality and intent alignment
 */
export function calculateImpressionClickRate(data) {
  const { impressions, clicks, queries } = data;

  if (!impressions || impressions === 0) return 0;

  const ctr = (clicks / impressions) * 100;

  // Industry benchmarks: 2% avg, 4%+ excellent for automotive
  let score = 0;
  if (ctr >= 4) score = 100;
  else if (ctr >= 3) score = 80 + ((ctr - 3) / 1) * 20;
  else if (ctr >= 2) score = 60 + ((ctr - 2) / 1) * 20;
  else if (ctr >= 1) score = 30 + ((ctr - 1) / 1) * 30;
  else score = ctr * 30;

  return Math.round(Math.min(100, score));
}

/**
 * Local SERP Pack Performance
 * Tracks Google Local Pack and Map Pack appearances
 */
export function calculateLocalSERPPerformance(data) {
  const { localPackAppearances, totalLocalQueries, avgPosition, topResults } = data;

  if (!totalLocalQueries) return 0;

  const visibilityRate = (localPackAppearances / totalLocalQueries) * 100;
  const positionScore = avgPosition <= 1 ? 100 : avgPosition <= 3 ? 80 : avgPosition <= 5 ? 60 : 30;
  const dominanceScore = (topResults / localPackAppearances) * 100;

  // Weighted: Visibility 50%, Position 30%, Dominance 20%
  return Math.round(visibilityRate * 0.5 + positionScore * 0.3 + dominanceScore * 0.2);
}

/**
 * Structured Data Coverage Score
 * Evaluates schema implementation across critical pages
 */
export function calculateSchemaScore(data) {
  const {
    vehicleSchemas, inventoryPages,
    reviewSchemas, reviewPages,
    faqSchemas, faqPages,
    organizationSchema,
    localBusinessSchema
  } = data;

  const vehicleCoverage = inventoryPages > 0 ? (vehicleSchemas / inventoryPages) * 100 : 0;
  const reviewCoverage = reviewPages > 0 ? (reviewSchemas / reviewPages) * 100 : 0;
  const faqCoverage = faqPages > 0 ? (faqSchemas / faqPages) * 100 : 0;
  const orgScore = organizationSchema ? 100 : 0;
  const localScore = localBusinessSchema ? 100 : 0;

  // Weighted average based on importance
  return Math.round(
    vehicleCoverage * 0.3 +
    reviewCoverage * 0.2 +
    faqCoverage * 0.2 +
    orgScore * 0.15 +
    localScore * 0.15
  );
}

// ===== AEO VISIBILITY KPIs =====

/**
 * Brand Mention Frequency in AI Overviews
 * Tracks appearances across ChatGPT, Gemini, Perplexity, etc.
 */
export function calculateAIMentionFrequency(data) {
  const { totalQueries, mentions, engines } = data;

  if (!totalQueries) return 0;

  const overallFrequency = (mentions / totalQueries) * 100;
  const engineDiversity = Object.keys(engines).length;
  const consistencyScore = engineDiversity >= 4 ? 100 : (engineDiversity / 4) * 100;

  // Combine frequency and consistency
  return Math.round(overallFrequency * 0.7 + consistencyScore * 0.3);
}

/**
 * Citation Stability Score
 * Measures consistency of AI answer appearance over time
 */
export function calculateCitationStability(data) {
  const { dailyMentions, timeWindow } = data;

  if (!dailyMentions || dailyMentions.length < 7) return 0;

  const mean = dailyMentions.reduce((a, b) => a + b) / dailyMentions.length;
  const variance = dailyMentions.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / dailyMentions.length;
  const stdDev = Math.sqrt(variance);
  const coefficientOfVariation = mean > 0 ? stdDev / mean : 1;

  // Lower CV = higher stability (inverted scale)
  const stabilityScore = Math.max(0, 100 - (coefficientOfVariation * 100));
  return Math.round(stabilityScore);
}

/**
 * Position Priority in LLM Answers
 * Evaluates placement order within AI responses
 */
export function calculateAIPositionScore(data) {
  const { firstMentions, totalMentions, avgPosition } = data;

  if (!totalMentions) return 0;

  const firstPositionRate = (firstMentions / totalMentions) * 100;
  const positionPenalty = avgPosition > 1 ? Math.min(50, (avgPosition - 1) * 10) : 0;

  return Math.round(Math.max(0, firstPositionRate - positionPenalty));
}

/**
 * Hallucination Rate (Inverted - Lower is Better)
 * Tracks inaccurate AI-generated content about the brand
 */
export function calculateHallucinationScore(data) {
  const { totalMentions, inaccurateMentions, outdatedMentions } = data;

  if (!totalMentions) return 100; // No mentions = no hallucinations

  const errorRate = ((inaccurateMentions + outdatedMentions) / totalMentions) * 100;
  return Math.round(Math.max(0, 100 - errorRate));
}

// ===== GEO VISIBILITY KPIs =====

/**
 * AI-Generated Visibility Rate (AIGVR)
 * Compares AI vs traditional search visibility
 */
export function calculateAIGVR(data) {
  const { aiMentions, totalAIQueries, seoImpressions, totalSeoQueries } = data;

  const aiVisibilityRate = totalAIQueries > 0 ? (aiMentions / totalAIQueries) * 100 : 0;
  const seoVisibilityRate = totalSeoQueries > 0 ? (seoImpressions / totalSeoQueries) * 100 : 0;

  if (!seoVisibilityRate) return aiVisibilityRate;

  // AIGVR = AI visibility relative to SEO visibility
  return Math.round((aiVisibilityRate / seoVisibilityRate) * 100);
}

/**
 * Competitive Share of Visibility
 * Dealer's share vs nearby competitors in AI + traditional search
 */
export function calculateCompetitiveShare(data) {
  const { dealerMentions, competitorMentions, marketSize } = data;

  const totalMarketMentions = dealerMentions + competitorMentions.reduce((sum, comp) => sum + comp.mentions, 0);

  if (!totalMarketMentions) return 0;

  const shareOfVoice = (dealerMentions / totalMarketMentions) * 100;
  const expectedShare = 100 / (marketSize || 10); // Market size fallback

  // Score relative to expected equal share
  return Math.round(Math.min(100, (shareOfVoice / expectedShare) * 100));
}

/**
 * Content Engagement Rate (CER)
 * On-site actions per AI-search-derived visit
 */
export function calculateContentEngagementRate(data) {
  const {
    aiTrafficSessions,
    pageViews,
    formSubmissions,
    phoneClicks,
    inventoryViews
  } = data;

  if (!aiTrafficSessions) return 0;

  const pagesPerSession = pageViews / aiTrafficSessions;
  const conversionActions = formSubmissions + phoneClicks + inventoryViews;
  const actionRate = (conversionActions / aiTrafficSessions) * 100;

  // Combine depth and actions
  const depthScore = Math.min(100, pagesPerSession * 25); // 4+ pages = 100
  const actionScore = Math.min(100, actionRate * 5); // 20% action rate = 100

  return Math.round(depthScore * 0.4 + actionScore * 0.6);
}

// ===== COMPOSITE SCORING =====

/**
 * Advanced SEO Composite Score
 * Combines all SEO KPIs with proper weighting
 */
export function calculateAdvancedSEOScore(data) {
  const coreWebVitals = calculateCoreWebVitals(data.performance);
  const clickRate = calculateImpressionClickRate(data.search);
  const localSERP = calculateLocalSERPPerformance(data.local);
  const schemaScore = calculateSchemaScore(data.schema);

  // Weighted composite
  return Math.round(
    coreWebVitals * 0.3 +
    clickRate * 0.25 +
    localSERP * 0.25 +
    schemaScore * 0.2
  );
}

/**
 * Advanced AEO Composite Score
 * Combines all AEO KPIs for answer engine optimization
 */
export function calculateAdvancedAEOScore(data) {
  const mentionFreq = calculateAIMentionFrequency(data.mentions);
  const citationStability = calculateCitationStability(data.stability);
  const positionScore = calculateAIPositionScore(data.position);
  const hallucinationScore = calculateHallucinationScore(data.accuracy);

  return Math.round(
    mentionFreq * 0.3 +
    citationStability * 0.25 +
    positionScore * 0.25 +
    hallucinationScore * 0.2
  );
}

/**
 * Advanced GEO Composite Score
 * Combines all GEO KPIs for generative engine optimization
 */
export function calculateAdvancedGEOScore(data) {
  const aigvr = calculateAIGVR(data.visibility);
  const competitiveShare = calculateCompetitiveShare(data.competitive);
  const engagementRate = calculateContentEngagementRate(data.engagement);

  return Math.round(
    aigvr * 0.4 +
    competitiveShare * 0.35 +
    engagementRate * 0.25
  );
}

// ===== TRENDING & ALERTS =====

/**
 * Calculate trend direction and strength
 */
export function calculateTrend(currentValue, previousValue, threshold = 5) {
  if (!previousValue) return { direction: 'neutral', strength: 0, change: 0 };

  const change = currentValue - previousValue;
  const percentChange = (change / previousValue) * 100;

  let direction = 'neutral';
  let strength = Math.abs(percentChange);

  if (Math.abs(percentChange) >= threshold) {
    direction = percentChange > 0 ? 'up' : 'down';
  }

  return {
    direction,
    strength: Math.round(strength),
    change: Math.round(percentChange * 100) / 100
  };
}

/**
 * Alert system for significant changes
 */
export function generateAlerts(currentScores, previousScores, thresholds = {}) {
  const defaultThresholds = {
    critical: -15, // 15+ point drop
    warning: -10,  // 10+ point drop
    improvement: 10 // 10+ point gain
  };

  const alertThresholds = { ...defaultThresholds, ...thresholds };
  const alerts = [];

  Object.keys(currentScores).forEach(metric => {
    if (!previousScores[metric]) return;

    const change = currentScores[metric] - previousScores[metric];

    if (change <= alertThresholds.critical) {
      alerts.push({
        type: 'critical',
        metric,
        change,
        message: `${metric} dropped ${Math.abs(change)} points - immediate attention needed`
      });
    } else if (change <= alertThresholds.warning) {
      alerts.push({
        type: 'warning',
        metric,
        change,
        message: `${metric} declined ${Math.abs(change)} points - monitor closely`
      });
    } else if (change >= alertThresholds.improvement) {
      alerts.push({
        type: 'success',
        metric,
        change,
        message: `${metric} improved ${change} points - great progress!`
      });
    }
  });

  return alerts;
}

// ===== MOCK DATA GENERATORS =====

/**
 * Generate realistic mock data for testing
 */
export function generateMockKPIData(dealershipName = "Premium Auto Naples") {
  return {
    performance: {
      lcp: 2.3,
      fid: 85,
      cls: 0.08
    },
    search: {
      impressions: 45000,
      clicks: 1350,
      queries: 850
    },
    local: {
      localPackAppearances: 320,
      totalLocalQueries: 450,
      avgPosition: 2.1,
      topResults: 180
    },
    schema: {
      vehicleSchemas: 245,
      inventoryPages: 280,
      reviewSchemas: 45,
      reviewPages: 50,
      faqSchemas: 15,
      faqPages: 20,
      organizationSchema: true,
      localBusinessSchema: true
    },
    mentions: {
      totalQueries: 1000,
      mentions: 340,
      engines: {
        'ChatGPT': 125,
        'Gemini': 98,
        'Perplexity': 87,
        'Claude': 30
      }
    },
    stability: {
      dailyMentions: [45, 52, 38, 49, 55, 42, 47, 51, 39, 48, 53, 44, 50, 46],
      timeWindow: 14
    },
    position: {
      firstMentions: 85,
      totalMentions: 340,
      avgPosition: 2.3
    },
    accuracy: {
      totalMentions: 340,
      inaccurateMentions: 12,
      outdatedMentions: 8
    },
    visibility: {
      aiMentions: 340,
      totalAIQueries: 1000,
      seoImpressions: 45000,
      totalSeoQueries: 50000
    },
    competitive: {
      dealerMentions: 340,
      competitorMentions: [
        { name: "Competitor A", mentions: 280 },
        { name: "Competitor B", mentions: 195 },
        { name: "Competitor C", mentions: 165 }
      ],
      marketSize: 12
    },
    engagement: {
      aiTrafficSessions: 850,
      pageViews: 3400,
      formSubmissions: 68,
      phoneClicks: 102,
      inventoryViews: 255
    }
  };
}