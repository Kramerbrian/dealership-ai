import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

export type UserRole = 'admin' | 'dealer' | 'user';

export interface AuthRequest extends NextRequest {
  user?: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    dealerId?: string;
  };
}

export interface AuthOptions {
  roles?: UserRole[];
  requireDealerId?: boolean;
  bypassInDevelopment?: boolean;
}

/**
 * Higher-order function that creates authentication middleware for API routes
 */
export function withAuth(
  handler: (req: AuthRequest) => Promise<NextResponse>,
  options: AuthOptions = {}
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const {
      roles = [],
      requireDealerId = false,
      bypassInDevelopment = true
    } = options;

    // Development bypass for easier testing
    if (bypassInDevelopment && process.env.NODE_ENV === 'development') {
      const bypassHeader = req.headers.get('x-bypass-auth');
      if (bypassHeader) {
        // Add mock user for development
        (req as AuthRequest).user = {
          id: 'dev-user',
          email: 'dev@dealershipai.com',
          name: 'Development User',
          role: 'admin',
          dealerId: 'toyota-naples'
        };
        return handler(req as AuthRequest);
      }
    }

    try {
      // Get JWT token from the request
      const token = await getToken({
        req,
        secret: process.env.NEXTAUTH_SECRET
      });

      if (!token) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }

      // Extract user information from token
      const user = {
        id: token.sub as string,
        email: token.email as string,
        name: token.name as string,
        role: token.role as UserRole,
        dealerId: token.dealerId as string | undefined
      };

      // Role-based authorization
      if (roles.length > 0 && !roles.includes(user.role)) {
        return NextResponse.json(
          {
            error: 'Insufficient permissions',
            required: roles,
            current: user.role
          },
          { status: 403 }
        );
      }

      // Dealer ID requirement check
      if (requireDealerId && !user.dealerId) {
        return NextResponse.json(
          { error: 'Dealer association required' },
          { status: 403 }
        );
      }

      // Add user to request object
      (req as AuthRequest).user = user;

      return handler(req as AuthRequest);

    } catch (error) {
      console.error('Auth middleware error:', error);
      return NextResponse.json(
        { error: 'Authentication verification failed' },
        { status: 500 }
      );
    }
  };
}

/**
 * Convenience function for admin-only routes
 */
export function withAdminAuth(handler: (req: AuthRequest) => Promise<NextResponse>) {
  return withAuth(handler, { roles: ['admin'] });
}

/**
 * Convenience function for dealer-only routes
 */
export function withDealerAuth(handler: (req: AuthRequest) => Promise<NextResponse>) {
  return withAuth(handler, { roles: ['admin', 'dealer'], requireDealerId: true });
}

/**
 * Convenience function for any authenticated user
 */
export function withUserAuth(handler: (req: AuthRequest) => Promise<NextResponse>) {
  return withAuth(handler, { roles: ['admin', 'dealer', 'user'] });
}

/**
 * Middleware for checking dealer ownership of resources
 */
export function checkDealerAccess(
  requestedDealerId: string | undefined,
  userDealerId: string | undefined,
  userRole: UserRole
): boolean {
  // Admins can access any dealer's data
  if (userRole === 'admin') {
    return true;
  }

  // Users must match dealer ID
  if (userRole === 'dealer' || userRole === 'user') {
    return userDealerId === requestedDealerId;
  }

  return false;
}

/**
 * Extract dealer ID from request parameters or query
 */
export function getDealerIdFromRequest(req: NextRequest): string | undefined {
  const { searchParams, pathname } = new URL(req.url);

  // Check query parameters
  const queryDealerId = searchParams.get('dealerId');
  if (queryDealerId) return queryDealerId;

  // Check path parameters (e.g., /api/dealer/toyota-naples/...)
  const pathSegments = pathname.split('/');
  const dealerIndex = pathSegments.indexOf('dealer');
  if (dealerIndex !== -1 && pathSegments[dealerIndex + 1]) {
    return pathSegments[dealerIndex + 1];
  }

  return undefined;
}

/**
 * Rate limiting by user role
 */
export function getRateLimitByRole(role: UserRole): { requests: number; windowMs: number } {
  switch (role) {
    case 'admin':
      return { requests: 1000, windowMs: 60 * 1000 }; // 1000/minute
    case 'dealer':
      return { requests: 500, windowMs: 60 * 1000 }; // 500/minute
    case 'user':
      return { requests: 100, windowMs: 60 * 1000 }; // 100/minute
    default:
      return { requests: 50, windowMs: 60 * 1000 }; // 50/minute
  }
}

/**
 * Audit logging for protected routes
 */
export function logApiAccess(
  user: AuthRequest['user'],
  endpoint: string,
  method: string,
  success: boolean = true
) {
  const logData = {
    timestamp: new Date().toISOString(),
    userId: user?.id,
    userEmail: user?.email,
    userRole: user?.role,
    dealerId: user?.dealerId,
    endpoint,
    method,
    success,
    userAgent: 'api-access'
  };

  // In production, this would go to a proper logging service
  console.log('API_ACCESS:', JSON.stringify(logData));
}