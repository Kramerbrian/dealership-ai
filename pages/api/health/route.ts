import { NextRequest, NextResponse } from 'next/server';

interface HealthResponse {
  status: "ok";
  uptimeSeconds: number;
}

// Track service start time
const serviceStartTime = Date.now();

export async function GET(request: NextRequest) {
  try {
    const now = Date.now();
    const uptimeSeconds = Math.floor((now - serviceStartTime) / 1000);

    const response: HealthResponse = {
      status: "ok",
      uptimeSeconds
    };

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });

  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json(
      { type: 'internal_error', message: 'Health check failed' },
      { status: 500 }
    );
  }
}