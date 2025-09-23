import { NextRequest, NextResponse } from 'next/server';
import { overallVisibility } from '@dealershipai/core';
import { withAdminAuth } from '@/lib/auth/middleware';

async function getVisibility(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const dealerId = searchParams.get('dealerId') || 'toyota-naples';
  const timeframe = searchParams.get('timeframe') || '30d';

  try {
    // Generate mock platform scores with slight variations for timeframe
    const baseScores = {
      chatgpt: 74 + Math.round(Math.random() * 21),
      claude: 69 + Math.round(Math.random() * 26),
      perplexity: 64 + Math.round(Math.random() * 31),
      gemini: 59 + Math.round(Math.random() * 36)
    };

    const currentVisibility = overallVisibility(baseScores);

    // Generate historical data based on timeframe
    const generateHistoricalData = (days: number) => {
      const data = [];
      const now = new Date();

      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);

        // Add some variation to historical scores
        const variance = (Math.random() - 0.5) * 10;
        const historicalScores = {
          chatgpt: Math.max(0, Math.min(100, baseScores.chatgpt + variance)),
          claude: Math.max(0, Math.min(100, baseScores.claude + variance)),
          perplexity: Math.max(0, Math.min(100, baseScores.perplexity + variance)),
          gemini: Math.max(0, Math.min(100, baseScores.gemini + variance))
        };

        data.push({
          date: date.toISOString().split('T')[0],
          visibility: overallVisibility(historicalScores),
          platforms: historicalScores
        });
      }

      return data;
    };

    const getDays = (tf: string) => {
      switch (tf) {
        case '7d': return 7;
        case '30d': return 30;
        case '90d': return 90;
        default: return 30;
      }
    };

    const historicalData = generateHistoricalData(getDays(timeframe));
    const previousVisibility = historicalData[0]?.visibility || currentVisibility - 5;

    const response = {
      dealerId,
      timeframe,
      timestamp: new Date().toISOString(),

      // Current visibility metrics
      current: {
        overall: currentVisibility,
        platforms: baseScores,
        change: currentVisibility - previousVisibility,
        changePercent: Math.round(((currentVisibility - previousVisibility) / previousVisibility) * 100)
      },

      // Historical trend data
      historical: historicalData,

      // Visibility breakdown by category
      breakdown: {
        brandMentions: Math.round(currentVisibility * 0.9 + Math.random() * 10),
        productReferences: Math.round(currentVisibility * 0.85 + Math.random() * 15),
        locationContext: Math.round(currentVisibility * 0.95 + Math.random() * 5),
        serviceOfferings: Math.round(currentVisibility * 0.8 + Math.random() * 20)
      },

      // Platform-specific insights
      platformInsights: {
        chatgpt: {
          score: baseScores.chatgpt,
          strength: 'Product recommendations',
          weakness: 'Local context',
          trend: Math.random() > 0.5 ? 'improving' : 'declining'
        },
        claude: {
          score: baseScores.claude,
          strength: 'Technical explanations',
          weakness: 'Brand recognition',
          trend: Math.random() > 0.5 ? 'improving' : 'stable'
        },
        perplexity: {
          score: baseScores.perplexity,
          strength: 'Real-time information',
          weakness: 'Service details',
          trend: Math.random() > 0.5 ? 'stable' : 'improving'
        },
        gemini: {
          score: baseScores.gemini,
          strength: 'Visual recognition',
          weakness: 'Complex queries',
          trend: Math.random() > 0.5 ? 'improving' : 'declining'
        }
      },

      // Competitive context
      competitive: {
        industryAverage: Math.round(currentVisibility * 0.85),
        regionalAverage: Math.round(currentVisibility * 0.92),
        topCompetitor: Math.round(currentVisibility * 1.15),
        ranking: Math.ceil(Math.random() * 8) + 2 // 3-10
      },

      // Visibility trends and predictions
      trends: {
        momentum: currentVisibility > previousVisibility ? 'positive' : 'negative',
        volatility: Math.round(Math.random() * 20 + 5), // 5-25%
        predictedNext30Days: Math.round(currentVisibility + (Math.random() - 0.5) * 10),
        confidenceLevel: Math.round(85 + Math.random() * 12) // 85-97%
      }
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Visibility API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch visibility data' },
      { status: 500 }
    );
  }
}

export const GET = withAdminAuth(getVisibility);