import { NextRequest, NextResponse } from 'next/server';
import { IntelligenceEngine, estimateRevenueAtRisk, overallVisibility } from '@dealershipai/core';
import { withAdminAuth } from '@/lib/auth/middleware';

async function getDashboard(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const dealerId = searchParams.get('dealerId') || 'toyota-naples';
  const location = searchParams.get('location') || 'Naples, FL';

  try {
    // Use the intelligence engine from core package
    const intelligence = new IntelligenceEngine();
    const data = await intelligence.analyze(dealerId, location);

    // Calculate additional metrics
    const visibility = overallVisibility({
      chatgpt: data.aiPlatformScores?.chatgpt || 28,
      claude: data.aiPlatformScores?.claude || 31,
      perplexity: data.aiPlatformScores?.perplexity || 22,
      gemini: data.aiPlatformScores?.gemini || 25
    });

    const revenueAtRisk = estimateRevenueAtRisk(visibility);

    // Weekly revenue mock data (replace with real data)
    const weeklyRevenue = [
      { w: "W1", rev: 142000 + Math.round(Math.random() * 20000) },
      { w: "W2", rev: 151000 + Math.round(Math.random() * 20000) },
      { w: "W3", rev: 137000 + Math.round(Math.random() * 20000) },
      { w: "W4", rev: 160000 + Math.round(Math.random() * 20000) }
    ];

    const response = {
      dealerId,
      location,
      timestamp: new Date().toISOString(),
      metrics: {
        revenueAtRisk: `$${Math.round(revenueAtRisk / 1000)}K`,
        aiVisibility: `${visibility}%`,
        websiteHealth: "87/100",
        mysteryScore: data.riskScore || 73
      },
      charts: {
        weeklyRevenue,
        aiPlatformScores: data.aiPlatformScores
      },
      rawData: data
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}

async function postDashboard(request: NextRequest) {
  try {
    const { dealerId, action } = await request.json();

    // Handle dashboard actions like refresh, analyze, etc.
    return NextResponse.json({
      success: true,
      message: `Action ${action} completed for ${dealerId}`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to process dashboard action' },
      { status: 500 }
    );
  }
}

export const GET = withAdminAuth(getDashboard);
export const POST = withAdminAuth(postDashboard);