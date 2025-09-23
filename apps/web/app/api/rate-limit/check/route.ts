import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dealerId = searchParams.get('dealerId') || 'demo-dealer';
    const tier = parseInt(searchParams.get('tier') || '1');

    // Simulate rate limit checking
    const tierLimits = { 1: 50, 2: 200, 3: 500, 4: 2000 };
    const maxRequests = tierLimits[tier as keyof typeof tierLimits] || 50;
    const used = Math.floor(Math.random() * (maxRequests * 0.8)); // Simulate 0-80% usage
    const remaining = maxRequests - used;

    const response = {
      usage: {
        remaining,
        total: maxRequests,
        resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
        tier
      },
      status: remaining > 0 ? 'ok' : 'exceeded'
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Rate limit check error:', error);
    return NextResponse.json(
      { error: 'Failed to check rate limit' },
      { status: 500 }
    );
  }
}