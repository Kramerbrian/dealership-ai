'use client';

import { useSession } from 'next-auth/react';
import { ReactNode } from 'react';

interface RoleGuardProps {
  children: ReactNode;
  roles?: string[];
  dealerId?: string;
  fallback?: ReactNode;
  requireDealer?: boolean;
  requireActivated?: boolean;
}

export default function RoleGuard({
  children,
  roles = [],
  dealerId,
  fallback = null,
  requireDealer = false,
  requireActivated = true,
}: RoleGuardProps) {
  const { data: session, status } = useSession();

  // Show loading state
  if (status === 'loading') {
    return (
      <div className="animate-pulse bg-gray-200 rounded h-8 w-48" />
    );
  }

  // Not authenticated
  if (status === 'unauthenticated' || !session) {
    return <>{fallback}</>;
  }

  const user = session.user as any;
  const userRole = user?.role || 'user';
  const userDealerId = user?.dealerId;
  const isActive = user?.isActive !== false;

  // Check activation status
  if (requireActivated && !isActive) {
    return <>{fallback}</>;
  }

  // Check role permissions
  if (roles.length > 0 && !roles.includes(userRole)) {
    return <>{fallback}</>;
  }

  // Check dealer requirement
  if (requireDealer && !userDealerId) {
    return <>{fallback}</>;
  }

  // Check specific dealer access
  if (dealerId) {
    // Admins can access any dealer
    if (userRole === 'admin') {
      return <>{children}</>;
    }

    // Users must match dealer ID
    if (userDealerId !== dealerId) {
      return <>{fallback}</>;
    }
  }

  return <>{children}</>;
}

// Helper hook for role checking
export function useRoles() {
  const { data: session } = useSession();

  const user = session?.user as any;
  const role = user?.role || 'user';
  const dealerId = user?.dealerId;
  const isActive = user?.isActive !== false;

  return {
    isAdmin: role === 'admin',
    isDealer: role === 'dealer',
    isUser: role === 'user',
    hasRole: (requiredRole: string) => role === requiredRole,
    hasAnyRole: (requiredRoles: string[]) => requiredRoles.includes(role),
    canAccessDealer: (targetDealerId: string) => {
      if (role === 'admin') return true;
      return dealerId === targetDealerId;
    },
    dealerId,
    role,
    isActive,
    isAuthenticated: !!session,
  };
}

// Component for admin-only content
export function AdminOnly({
  children,
  fallback = null
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <RoleGuard roles={['admin']} fallback={fallback}>
      {children}
    </RoleGuard>
  );
}

// Component for dealer-level access (admins + dealers)
export function DealerAccess({
  children,
  fallback = null
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <RoleGuard roles={['admin', 'dealer']} fallback={fallback}>
      {children}
    </RoleGuard>
  );
}

// Component for any authenticated user
export function AuthenticatedOnly({
  children,
  fallback = <div className="text-gray-500">Please sign in to view this content.</div>
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <RoleGuard roles={['admin', 'dealer', 'user']} fallback={fallback}>
      {children}
    </RoleGuard>
  );
}