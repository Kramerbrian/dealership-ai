// Change Detection Engine - Identifies significant improvements
// Converted from Python to JavaScript for the ROI Dashboard

class ChangeDetector {
  constructor() {
    this.thresholds = {
      high: 20,    // 20-point change = high significance
      medium: 10,  // 10-point change = medium significance
      low: 5       // 5-point change = low significance
    };
  }

  detectSignificantChanges(currentScores, historicalScores) {
    const changes = [];

    for (const platform in currentScores) {
      if (historicalScores[platform] !== undefined) {
        const diff = currentScores[platform] - historicalScores[platform];
        const absDiff = Math.abs(diff);

        if (absDiff >= this.thresholds.low) {
          changes.push({
            platform: platform,
            change: diff,
            previousScore: historicalScores[platform],
            currentScore: currentScores[platform],
            significance: this.getSignificanceLevel(absDiff),
            trend: diff > 0 ? 'improvement' : 'decline',
            impact: this.calculateImpact(platform, diff),
            timestamp: new Date().toISOString()
          });
        }
      }
    }

    return changes.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  }

  getSignificanceLevel(absDiff) {
    if (absDiff >= this.thresholds.high) return 'high';
    if (absDiff >= this.thresholds.medium) return 'medium';
    return 'low';
  }

  calculateImpact(platform, diff) {
    // Calculate monetary impact based on platform and score change
    const platformMultipliers = {
      chatgpt: 250,      // $250 per point for ChatGPT visibility
      perplexity: 300,   // $300 per point for Perplexity (most valuable for search)
      gemini: 200,       // $200 per point for Gemini (Google integration)
      claude: 150,       // $150 per point for Claude
      copilot: 180,      // $180 per point for Copilot
      grok: 100          // $100 per point for Grok
    };

    const multiplier = platformMultipliers[platform] || 200;
    const monthlyImpact = diff * multiplier;

    return {
      monthly: monthlyImpact,
      annual: monthlyImpact * 12,
      description: diff > 0 ?
        `+$${Math.abs(monthlyImpact).toLocaleString()}/month revenue potential` :
        `-$${Math.abs(monthlyImpact).toLocaleString()}/month revenue risk`
    };
  }

  // Detect improvement trends over time periods
  detectTrends(scoreHistory, periods = 7) {
    const trends = {};

    for (const platform in scoreHistory) {
      const recentScores = scoreHistory[platform].slice(-periods);

      if (recentScores.length >= 3) {
        const trend = this.calculateTrend(recentScores);

        if (Math.abs(trend.slope) > 1) { // Significant trend
          trends[platform] = {
            direction: trend.slope > 0 ? 'ascending' : 'descending',
            slope: trend.slope,
            confidence: trend.confidence,
            prediction: this.predictNextScore(recentScores, trend.slope),
            recommendation: this.getTrendRecommendation(trend.slope, platform)
          };
        }
      }
    }

    return trends;
  }

  calculateTrend(scores) {
    const n = scores.length;
    const sumX = (n * (n - 1)) / 2;  // Sum of indices: 0+1+2+...+(n-1)
    const sumY = scores.reduce((sum, score) => sum + score, 0);
    const sumXY = scores.reduce((sum, score, index) => sum + (index * score), 0);
    const sumX2 = scores.reduce((sum, _, index) => sum + (index * index), 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R-squared for confidence
    const yMean = sumY / n;
    const ssRes = scores.reduce((sum, score, index) => {
      const predicted = slope * index + intercept;
      return sum + Math.pow(score - predicted, 2);
    }, 0);
    const ssTot = scores.reduce((sum, score) => sum + Math.pow(score - yMean, 2), 0);

    const rSquared = 1 - (ssRes / ssTot);

    return {
      slope: slope,
      intercept: intercept,
      confidence: Math.max(0, rSquared) // Ensure non-negative
    };
  }

  predictNextScore(recentScores, slope) {
    const lastIndex = recentScores.length - 1;
    const lastScore = recentScores[lastIndex];
    const prediction = lastScore + slope;

    return {
      predicted: Math.round(Math.max(0, Math.min(100, prediction))), // Clamp between 0-100
      confidence: slope > 0 ? 'improving' : 'declining'
    };
  }

  getTrendRecommendation(slope, platform) {
    if (slope > 2) {
      return {
        action: 'maintain',
        priority: 'low',
        message: `${platform} is improving rapidly. Continue current strategy.`
      };
    } else if (slope < -2) {
      return {
        action: 'urgent_action',
        priority: 'high',
        message: `${platform} is declining. Immediate intervention needed.`
      };
    } else if (slope < 0) {
      return {
        action: 'investigate',
        priority: 'medium',
        message: `${platform} showing slight decline. Monitor closely.`
      };
    } else {
      return {
        action: 'optimize',
        priority: 'medium',
        message: `${platform} has growth potential. Consider optimization.`
      };
    }
  }

  // Generate alerts based on changes
  generateAlerts(changes, trends = {}) {
    const alerts = [];

    // Critical score drops
    const criticalDrops = changes.filter(c =>
      c.significance === 'high' && c.trend === 'decline'
    );

    criticalDrops.forEach(drop => {
      alerts.push({
        type: 'critical',
        platform: drop.platform,
        title: `Critical Drop in ${drop.platform.toUpperCase()}`,
        message: `Score dropped ${Math.abs(drop.change)} points to ${drop.currentScore}%`,
        impact: drop.impact.description,
        action: 'Run Auto-Fix Engine immediately',
        urgency: 'immediate'
      });
    });

    // Major improvements (success stories)
    const majorGains = changes.filter(c =>
      c.significance === 'high' && c.trend === 'improvement'
    );

    majorGains.forEach(gain => {
      alerts.push({
        type: 'success',
        platform: gain.platform,
        title: `Major Improvement in ${gain.platform.toUpperCase()}`,
        message: `Score increased ${gain.change} points to ${gain.currentScore}%`,
        impact: gain.impact.description,
        action: 'Document success factors for other platforms',
        urgency: 'low'
      });
    });

    // Trend-based alerts
    Object.entries(trends).forEach(([platform, trend]) => {
      if (trend.direction === 'descending' && trend.confidence > 0.7) {
        alerts.push({
          type: 'warning',
          platform: platform,
          title: `Declining Trend Detected`,
          message: `${platform} showing consistent decline over recent periods`,
          impact: `Projected next score: ${trend.prediction.predicted}%`,
          action: trend.recommendation.message,
          urgency: trend.recommendation.priority
        });
      }
    });

    return alerts.sort((a, b) => {
      const urgencyOrder = { immediate: 3, high: 2, medium: 1, low: 0 };
      return urgencyOrder[b.urgency] - urgencyOrder[a.urgency];
    });
  }

  // ROI-focused change analysis
  analyzeROIChanges(currentROI, previousROI) {
    const changes = {};

    // Compare key ROI metrics
    const metrics = ['monthlyValue', 'roiMultiple', 'netGain'];

    metrics.forEach(metric => {
      if (currentROI[metric] !== undefined && previousROI[metric] !== undefined) {
        const change = currentROI[metric] - previousROI[metric];
        const percentChange = (change / previousROI[metric]) * 100;

        if (Math.abs(percentChange) > 5) { // 5% threshold
          changes[metric] = {
            previous: previousROI[metric],
            current: currentROI[metric],
            change: change,
            percentChange: percentChange,
            trend: change > 0 ? 'improvement' : 'decline'
          };
        }
      }
    });

    return changes;
  }
}

module.exports = { ChangeDetector };