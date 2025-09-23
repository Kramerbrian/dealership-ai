import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';

interface RefreshRequest {
  origin: string;
  force?: boolean;
}

interface RefreshResult {
  origin: string;
  jobId: string;
  status: "queued" | "running" | "completed" | "skipped" | "failed";
  nextRecommendedCheckInSeconds?: number;
}

// Rate limiting for refresh endpoint (more restrictive)
const limiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 100,
});

function validateApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get('X-API-Key');
  if (!apiKey) return false;

  const validKeys = [
    process.env.EXTERNAL_GPT_API_KEY,
    process.env.DEALERSHIP_API_KEY,
    'demo-key-for-testing'
  ].filter(Boolean);

  return validKeys.includes(apiKey);
}

function generateJobId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `job_${timestamp}_${random}`;
}

// Simulate job processing
function processRefreshJob(origin: string, force: boolean): RefreshResult {
  const jobId = generateJobId();

  // Simulate different scenarios based on origin
  const hash = Math.abs(origin.split('').reduce((a, b) => a + b.charCodeAt(0), 0));
  const scenarios = ['queued', 'running', 'completed', 'skipped'] as const;
  const status = scenarios[hash % scenarios.length];

  let nextCheckIn: number | undefined;

  switch (status) {
    case 'queued':
      nextCheckIn = 30; // Check back in 30 seconds
      break;
    case 'running':
      nextCheckIn = 60; // Check back in 1 minute
      break;
    case 'completed':
      nextCheckIn = undefined; // No need to check back
      break;
    case 'skipped':
      nextCheckIn = force ? 30 : 300; // 30 seconds if forced, 5 minutes otherwise
      break;
  }

  return {
    origin,
    jobId,
    status,
    nextRecommendedCheckInSeconds: nextCheckIn
  };
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting (more restrictive for refresh)
    const ip = request.ip ?? '127.0.0.1';
    const { success } = await limiter.check(5, ip); // 5 requests per minute

    if (!success) {
      return NextResponse.json(
        { type: 'rate_limited', message: 'Rate limit exceeded. Refresh requests are limited to 5 per minute.' },
        { status: 429 }
      );
    }

    // API key validation
    if (!validateApiKey(request)) {
      return NextResponse.json(
        { type: 'unauthorized', message: 'Missing or invalid API key' },
        { status: 401 }
      );
    }

    // Parse request body
    let body: RefreshRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { type: 'bad_request', message: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const { origin, force = false } = body;

    if (!origin) {
      return NextResponse.json(
        { type: 'bad_request', message: 'origin is required' },
        { status: 400 }
      );
    }

    // Validate origin format
    try {
      new URL(origin);
    } catch {
      return NextResponse.json(
        { type: 'bad_request', message: 'origin must be a valid URL' },
        { status: 400 }
      );
    }

    // Process refresh job
    const result = processRefreshJob(origin, force);

    // Log refresh request for monitoring
    console.log(`Refresh job ${result.jobId} ${result.status} for ${origin}${force ? ' (forced)' : ''}`);

    return NextResponse.json(result, { status: 202 });

  } catch (error) {
    console.error('Refresh API error:', error);
    return NextResponse.json(
      { type: 'internal_error', message: 'Internal server error' },
      { status: 500 }
    );
  }
}