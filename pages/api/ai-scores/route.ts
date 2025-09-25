import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';

interface ScoreBreakdown {
  aiVisibilityIndex: number;
  seoScore: number;
  aeoScore: number;
  geoScore: number;
  websiteHealth: number;
  mysteryShopScore: number;
  revenueAtRiskUSD: number;
  appraisalToSalesRatio?: number;
  tradeCapturePct?: number;
  missedTradesPct?: number;
}

interface Threat {
  category: "AI Search" | "Zero-Click" | "UGC/Reviews" | "Local SEO";
  severity: "Critical" | "High" | "Medium" | "Low";
  impact: string;
  description: string;
}

interface Citation {
  id: string;
  source: string;
  title: string;
  url?: string;
}

interface AiScoresResponse {
  origin: string;
  updatedAt: string;
  freshnessSeconds: number;
  scores: ScoreBreakdown;
  threats?: Threat[];
  evidence?: Citation[];
}

// Rate limiting
const limiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500,
});

// Simulate AI score calculation based on URL analysis
function generateScoresForOrigin(origin: string): ScoreBreakdown {
  // Use URL hash to generate consistent but varied scores
  const hash = origin.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);

  const baseScore = 60 + (Math.abs(hash) % 40); // 60-99 base range

  return {
    aiVisibilityIndex: Math.min(100, baseScore + (hash % 10)),
    seoScore: Math.min(100, baseScore + (hash % 15)),
    aeoScore: Math.min(100, baseScore - (Math.abs(hash) % 20)),
    geoScore: Math.min(100, baseScore + (hash % 12)),
    websiteHealth: Math.min(100, baseScore + (hash % 8)),
    mysteryShopScore: Math.min(100, baseScore - (Math.abs(hash) % 25)),
    revenueAtRiskUSD: 250000 + (Math.abs(hash) % 500000),
    appraisalToSalesRatio: 1.5 + ((Math.abs(hash) % 100) / 100),
    tradeCapturePct: 0.25 + ((Math.abs(hash) % 50) / 100),
    missedTradesPct: 0.1 + ((Math.abs(hash) % 30) / 100)
  };
}

function generateThreats(origin: string): Threat[] {
  const hash = Math.abs(origin.split('').reduce((a, b) => a + b.charCodeAt(0), 0));

  const allThreats: Threat[] = [
    {
      category: "AI Search",
      severity: "High",
      impact: "Losing top answers in ChatGPT for 'service near me'",
      description: "Missing FAQ schema and weak E-E-A-T on service pages"
    },
    {
      category: "Zero-Click",
      severity: "Medium",
      impact: "Featured snippets showing competitor information",
      description: "Structured data optimization needed for local business queries"
    },
    {
      category: "UGC/Reviews",
      severity: "Critical",
      impact: "Negative sentiment trending across review platforms",
      description: "Response time to reviews averaging 8+ days, affecting trust signals"
    },
    {
      category: "Local SEO",
      severity: "High",
      impact: "Map pack visibility declining for key service terms",
      description: "GMB optimization and local citation consistency issues"
    }
  ];

  // Return 1-3 threats based on hash
  const numThreats = 1 + (hash % 3);
  return allThreats.slice(0, numThreats);
}

function generateEvidence(origin: string): Citation[] {
  const hash = Math.abs(origin.split('').reduce((a, b) => a + b.charCodeAt(0), 0));

  return [
    {
      id: `cit_${hash.toString(16)}_001`,
      source: "chatgpt",
      title: "Service query response snapshot",
      url: "https://chat.openai.com/share/example"
    },
    {
      id: `cit_${hash.toString(16)}_002`,
      source: "google",
      title: "Featured snippet analysis",
      url: `https://google.com/search?q=auto+service+${encodeURIComponent(origin)}`
    },
    {
      id: `cit_${hash.toString(16)}_003`,
      source: "gemini",
      title: "Local business knowledge panel"
    }
  ];
}

function validateApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get('X-API-Key');
  if (!apiKey) return false;

  // In production, verify against your API key store
  const validKeys = [
    process.env.EXTERNAL_GPT_API_KEY,
    process.env.DEALERSHIP_API_KEY,
    'demo-key-for-testing'
  ].filter(Boolean);

  return validKeys.includes(apiKey);
}

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.ip ?? '127.0.0.1';
    const rateLimitResult = await limiter.check(10, ip);
    const success = typeof rateLimitResult === 'object' && 'success' in rateLimitResult
      ? rateLimitResult.success
      : Boolean(rateLimitResult);

    if (!success) {
      return NextResponse.json(
        { type: 'rate_limited', message: 'Rate limit exceeded' },
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

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const origin = searchParams.get('origin');
    const includeEvidence = searchParams.get('includeEvidence') === 'true';

    if (!origin) {
      return NextResponse.json(
        { type: 'bad_request', message: 'origin parameter is required' },
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

    // Generate scores for the origin
    const scores = generateScoresForOrigin(origin);
    const threats = generateThreats(origin);
    const evidence = includeEvidence ? generateEvidence(origin) : undefined;

    // Simulate cache status
    const cacheStatus = Math.random() > 0.3 ? 'HIT' : 'MISS';
    const updatedAt = new Date();
    const freshnessSeconds = Math.floor(Math.random() * 3600); // 0-60 minutes

    const response: AiScoresResponse = {
      origin,
      updatedAt: updatedAt.toISOString(),
      freshnessSeconds,
      scores,
      threats,
      evidence
    };

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'x-cache-status': cacheStatus,
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('AI Scores API error:', error);
    return NextResponse.json(
      { type: 'internal_error', message: 'Internal server error' },
      { status: 500 }
    );
  }
}