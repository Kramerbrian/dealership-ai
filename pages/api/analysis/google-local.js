// API endpoint for Google-powered local SEO analysis
import { LocalSEOAnalyzer } from '../../../lib/google-api-integration';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { businessInfo, location, dealerId } = req.body;

  // Validate required data
  if (!businessInfo || !location) {
    return res.status(400).json({
      error: 'Missing required data: businessInfo and location are required'
    });
  }

  // Validate API keys
  const placesApiKey = process.env.GOOGLE_PLACES_API_KEY;
  const pagespeedApiKey = process.env.GOOGLE_PAGESPEED_API_KEY;

  if (!placesApiKey || !pagespeedApiKey) {
    return res.status(500).json({
      error: 'Google API keys not configured',
      missingKeys: {
        places: !placesApiKey,
        pagespeed: !pagespeedApiKey
      }
    });
  }

  try {
    console.log(`Starting Google local analysis for: ${businessInfo.name}`);

    // Initialize the analyzer with API keys
    const analyzer = new LocalSEOAnalyzer(placesApiKey, pagespeedApiKey);

    // Run comprehensive local analysis
    const analysis = await analyzer.analyzeLocal(businessInfo, location);

    // Generate actionable recommendations
    const recommendations = analyzer.generateRecommendations(analysis);

    // Prepare response in consensus format
    const response = {
      consensus_score: analysis.localScore,
      individual_scores: {
        performance: analysis.performance?.scores.performance || 0,
        visibility: calculateVisibilityScore(analysis.searchVisibility),
        competition: calculateCompetitionScore(analysis.competitors)
      },
      unanimous_issues: extractCriticalIssues(analysis),
      all_quick_wins: recommendations
        .filter(rec => rec.priority === 'high')
        .map(rec => rec.action),
      confidence: analysis.error ? 'low' : 'high',
      recommendation: generateMainRecommendation(analysis),
      detailed_analysis: {
        competitors: analysis.competitors?.slice(0, 5) || [],
        search_visibility: analysis.searchVisibility || [],
        performance_metrics: analysis.performance?.metrics || {},
        performance_opportunities: analysis.performance?.opportunities || []
      },
      metadata: {
        timestamp: analysis.timestamp,
        dealerId,
        location,
        analysis_type: 'google-local-seo'
      }
    };

    console.log(`Google local analysis complete. Score: ${analysis.localScore}`);
    res.status(200).json(response);

  } catch (error) {
    console.error('Google local analysis failed:', error);

    // Return fallback response
    res.status(500).json({
      error: 'Analysis failed',
      details: error.message,
      fallback: {
        consensus_score: 50,
        individual_scores: { performance: 0, visibility: 0, competition: 0 },
        unanimous_issues: ['Unable to complete Google API analysis'],
        all_quick_wins: ['Check Google API configuration', 'Verify business location data'],
        confidence: 'low',
        recommendation: 'Manual analysis required - API connection failed'
      }
    });
  }
}

// Helper functions
function calculateVisibilityScore(searchVisibility) {
  if (!searchVisibility || searchVisibility.length === 0) return 0;

  const totalQueries = searchVisibility.length;
  const visibleQueries = searchVisibility.filter(result =>
    result.topResults.slice(0, 3).length > 0
  ).length;

  return Math.round((visibleQueries / totalQueries) * 100);
}

function calculateCompetitionScore(competitors) {
  if (!competitors || competitors.length === 0) return 50;

  const avgCompetitorRating = competitors.reduce((acc, comp) =>
    acc + (comp.rating || 3.0), 0) / competitors.length;

  // Assume business rating of 4.2 (would come from actual data)
  const businessRating = 4.2;

  return Math.round((businessRating / Math.max(avgCompetitorRating, 3.0)) * 100);
}

function extractCriticalIssues(analysis) {
  const issues = [];

  // Performance issues
  if (analysis.performance) {
    if (analysis.performance.scores.performance < 70) {
      issues.push('Website performance below Google standards');
    }
    if (analysis.performance.scores.seo < 80) {
      issues.push('Technical SEO issues detected by Google');
    }
  }

  // Visibility issues
  if (analysis.searchVisibility) {
    const poorVisibility = analysis.searchVisibility.filter(result =>
      result.topResults.length === 0 ||
      !result.topResults.slice(0, 5).find(r =>
        r.name.toLowerCase().includes(analysis.business.name.toLowerCase())
      )
    );

    if (poorVisibility.length > 2) {
      issues.push(`Poor visibility for ${poorVisibility.length} key local searches`);
    }
  }

  // Competition issues
  if (analysis.competitors && analysis.competitors.length > 0) {
    const strongCompetitors = analysis.competitors.filter(comp =>
      comp.rating > 4.3 && comp.totalRatings > 50
    );

    if (strongCompetitors.length > 3) {
      issues.push('Strong competition in local market with high ratings');
    }
  }

  return issues;
}

function generateMainRecommendation(analysis) {
  const score = analysis.localScore;

  if (score < 50) {
    return 'CRITICAL: Multiple local SEO issues require immediate attention';
  } else if (score < 70) {
    return 'MODERATE: Several optimization opportunities to improve local rankings';
  } else if (score < 85) {
    return 'GOOD: Minor improvements needed to dominate local search';
  } else {
    return 'EXCELLENT: Strong local SEO performance with minimal optimization needed';
  }
}