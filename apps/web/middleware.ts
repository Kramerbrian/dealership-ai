import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protected API routes that require authentication
  const protectedRoutes = [
    '/api/dashboard/enhanced',
    '/api/advanced-kpis',
    '/api/visibility',
    '/api/prompts',
    '/api/v1/probe'
  ];

  const isProtectedRoute = protectedRoutes.some(route =>
    pathname.startsWith(route)
  );

  if (isProtectedRoute) {
    // Check for API key in headers
    const apiKey = request.headers.get('x-api-key') ||
                   request.headers.get('authorization')?.replace('Bearer ', '');

    // For development, accept any API key or bypass auth
    if (process.env.NODE_ENV === 'development') {
      if (!apiKey && !request.headers.get('x-bypass-auth')) {
        return NextResponse.json(
          {
            error: 'API key required',
            hint: 'Add x-api-key header or x-bypass-auth header for development'
          },
          { status: 401 }
        );
      }
      return NextResponse.next();
    }

    // Production authentication
    const validApiKey = process.env.API_KEY || 'dealership-ai-key-2024';

    if (!apiKey || apiKey !== validApiKey) {
      return NextResponse.json(
        { error: 'Invalid or missing API key' },
        { status: 401 }
      );
    }
  }

  // Rate limiting for API routes (basic implementation)
  if (pathname.startsWith('/api/')) {
    const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';

    // Simple rate limiting - could be enhanced with Redis or external service
    const rateLimit = {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 100,
    };

    // In production, implement proper rate limiting with Redis
    // For now, just add headers to indicate rate limiting is active
    const response = NextResponse.next();
    response.headers.set('X-RateLimit-Limit', rateLimit.maxRequests.toString());
    response.headers.set('X-RateLimit-Window', (rateLimit.windowMs / 1000).toString());

    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/api/:path*'
  ]
};