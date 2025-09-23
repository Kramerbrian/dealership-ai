// Google API Integration for DealershipAI Dashboard
// Enhanced local analysis with Google Places and PageSpeed APIs

// Local search test queries for dealership analysis
const DEALERSHIP_TEST_QUERIES = [
  "best Toyota dealership in Naples, FL",
  "Toyota dealer near me Naples, FL",
  "where to buy Toyota Naples, FL",
  "Honda dealer Cape Coral FL",
  "car dealership with best service near me",
  "certified pre-owned vehicles Naples",
  "Toyota service center Fort Myers",
  "best car prices Southwest Florida",
  "auto financing Naples FL",
  "vehicle trade-in value Cape Coral"
];

// Google Places API integration
export class GooglePlacesAnalyzer {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://maps.googleapis.com/maps/api/place';
  }

  // Find dealership competitors in local area
  async findCompetitors(location, radius = 10000) {
    try {
      const response = await fetch(
        `${this.baseUrl}/nearbysearch/json?location=${location.lat},${location.lng}&radius=${radius}&type=car_dealer&key=${this.apiKey}`
      );

      const data = await response.json();

      return data.results.map(place => ({
        name: place.name,
        placeId: place.place_id,
        rating: place.rating,
        totalRatings: place.user_ratings_total,
        address: place.vicinity,
        types: place.types,
        businessStatus: place.business_status,
        priceLevel: place.price_level
      }));
    } catch (error) {
      console.error('Google Places API error:', error);
      return [];
    }
  }

  // Get detailed business information
  async getBusinessDetails(placeId) {
    try {
      const response = await fetch(
        `${this.baseUrl}/details/json?place_id=${placeId}&fields=name,rating,user_ratings_total,formatted_address,formatted_phone_number,website,opening_hours,reviews,photos&key=${this.apiKey}`
      );

      const data = await response.json();
      return data.result;
    } catch (error) {
      console.error('Google Places details error:', error);
      return null;
    }
  }

  // Test local search visibility for specific queries
  async testLocalVisibility(queries, location) {
    const results = [];

    for (const query of queries) {
      try {
        const response = await fetch(
          `${this.baseUrl}/textsearch/json?query=${encodeURIComponent(query)}&location=${location.lat},${location.lng}&radius=25000&key=${this.apiKey}`
        );

        const data = await response.json();

        results.push({
          query,
          totalResults: data.results.length,
          topResults: data.results.slice(0, 5).map((place, index) => ({
            position: index + 1,
            name: place.name,
            rating: place.rating,
            address: place.formatted_address
          }))
        });
      } catch (error) {
        console.error(`Query test failed for: ${query}`, error);
      }
    }

    return results;
  }
}

// Google PageSpeed API integration
export class GooglePageSpeedAnalyzer {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
  }

  // Analyze website performance
  async analyzePerformance(url, strategy = 'mobile') {
    try {
      const response = await fetch(
        `${this.baseUrl}?url=${encodeURIComponent(url)}&strategy=${strategy}&key=${this.apiKey}&category=PERFORMANCE&category=ACCESSIBILITY&category=BEST_PRACTICES&category=SEO`
      );

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error.message);
      }

      const lighthouse = data.lighthouseResult;
      const categories = lighthouse.categories;

      return {
        url: data.id,
        strategy,
        scores: {
          performance: Math.round(categories.performance.score * 100),
          accessibility: Math.round(categories.accessibility.score * 100),
          bestPractices: Math.round(categories['best-practices'].score * 100),
          seo: Math.round(categories.seo.score * 100)
        },
        metrics: {
          firstContentfulPaint: lighthouse.audits['first-contentful-paint'].displayValue,
          largestContentfulPaint: lighthouse.audits['largest-contentful-paint'].displayValue,
          firstInputDelay: lighthouse.audits['max-potential-fid']?.displayValue,
          cumulativeLayoutShift: lighthouse.audits['cumulative-layout-shift'].displayValue,
          speedIndex: lighthouse.audits['speed-index'].displayValue
        },
        opportunities: lighthouse.audits['diagnostics'] ?
          Object.values(lighthouse.audits)
            .filter(audit => audit.score !== null && audit.score < 0.9)
            .slice(0, 5)
            .map(audit => ({
              title: audit.title,
              description: audit.description,
              score: Math.round(audit.score * 100)
            })) : []
      };
    } catch (error) {
      console.error('PageSpeed API error:', error);
      return null;
    }
  }

  // Compare performance against competitors
  async compareWithCompetitors(primaryUrl, competitorUrls) {
    const results = [];

    // Analyze primary website
    const primaryResult = await this.analyzePerformance(primaryUrl);
    if (primaryResult) {
      results.push({
        url: primaryUrl,
        type: 'primary',
        ...primaryResult
      });
    }

    // Analyze competitors
    for (const competitorUrl of competitorUrls) {
      const competitorResult = await this.analyzePerformance(competitorUrl);
      if (competitorResult) {
        results.push({
          url: competitorUrl,
          type: 'competitor',
          ...competitorResult
        });
      }

      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return results;
  }
}

