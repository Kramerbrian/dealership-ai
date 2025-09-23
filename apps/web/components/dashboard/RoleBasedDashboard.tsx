'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { AdminOnly, DealerAccess, AuthenticatedOnly, useRoles } from '../auth/RoleGuard';
import InteractiveChart from '../charts/InteractiveChart';
// import DealerFilter, { DealerFilters } from '../filters/DealerFilter';
interface DealerFilters {
  dealerId?: string;
  timeRange?: string;
  metricType?: string;
  location?: string;
  brand?: string;
  tier?: number;
}

// Admin dashboard widgets
function AdminDashboardContent() {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<DealerFilters>({});

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const params = new URLSearchParams();
        if (filters.dealerId) params.append('dealerId', filters.dealerId);
        if (filters.timeRange) params.append('timeRange', filters.timeRange);
        if (filters.metricType) params.append('metricType', filters.metricType);
        if (filters.brand) params.append('brand', filters.brand);
        if (filters.tier) params.append('tier', filters.tier.toString());

        const response = await fetch(`/api/dashboard/enhanced?${params}`);
        const data = await response.json();
        setDashboardData(data);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [filters]);

  const handleFilterChange = (newFilters: DealerFilters) => {
    setFilters(newFilters);
    setLoading(true);
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-gray-200 rounded-lg h-24" />
          ))}
        </div>
        <div className="bg-gray-200 rounded-lg h-64" />
      </div>
    );
  }

  const systemMetrics = dashboardData?.systemMetrics || {
    totalUsers: 1247,
    activeDealers: 89,
    queueJobs: 2341,
    monthlyRevenue: 452000
  };

  return (
    <div className="space-y-6">
      {/* Temporarily disabled DealerFilter due to build issues */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-medium text-gray-900">Filters (Placeholder)</h3>
        <p className="text-gray-600">Filter functionality temporarily disabled during deployment</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">System Users</p>
              <p className="text-2xl font-bold text-gray-900">{systemMetrics.totalUsers.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active Dealers</p>
              <p className="text-2xl font-bold text-gray-900">{systemMetrics.activeDealers}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Queue Jobs</p>
              <p className="text-2xl font-bold text-gray-900">{systemMetrics.queueJobs.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Monthly Revenue</p>
              <p className="text-2xl font-bold text-gray-900">${(systemMetrics.monthlyRevenue / 1000).toFixed(1)}K</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <InteractiveChart
          title="System Performance Trends"
          type="line"
          data={dashboardData?.performanceTrends || [
            { name: 'Week 1', value: 95 },
            { name: 'Week 2', value: 98 },
            { name: 'Week 3', value: 94 },
            { name: 'Week 4', value: 99 }
          ]}
          color="#10B981"
          real-time={true}
          refreshInterval={60000}
        />

        <InteractiveChart
          title="Revenue Distribution"
          type="pie"
          data={dashboardData?.revenueDistribution || [
            { name: 'Vehicle Sales', value: 65 },
            { name: 'Service', value: 20 },
            { name: 'Parts', value: 10 },
            { name: 'Finance', value: 5 }
          ]}
          colors={['#3B82F6', '#10B981', '#F59E0B', '#EF4444']}
        />
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">System Health & Enterprise Monitoring</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-red-50 p-4 rounded-lg">
            <h4 className="font-medium text-red-800">Queue Management</h4>
            <p className="text-sm text-red-600 mt-1">Monitor probe job queues and DLQ status</p>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-medium text-blue-800">Enterprise Hub</h4>
            <p className="text-sm text-blue-600 mt-1">Multi-location franchises and revenue attribution</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <h4 className="font-medium text-green-800">Toyota Pilot</h4>
            <p className="text-sm text-green-600 mt-1">Real dealership integration with 8.4x ROI</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Dealer dashboard widgets
function DealerDashboardContent() {
  const { dealerId } = useRoles();
  const [dealerData, setDealerData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDealerData = async () => {
      try {
        const params = new URLSearchParams();
        if (dealerId) params.append('dealerId', dealerId);

        const response = await fetch(`/api/dashboard/enhanced?${params}`);
        const data = await response.json();
        setDealerData(data);
      } catch (error) {
        console.error('Failed to fetch dealer data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDealerData();
  }, [dealerId]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="bg-gray-200 rounded-lg h-16" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-gray-200 rounded-lg h-24" />
          ))}
        </div>
      </div>
    );
  }

  const dealerMetrics = dealerData?.dealerSpecific || {
    aiVisibility: 87,
    revenueAtRisk: 13000,
    authorityScore: 94,
    monthlyRevenue: 967000
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-medium text-blue-800">
              Dealer Dashboard • Location: {dealerId || 'Not assigned'}
            </p>
          </div>
          {dealerData?.lastUpdated && (
            <p className="text-xs text-blue-600">
              Last updated: {new Date(dealerData.lastUpdated).toLocaleTimeString()}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">AI Visibility</p>
              <p className="text-2xl font-bold text-gray-900">{dealerMetrics.aiVisibility}%</p>
              <p className="text-xs text-green-600">↑ 23% this month</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Revenue at Risk</p>
              <p className="text-2xl font-bold text-gray-900">${(dealerMetrics.revenueAtRisk / 1000).toFixed(0)}K</p>
              <p className="text-xs text-orange-600">↓ 38% from last month</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Authority Score</p>
              <p className="text-2xl font-bold text-gray-900">{dealerMetrics.authorityScore}</p>
              <p className="text-xs text-blue-600">Top 5% nationally</p>
            </div>
          </div>
        </div>
      </div>

      {dealerData?.pilotResults && (
        <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-6">
          <div className="flex items-center mb-4">
            <svg className="w-6 h-6 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900">Toyota Naples Pilot Success</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">8.4x</p>
              <p className="text-sm text-gray-600">ROI Multiplier</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">$117K</p>
              <p className="text-sm text-gray-600">Monthly Increase</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-600">3.2</p>
              <p className="text-sm text-gray-600">Payback Months</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-600">4.7/5</p>
              <p className="text-sm text-gray-600">Satisfaction</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <InteractiveChart
          title="AI Visibility Trends"
          type="area"
          data={dealerData?.visibilityTrends || [
            { name: 'Jan', value: 64 },
            { name: 'Feb', value: 71 },
            { name: 'Mar', value: 78 },
            { name: 'Apr', value: 84 },
            { name: 'May', value: 87 }
          ]}
          color="#10B981"
          real-time={true}
          apiEndpoint={`/api/dashboard/enhanced?dealerId=${dealerId}&metric=visibility`}
        />

        <InteractiveChart
          title="Revenue Impact"
          type="bar"
          data={dealerData?.revenueImpact || [
            { name: 'Voice Search', value: 47000 },
            { name: 'Competitive Intel', value: 34000 },
            { name: 'Lot Optimization', value: 32000 },
            { name: 'Radio Campaigns', value: 28000 }
          ]}
          color="#3B82F6"
        />
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button className="p-4 bg-blue-50 rounded-lg text-left hover:bg-blue-100 transition-colors">
            <h4 className="font-medium text-blue-900">View Analytics</h4>
            <p className="text-sm text-blue-600 mt-1">Check your SEO, AEO, and GEO performance</p>
          </button>
          <button className="p-4 bg-green-50 rounded-lg text-left hover:bg-green-100 transition-colors">
            <h4 className="font-medium text-green-900">AI Assistant</h4>
            <p className="text-sm text-green-600 mt-1">Get personalized recommendations</p>
          </button>
        </div>
      </div>
    </div>
  );
}

// Standard user dashboard widgets
function UserDashboardContent() {
  return (
    <div className="space-y-6">
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-center">
          <svg className="w-5 h-5 text-gray-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <p className="text-sm font-medium text-gray-800">User Dashboard • Limited Access</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">AI Assistant</p>
              <p className="text-lg font-bold text-gray-900">Available</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Account Status</p>
              <p className="text-lg font-bold text-gray-900">Active</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Available Features</h3>
        <div className="space-y-2">
          <div className="flex items-center text-sm text-gray-600">
            <svg className="w-4 h-4 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            AI Assistant Access
          </div>
          <div className="flex items-center text-sm text-gray-600">
            <svg className="w-4 h-4 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Basic Dashboard View
          </div>
          <div className="flex items-center text-sm text-gray-600">
            <svg className="w-4 h-4 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Settings Management
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RoleBasedDashboard() {
  const { data: session, status } = useSession();
  const { role, isAdmin, isDealer, dealerId } = useRoles();

  if (status === 'loading') {
    return (
      <div className="animate-pulse space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-gray-200 rounded-lg h-24" />
          ))}
        </div>
        <div className="bg-gray-200 rounded-lg h-64" />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="text-center py-12">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m4-5a4 4 0 11-8 0 4 4 0 018 0zm0 0v2" />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">Authentication Required</h3>
        <p className="mt-1 text-sm text-gray-500">Please sign in to access your dashboard.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Welcome, {session?.user?.name || session?.user?.email}
            </h1>
            <p className="text-sm text-gray-500">
              Role: <span className="font-medium capitalize">{role}</span>
              {dealerId && <span> • Dealer: {dealerId}</span>}
            </p>
          </div>
          <div className={`px-3 py-1 rounded-full text-xs font-medium ${
            isAdmin ? 'bg-red-100 text-red-800' :
            isDealer ? 'bg-blue-100 text-blue-800' :
            'bg-green-100 text-green-800'
          }`}>
            {role.toUpperCase()}
          </div>
        </div>
      </div>

      <AdminOnly>
        <AdminDashboardContent />
      </AdminOnly>

      <DealerAccess>
        {!isAdmin && <DealerDashboardContent />}
      </DealerAccess>

      {!isAdmin && !isDealer && (
        <AuthenticatedOnly>
          <UserDashboardContent />
        </AuthenticatedOnly>
      )}
    </div>
  );
}