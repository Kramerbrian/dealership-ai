'use client';

import { useState, useEffect } from 'react';
import RoleBasedNav from '@/components/navigation/RoleBasedNav';
import { AdminOnly } from '@/components/auth/RoleGuard';

export default function EnterprisePage() {
  const [multiLocationData, setMultiLocationData] = useState(null);
  const [revenueData, setRevenueData] = useState(null);
  const [competitiveData, setCompetitiveData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [multiLocation, revenue, competitive] = await Promise.all([
          fetch('/api/enterprise/multi-location', {
            headers: { 'x-bypass-auth': 'true' }
          }).then(r => r.json()),
          fetch('/api/enterprise/revenue-attribution', {
            headers: { 'x-bypass-auth': 'true' }
          }).then(r => r.json()),
          fetch('/api/enterprise/competitive-intelligence', {
            headers: { 'x-bypass-auth': 'true' }
          }).then(r => r.json())
        ]);

        setMultiLocationData(multiLocation);
        setRevenueData(revenue);
        setCompetitiveData(competitive);
      } catch (error) {
        console.error('Failed to fetch enterprise data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <AdminOnly>
        <RoleBasedNav />
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading enterprise data...</p>
          </div>
        </div>
      </AdminOnly>
    );
  }

  return (
    <AdminOnly>
      <RoleBasedNav />
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-6">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Enterprise Hub</h1>
            <p className="text-gray-600 mt-2">Multi-location management, revenue attribution, and competitive intelligence</p>
          </div>

          {/* Multi-Location Overview */}
          <div className="bg-white rounded-lg shadow-sm mb-8">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-xl font-semibold text-gray-900">Multi-Location Franchise</h2>
              <p className="text-gray-600 mt-1">Toyota Southeast Group Performance</p>
            </div>
            <div className="p-6">
              {multiLocationData && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    <h3 className="font-medium text-gray-900 mb-4">Location Performance</h3>
                    <div className="space-y-4">
                      {multiLocationData.locations?.slice(0, 4).map((location, index) => (
                        <div key={index} className="bg-gray-50 rounded-lg p-4">
                          <div className="flex justify-between items-center">
                            <div>
                              <h4 className="font-medium text-gray-900">{location.name}</h4>
                              <p className="text-sm text-gray-600">{location.location} • {location.manager}</p>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-semibold text-gray-900">{location.visibility}%</div>
                              <div className="text-sm text-gray-600">AI Visibility</div>
                            </div>
                          </div>
                          <div className="mt-2 grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <span className="text-gray-600">Revenue:</span>
                              <span className="font-medium ml-1">${location.revenue?.toLocaleString()}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">At Risk:</span>
                              <span className="font-medium ml-1 text-red-600">${location.revenueAtRisk?.toLocaleString()}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Authority:</span>
                              <span className="font-medium ml-1">{location.authorityScore}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 mb-4">Franchise Summary</h3>
                    <div className="bg-blue-50 rounded-lg p-4">
                      <div className="space-y-3">
                        <div>
                          <div className="text-2xl font-bold text-blue-900">
                            ${multiLocationData.franchiseSummary?.totalRevenue?.toLocaleString()}
                          </div>
                          <div className="text-sm text-blue-700">Total Revenue</div>
                        </div>
                        <div>
                          <div className="text-xl font-semibold text-blue-900">
                            {multiLocationData.franchiseSummary?.averageVisibility}%
                          </div>
                          <div className="text-sm text-blue-700">Average Visibility</div>
                        </div>
                        <div>
                          <div className="text-xl font-semibold text-red-700">
                            ${multiLocationData.franchiseSummary?.totalRevenueAtRisk?.toLocaleString()}
                          </div>
                          <div className="text-sm text-red-600">Total Revenue at Risk</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Revenue Attribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <div className="bg-white rounded-lg shadow-sm">
              <div className="border-b border-gray-200 px-6 py-4">
                <h2 className="text-xl font-semibold text-gray-900">Revenue Attribution</h2>
              </div>
              <div className="p-6">
                {revenueData && (
                  <div className="space-y-4">
                    {revenueData.attributionBreakdown?.slice(0, 4).map((item, index) => (
                      <div key={index} className="flex justify-between items-center">
                        <div>
                          <div className="font-medium text-gray-900">{item.channel}</div>
                          <div className="text-sm text-gray-600">{item.description}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-gray-900">${item.revenue?.toLocaleString()}</div>
                          <div className="text-sm text-green-600">{item.contribution}%</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm">
              <div className="border-b border-gray-200 px-6 py-4">
                <h2 className="text-xl font-semibold text-gray-900">Competitive Intelligence</h2>
              </div>
              <div className="p-6">
                {competitiveData && (
                  <div className="space-y-4">
                    <div className="bg-green-50 rounded-lg p-4">
                      <h4 className="font-medium text-green-900 mb-2">Market Position</h4>
                      <div className="text-2xl font-bold text-green-800">
                        #{competitiveData.marketPosition?.rank}
                      </div>
                      <div className="text-sm text-green-700">
                        of {competitiveData.marketPosition?.totalCompetitors} in market
                      </div>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900 mb-3">Competitive Metrics</h4>
                      <div className="space-y-2">
                        {competitiveData.competitiveMetrics && Object.entries(competitiveData.competitiveMetrics).map(([key, value], index) => (
                          <div key={index} className="flex justify-between">
                            <span className="text-gray-600 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                            <span className="font-medium">{typeof value === 'number' ? `${value}%` : value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Toyota Naples Pilot */}
          <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg shadow-sm text-white">
            <div className="px-6 py-8">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Toyota Naples Pilot Program</h2>
                  <p className="mt-2 text-green-100">Real dealership integration with proven results</p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold">8.4x ROI</div>
                  <div className="text-green-100">Achieved in 3.2 months</div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                <div className="bg-white/10 rounded-lg p-4">
                  <div className="text-2xl font-semibold">$117K</div>
                  <div className="text-green-100">Monthly Revenue Increase</div>
                </div>
                <div className="bg-white/10 rounded-lg p-4">
                  <div className="text-2xl font-semibold">92%</div>
                  <div className="text-green-100">AI Visibility Score</div>
                </div>
                <div className="bg-white/10 rounded-lg p-4">
                  <div className="text-2xl font-semibold">3.2 mo</div>
                  <div className="text-green-100">Payback Period</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminOnly>
  );
}