// Combined local SEO analysis
export class LocalSEOAnalyzer {
  constructor(placesApiKey, pagespeedApiKey) {
    this.placesAnalyzer = new GooglePlacesAnalyzer(placesApiKey);
    this.pagespeedAnalyzer = new GooglePageSpeedAnalyzer(pagespeedApiKey);
  }

  // Comprehensive local analysis
  async analyzeLocal(businessInfo, location) {
    const analysis = {
      timestamp: new Date().toISOString(),
      business: businessInfo,
      location
    };

    try {
      // 1. Find local competitors
      console.log('Finding local competitors...');
      analysis.competitors = await this.placesAnalyzer.findCompetitors(location);

      // 2. Test local search visibility
      console.log('Testing local search visibility...');
      analysis.searchVisibility = await this.placesAnalyzer.testLocalVisibility(
        DEALERSHIP_TEST_QUERIES,
        location
      );

      // 3. Analyze website performance
      if (businessInfo.domain) {
        console.log('Analyzing website performance...');
        analysis.performance = await this.pagespeedAnalyzer.analyzePerformance(
          `https://${businessInfo.domain}`
        );

        // 4. Compare with top competitors' websites
        const competitorSites = analysis.competitors
          .filter(comp => comp.website)
          .slice(0, 3)
          .map(comp => comp.website);

        if (competitorSites.length > 0) {
          console.log('Comparing with competitor performance...');
          analysis.performanceComparison = await this.pagespeedAnalyzer.compareWithCompetitors(
            `https://${businessInfo.domain}`,
            competitorSites
          );
        }
      }

      // 5. Calculate local SEO score
      analysis.localScore = this.calculateLocalScore(analysis);

      return analysis;

    } catch (error) {
      console.error('Local SEO analysis failed:', error);
      return {
        ...analysis,
        error: error.message,
        localScore: 0
      };
    }
  }

  // Calculate comprehensive local SEO score
  calculateLocalScore(analysis) {
    let score = 0;
    let maxScore = 100;

    // Performance score (25 points)
    if (analysis.performance) {
      const avgScore = (
        analysis.performance.scores.performance +
        analysis.performance.scores.seo
      ) / 2;
      score += (avgScore / 100) * 25;
    }

    // Search visibility score (35 points)
    if (analysis.searchVisibility) {
      const visibilityScore = analysis.searchVisibility.reduce((acc, result) => {
        // Find if business appears in top 3 for each query
        const topThreeAppearance = result.topResults.slice(0, 3)
          .find(r => r.name.toLowerCase().includes(analysis.business.name.toLowerCase()));

        return acc + (topThreeAppearance ? 10 : 0);
      }, 0);

      score += Math.min(visibilityScore, 35);
    }

    // Competitor comparison (25 points)
    if (analysis.competitors && analysis.competitors.length > 0) {
      const avgCompetitorRating = analysis.competitors.reduce((acc, comp) =>
        acc + (comp.rating || 0), 0) / analysis.competitors.length;

      // Assume business rating of 4.5 for now (would come from Places API)
      const businessRating = 4.5;
      if (businessRating >= avgCompetitorRating) {
        score += 25;
      } else {
        score += (businessRating / avgCompetitorRating) * 25;
      }
    }

    // Online presence (15 points)
    if (analysis.business.domain) {
      score += 15;
    }

    return Math.round(Math.min(score, maxScore));
  }

  // Generate actionable recommendations
  generateRecommendations(analysis) {
    const recommendations = [];

    // Performance recommendations
    if (analysis.performance) {
      if (analysis.performance.scores.performance < 80) {
        recommendations.push({
          category: 'Performance',
          priority: 'high',
          action: 'Improve website speed - target 80+ performance score',
          impact: 'Better user experience and SEO rankings'
        });
      }

      if (analysis.performance.scores.seo < 90) {
        recommendations.push({
          category: 'Technical SEO',
          priority: 'high',
          action: 'Fix technical SEO issues identified by Google',
          impact: 'Improved search engine visibility'
        });
      }
    }

    // Local visibility recommendations
    if (analysis.searchVisibility) {
      const lowVisibilityQueries = analysis.searchVisibility
        .filter(result => !result.topResults.slice(0, 3)
          .find(r => r.name.toLowerCase().includes(analysis.business.name.toLowerCase())));

      if (lowVisibilityQueries.length > 0) {
        recommendations.push({
          category: 'Local SEO',
          priority: 'high',
          action: `Improve visibility for ${lowVisibilityQueries.length} key local queries`,
          impact: 'Increased local search traffic and leads'
        });
      }
    }

    // Competitor recommendations
    if (analysis.competitors && analysis.competitors.length > 0) {
      const highRatedCompetitors = analysis.competitors.filter(comp => comp.rating > 4.3);

      if (highRatedCompetitors.length > 2) {
        recommendations.push({
          category: 'Reputation',
          priority: 'medium',
          action: 'Focus on improving online reviews and ratings',
          impact: 'Better competitive positioning in local search'
        });
      }
    }

    return recommendations;
  }
}

// Export for use in API endpoints
export {
  DEALERSHIP_TEST_QUERIES,
  GooglePlacesAnalyzer,
  GooglePageSpeedAnalyzer,
  LocalSEOAnalyzer
};