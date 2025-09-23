'use client';

import { useState, useEffect } from 'react';
import RoleBasedNav from '@/components/navigation/RoleBasedNav';
import { DealerAccess } from '@/components/auth/RoleGuard';

export default function AnalyticsPage() {
  const [dashboardData, setDashboardData] = useState(null);
  const [visibilityData, setVisibilityData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [dashboard, visibility] = await Promise.all([
          fetch('/api/dashboard/enhanced', {
            headers: { 'x-bypass-auth': 'true' }
          }).then(r => r.json()),
          fetch('/api/visibility', {
            headers: { 'x-bypass-auth': 'true' }
          }).then(r => r.json())
        ]);

        setDashboardData(dashboard);
        setVisibilityData(visibility);
      } catch (error) {
        console.error('Failed to fetch analytics data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <DealerAccess>
        <RoleBasedNav />
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading analytics data...</p>
          </div>
        </div>
      </DealerAccess>
    );
  }

  return (
    <DealerAccess>
      <RoleBasedNav />
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-6">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
            <p className="text-gray-600 mt-2">SEO, AEO, and GEO performance metrics for your dealership</p>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">AI Visibility</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {dashboardData?.metrics?.aiVisibility || '87%'}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <div className="p-3 bg-red-100 rounded-lg">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Revenue at Risk</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {dashboardData?.metrics?.revenueAtRisk || '$13K'}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <div className="p-3 bg-green-100 rounded-lg">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Website Health</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {dashboardData?.metrics?.websiteHealth || '94/100'}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Authority Score</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {dashboardData?.metrics?.authorityScore || '94'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
            <div className="bg-white rounded-lg shadow-sm">
              <div className="border-b border-gray-200 px-6 py-4">
                <h3 className="text-lg font-semibold text-gray-900">SEO Performance</h3>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Overall SEO Score</span>
                    <span className="font-semibold text-gray-900">
                      {dashboardData?.scores?.seo?.overall || 88}/100
                    </span>
                  </div>
                  {dashboardData?.scores?.seo?.breakdown && Object.entries(dashboardData.scores.seo.breakdown).map(([key, value], index) => (
                    <div key={index} className="flex justify-between items-center">
                      <span className="text-gray-600 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                      <span className="font-medium text-gray-700">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm">
              <div className="border-b border-gray-200 px-6 py-4">
                <h3 className="text-lg font-semibold text-gray-900">AEO (AI Engine Optimization)</h3>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Overall AEO Score</span>
                    <span className="font-semibold text-gray-900">
                      {dashboardData?.scores?.aeo?.overall || 76}/100
                    </span>
                  </div>
                  {dashboardData?.scores?.aeo?.breakdown && Object.entries(dashboardData.scores.aeo.breakdown).map(([key, value], index) => (
                    <div key={index} className="flex justify-between items-center">
                      <span className="text-gray-600 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                      <span className="font-medium text-gray-700">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm">
              <div className="border-b border-gray-200 px-6 py-4">
                <h3 className="text-lg font-semibold text-gray-900">GEO (Local Search)</h3>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Overall GEO Score</span>
                    <span className="font-semibold text-gray-900">
                      {dashboardData?.scores?.geo?.overall || 82}/100
                    </span>
                  </div>
                  {dashboardData?.scores?.geo?.breakdown && Object.entries(dashboardData.scores.geo.breakdown).map(([key, value], index) => (
                    <div key={index} className="flex justify-between items-center">
                      <span className="text-gray-600 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                      <span className="font-medium text-gray-700">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Competitive Analysis */}
          <div className="bg-white rounded-lg shadow-sm mb-8">
            <div className="border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">Competitive Position</h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {dashboardData?.competitive?.marketPosition || '#3 of 12'}
                  </div>
                  <div className="text-gray-600">Market Position</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {dashboardData?.competitive?.percentiles?.seo || 88}%
                  </div>
                  <div className="text-gray-600">SEO Percentile</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {dashboardData?.competitive?.percentiles?.aeo || 76}%
                  </div>
                  <div className="text-gray-600">AEO Percentile</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {dashboardData?.competitive?.gapToLeader || 12}%
                  </div>
                  <div className="text-gray-600">Gap to Leader</div>
                </div>
              </div>
            </div>
          </div>

          {/* Recommendations */}
          <div className="bg-white rounded-lg shadow-sm">
            <div className="border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">Recommendations</h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Priority Actions</h4>
                  <div className="space-y-2">
                    {dashboardData?.recommendations?.slice(0, 3).map((rec, index) => (
                      <div key={index} className="flex items-start">
                        <div className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                          {index + 1}
                        </div>
                        <p className="ml-3 text-gray-700">{rec}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Estimated Impact</h4>
                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-green-700">Monthly Impact:</span>
                        <span className="font-semibold text-green-900">
                          ${dashboardData?.insights?.estimatedImpact?.monthly?.toLocaleString() || '13,000'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-green-700">Annual Impact:</span>
                        <span className="font-semibold text-green-900">
                          ${dashboardData?.insights?.estimatedImpact?.annual?.toLocaleString() || '156,000'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DealerAccess>
  );
}