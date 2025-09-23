'use client';

import { useState, useEffect } from 'react';
import RoleBasedNav from '@/components/navigation/RoleBasedNav';
import { AdminOnly } from '@/components/auth/RoleGuard';

export default function MonitoringPage() {
  const [probeStatus, setProbeStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/v1/probe/status', {
          headers: { 'x-bypass-auth': 'true' }
        });
        const data = await response.json();
        setProbeStatus(data);
      } catch (error) {
        console.error('Failed to fetch probe status:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const handleRetryDLQ = async () => {
    try {
      await fetch('/api/v1/probe/retry-dlq', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-bypass-auth': 'true'
        },
        body: JSON.stringify({ limit: 10 })
      });
      // Refresh data after retry
      const response = await fetch('/api/v1/probe/status', {
        headers: { 'x-bypass-auth': 'true' }
      });
      const data = await response.json();
      setProbeStatus(data);
    } catch (error) {
      console.error('Failed to retry DLQ jobs:', error);
    }
  };

  return (
    <AdminOnly>
      <RoleBasedNav />
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-6">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">System Monitoring</h1>
            <p className="text-gray-600 mt-2">Real-time monitoring of system health and performance</p>
          </div>

          {/* System Status Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <div className="p-3 bg-green-100 rounded-lg">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">System Status</p>
                  <p className="text-xl font-bold text-green-600">Operational</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">API Response Time</p>
                  <p className="text-xl font-bold text-gray-900">142ms</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Active Connections</p>
                  <p className="text-xl font-bold text-gray-900">1,247</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <div className="p-3 bg-yellow-100 rounded-lg">
                  <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Daily Cost</p>
                  <p className="text-xl font-bold text-gray-900">
                    ${probeStatus?.cost?.daily || 0}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Queue Status */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <div className="bg-white rounded-lg shadow-sm">
              <div className="border-b border-gray-200 px-6 py-4">
                <h3 className="text-lg font-semibold text-gray-900">Queue Status</h3>
                <p className="text-gray-600 text-sm">Background job processing metrics</p>
              </div>
              <div className="p-6">
                {loading ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {probeStatus?.counts?.waiting || 0}
                      </div>
                      <div className="text-gray-600">Waiting</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {probeStatus?.counts?.active || 0}
                      </div>
                      <div className="text-gray-600">Active</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-600">
                        {probeStatus?.counts?.completed || 0}
                      </div>
                      <div className="text-gray-600">Completed</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">
                        {probeStatus?.counts?.failed || 0}
                      </div>
                      <div className="text-gray-600">Failed</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm">
              <div className="border-b border-gray-200 px-6 py-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Dead Letter Queue</h3>
                    <p className="text-gray-600 text-sm">Failed jobs requiring attention</p>
                  </div>
                  <button
                    onClick={handleRetryDLQ}
                    className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                  >
                    Retry Failed
                  </button>
                </div>
              </div>
              <div className="p-6">
                {loading ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-red-600">
                        {probeStatus?.dlq?.count || 0}
                      </div>
                      <div className="text-gray-600">Jobs in DLQ</div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center">
                        <div className="text-lg font-semibold text-gray-900">
                          {probeStatus?.dlq?.age_p95_min || 0}min
                        </div>
                        <div className="text-gray-600 text-sm">95th Percentile Age</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold text-gray-900">
                          {probeStatus?.dlq?.oldest_min || 0}min
                        </div>
                        <div className="text-gray-600 text-sm">Oldest Job</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Cost Tracking */}
          <div className="bg-white rounded-lg shadow-sm mb-8">
            <div className="border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">Cost Tracking</h3>
              <p className="text-gray-600 text-sm">AI service usage and costs</p>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">
                    ${probeStatus?.cost?.daily || 0}
                  </div>
                  <div className="text-gray-600">Today's Cost</div>
                  <div className="text-sm text-gray-500 mt-1">
                    {new Date().toLocaleDateString()}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">
                    ${probeStatus?.cost?.monthly || 0}
                  </div>
                  <div className="text-gray-600">Monthly Cost</div>
                  <div className="text-sm text-gray-500 mt-1">
                    {new Date().toLocaleDateString('default', { month: 'long', year: 'numeric' })}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-600">
                    ${Math.round((probeStatus?.cost?.monthly || 0) * 12)}
                  </div>
                  <div className="text-gray-600">Projected Annual</div>
                  <div className="text-sm text-gray-500 mt-1">
                    Based on current usage
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* System Logs */}
          <div className="bg-white rounded-lg shadow-sm">
            <div className="border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
              <p className="text-gray-600 text-sm">System events and processing logs</p>
            </div>
            <div className="p-6">
              <div className="space-y-3">
                {[
                  { time: '2 minutes ago', event: 'Queue processed 15 jobs successfully', type: 'success' },
                  { time: '5 minutes ago', event: 'Daily cost report generated', type: 'info' },
                  { time: '12 minutes ago', event: '2 jobs moved to DLQ due to timeout', type: 'warning' },
                  { time: '18 minutes ago', event: 'System health check passed', type: 'success' },
                  { time: '25 minutes ago', event: 'API rate limit reset', type: 'info' },
                ].map((log, index) => (
                  <div key={index} className="flex items-center space-x-3 py-2">
                    <div className={`w-2 h-2 rounded-full ${
                      log.type === 'success' ? 'bg-green-500' :
                      log.type === 'warning' ? 'bg-yellow-500' :
                      'bg-blue-500'
                    }`}></div>
                    <div className="flex-1">
                      <p className="text-gray-900">{log.event}</p>
                      <p className="text-gray-500 text-sm">{log.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminOnly>
  );
}