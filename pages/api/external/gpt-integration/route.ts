import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';

interface GPTIntegrationRequest {
  action: 'schema_create' | 'analyze' | 'generate';
  data: {
    dealership_url?: string;
    schema_type?: string;
    content?: string;
    prompt?: string;
  };
  api_key?: string;
}

interface GPTIntegrationResponse {
  success: boolean;
  data?: any;
  error?: string;
  schema?: object;
  analysis?: object;
}

// Rate limiting configuration
const limiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500,
});

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.ip ?? '127.0.0.1';
    const rateLimitResult = await limiter.check(10, ip); // 10 requests per minute
    const success = 'success' in rateLimitResult ? rateLimitResult.success : rateLimitResult;

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Verify API key if provided
    const body: GPTIntegrationRequest = await request.json();

    if (body.api_key && body.api_key !== process.env.EXTERNAL_GPT_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'Invalid API key' },
        { status: 401 }
      );
    }

    const { action, data } = body;

    switch (action) {
      case 'schema_create':
        return await handleSchemaCreation(data);

      case 'analyze':
        return await handleDealershipAnalysis(data);

      case 'generate':
        return await handleContentGeneration(data);

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('GPT Integration error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleSchemaCreation(data: any): Promise<NextResponse> {
  try {
    const { dealership_url, schema_type } = data;

    if (!dealership_url) {
      return NextResponse.json(
        { success: false, error: 'dealership_url is required' },
        { status: 400 }
      );
    }

    // Call your existing analysis endpoint
    const analysisResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: dealership_url }),
    });

    const analysisData = await analysisResponse.json();

    // Generate schema based on analysis
    const schema = generateSchemaFromAnalysis(analysisData, schema_type);

    return NextResponse.json({
      success: true,
      schema,
      analysis: analysisData,
      dealership_url,
    });

  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Schema creation failed' },
      { status: 500 }
    );
  }
}

async function handleDealershipAnalysis(data: any): Promise<NextResponse> {
  try {
    const { dealership_url } = data;

    if (!dealership_url) {
      return NextResponse.json(
        { success: false, error: 'dealership_url is required' },
        { status: 400 }
      );
    }

    // Call the AI scores endpoint with proper authentication
    const scoresResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/ai-scores?origin=${encodeURIComponent(dealership_url)}&includeEvidence=true`, {
      headers: {
        'X-API-Key': process.env.EXTERNAL_GPT_API_KEY || 'demo-key-for-testing',
        'Content-Type': 'application/json'
      }
    });

    if (!scoresResponse.ok) {
      throw new Error(`AI Scores API returned ${scoresResponse.status}`);
    }

    const scores = await scoresResponse.json();

    // Also trigger a refresh job for fresh data
    const refreshResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/refresh`, {
      method: 'POST',
      headers: {
        'X-API-Key': process.env.EXTERNAL_GPT_API_KEY || 'demo-key-for-testing',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        origin: dealership_url,
        force: false
      })
    });

    let refreshJob = null;
    if (refreshResponse.ok) {
      refreshJob = await refreshResponse.json();
    }

    return NextResponse.json({
      success: true,
      data: {
        scores,
        refreshJob,
        dealership_url,
        timestamp: new Date().toISOString(),
        analysis_summary: {
          aiVisibilityIndex: scores.scores?.aiVisibilityIndex || 0,
          revenueAtRisk: scores.scores?.revenueAtRiskUSD || 0,
          keyThreats: scores.threats?.map((t: any) => `${t.category}: ${t.impact}`) || [],
          recommendations: generateRecommendations(scores.scores, scores.threats)
        }
      },
    });

  } catch (error) {
    console.error('Dealership analysis error:', error);
    return NextResponse.json(
      { success: false, error: 'Analysis failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

async function handleContentGeneration(data: any): Promise<NextResponse> {
  try {
    const { content, prompt } = data;

    if (!content && !prompt) {
      return NextResponse.json(
        { success: false, error: 'content or prompt is required' },
        { status: 400 }
      );
    }

    // Call AI story generation
    const storyResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/ai/story`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: prompt || `Generate content based on: ${content}`,
        context: content,
      }),
    });

    const story = await storyResponse.json();

    return NextResponse.json({
      success: true,
      data: story,
      generated_at: new Date().toISOString(),
    });

  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Content generation failed' },
      { status: 500 }
    );
  }
}

function generateRecommendations(scores: any, threats: any[]): string[] {
  const recommendations: string[] = [];

  if (scores?.seoScore < 80) {
    recommendations.push("Optimize on-page SEO elements including title tags, meta descriptions, and header structure");
  }

  if (scores?.aeoScore < 75) {
    recommendations.push("Implement structured data markup for FAQ, LocalBusiness, and AutoDealer schemas");
    recommendations.push("Create comprehensive Q&A content to capture AI-powered search queries");
  }

  if (scores?.geoScore < 85) {
    recommendations.push("Optimize Google Business Profile with complete information and regular updates");
    recommendations.push("Build local citation consistency across directory platforms");
  }

  if (scores?.websiteHealth < 90) {
    recommendations.push("Improve Core Web Vitals: focus on Largest Contentful Paint and Cumulative Layout Shift");
  }

  // Add threat-specific recommendations
  threats?.forEach(threat => {
    if (threat.category === "UGC/Reviews") {
      recommendations.push("Implement automated review response system to improve response times");
    }
    if (threat.category === "AI Search" && threat.severity === "High") {
      recommendations.push("Create authoritative content targeting high-intent automotive queries");
    }
  });

  return recommendations.slice(0, 5); // Limit to top 5 recommendations
}

function generateSchemaFromAnalysis(analysisData: any, schemaType: string = 'dealership') {
  const baseSchema = {
    "@context": "https://schema.org",
    "@type": "AutoDealer",
    "name": analysisData.dealership?.name || "Dealership",
    "url": analysisData.url,
    "address": {
      "@type": "PostalAddress",
      "streetAddress": analysisData.dealership?.address?.street || "",
      "addressLocality": analysisData.dealership?.address?.city || "",
      "addressRegion": analysisData.dealership?.address?.state || "",
      "postalCode": analysisData.dealership?.address?.zip || "",
      "addressCountry": "US"
    },
    "telephone": analysisData.dealership?.phone || "",
    "email": analysisData.dealership?.email || "",
    "openingHours": analysisData.dealership?.hours || [],
    "paymentAccepted": ["Cash", "Credit Card", "Financing"],
    "priceRange": "$$",
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": analysisData.reviews?.average_rating || 4.0,
      "reviewCount": analysisData.reviews?.total_reviews || 0
    }
  };

  if (schemaType === 'vehicle') {
    return {
      "@context": "https://schema.org",
      "@type": "Car",
      "name": "Vehicle Listing",
      "brand": analysisData.vehicles?.[0]?.make || "",
      "model": analysisData.vehicles?.[0]?.model || "",
      "bodyType": analysisData.vehicles?.[0]?.type || "",
      "fuelType": "Gasoline",
      "offers": {
        "@type": "Offer",
        "priceCurrency": "USD",
        "price": analysisData.vehicles?.[0]?.price || "0",
        "availability": "https://schema.org/InStock",
        "seller": baseSchema
      }
    };
  }

  return baseSchema;
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    message: "GPT Integration API is active",
    endpoints: {
      POST: {
        description: "Integrate with external GPT services",
        actions: ["schema_create", "analyze", "generate"],
        authentication: "API key optional"
      }
    },
    example_request: {
      action: "schema_create",
      data: {
        dealership_url: "https://exampledealer.com",
        schema_type: "dealership"
      },
      api_key: "optional_api_key"
    }
  });
}