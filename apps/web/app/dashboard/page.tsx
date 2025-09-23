'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import RoleBasedNav from '@/components/navigation/RoleBasedNav';
import RoleBasedDashboard from '@/components/dashboard/RoleBasedDashboard';
import { AdminOnly, DealerAccess, useRoles } from '@/components/auth/RoleGuard';

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { isAdmin, isDealer, dealerId, role } = useRoles();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const { user } = session;

  return (
    <>
      <RoleBasedNav />
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-6">
          <RoleBasedDashboard />
        </div>
      </div>
    </>
  );
}