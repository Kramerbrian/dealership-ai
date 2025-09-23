'use client'

import React, { useState, useEffect } from 'react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { Activity, TrendingUp, AlertTriangle, CheckCircle, Clock, Zap } from 'lucide-react'

interface SystemMetrics {
  timestamp: string
  uptime: number
  api_metrics: Array<{
    endpoint: string
    method: string
    average_latency_ms: number
    request_count: number
    error_rate: number
    last_24h: {
      requests: number
      errors: number
      avg_latency_ms: number
    }
  }>
  system_metrics: {
    memory: {
      heap_used_mb: number
      heap_total_mb: number
      usage_percentage: number
    }
    cpu: {
      user_time_ms: number
      system_time_ms: number
    }
    node: {
      version: string
      uptime_seconds: number
    }
  }
  performance_summary: {
    total_requests: number
    average_response_time_ms: number
    error_rate_percentage: number
    uptime_percentage: number
  }
}

interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded'
  timestamp: string
  checks: Array<{
    service: string
    status: 'healthy' | 'unhealthy' | 'degraded'
    responseTime?: number
    error?: string
  }>
}

const MetricCard = ({ title, value, change, trend, icon: Icon, color = 'blue' }: {
  title: string
  value: string | number
  change?: number
  trend?: 'up' | 'down'
  icon: React.ComponentType<any>
  color?: string
}) => {
  const colorClasses = {
    blue: 'border-blue-500 bg-blue-500/10 text-blue-400',
    green: 'border-green-500 bg-green-500/10 text-green-400',
    orange: 'border-orange-500 bg-orange-500/10 text-orange-400',
    red: 'border-red-500 bg-red-500/10 text-red-400',
    purple: 'border-purple-500 bg-purple-500/10 text-purple-400'
  }

  return (
    <div className={`rounded-xl border p-4 ${colorClasses[color as keyof typeof colorClasses]} bg-opacity-20`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-400">{title}</p>
          <p className="text-2xl font-bold text-white">{value}</p>
          {change !== undefined && (
            <div className={`flex items-center mt-1 text-sm ${trend === 'up' ? 'text-green-400' : 'text-red-400'}`}>
              <span>{trend === 'up' ? '↗' : '↘'} {Math.abs(change)}%</span>
            </div>
          )}
        </div>
        <Icon className="w-8 h-8" />
      </div>
    </div>
  )
}

export default function AnalyticsDashboard() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null)
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [metricsRes, healthRes] = await Promise.all([
          fetch('/api/metrics'),
          fetch('/api/health')
        ])

        if (metricsRes.ok) {
          const metricsData = await metricsRes.json()
          setMetrics(metricsData)
        }

        if (healthRes.ok) {
          const healthData = await healthRes.json()
          setHealth(healthData)
        }

        setLoading(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch data')
        setLoading(false)
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 30000) // Refresh every 30 seconds

    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="p-8 bg-gray-900 min-h-screen text-white">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-700 rounded w-64 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-700 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 bg-gray-900 min-h-screen text-white">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Failed to Load Analytics</h2>
          <p className="text-gray-400">{error}</p>
        </div>
      </div>
    )
  }

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    return `${days}d ${hours}h ${mins}m`
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-400'
      case 'degraded': return 'text-yellow-400'
      case 'unhealthy': return 'text-red-400'
      default: return 'text-gray-400'
    }
  }

  // Prepare chart data
  const apiLatencyData = metrics?.api_metrics.map(api => ({
    name: `${api.method} ${api.endpoint.replace('/api/', '')}`,
    latency: api.average_latency_ms,
    requests: api.request_count,
    errors: api.last_24h.errors
  })).slice(0, 8) || []

  const memoryData = [
    { name: 'Used', value: metrics?.system_metrics.memory.heap_used_mb || 0 },
    { name: 'Free', value: (metrics?.system_metrics.memory.heap_total_mb || 0) - (metrics?.system_metrics.memory.heap_used_mb || 0) }
  ]

  return (
    <div className="p-8 bg-gray-900 min-h-screen text-white">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">System Analytics</h1>
        <p className="text-gray-400">Real-time performance monitoring and system health</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <MetricCard
          title="Total Requests"
          value={metrics?.performance_summary.total_requests.toLocaleString() || '0'}
          icon={Activity}
          color="blue"
        />
        <MetricCard
          title="Avg Response Time"
          value={`${metrics?.performance_summary.average_response_time_ms || 0}ms`}
          icon={Clock}
          color="green"
        />
        <MetricCard
          title="Error Rate"
          value={`${metrics?.performance_summary.error_rate_percentage || 0}%`}
          icon={AlertTriangle}
          color={metrics && metrics.performance_summary.error_rate_percentage > 5 ? 'red' : 'green'}
        />
        <MetricCard
          title="Uptime"
          value={`${metrics?.performance_summary.uptime_percentage || 0}%`}
          icon={CheckCircle}
          color="green"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* API Performance Chart */}
        <div className="bg-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5" />
            API Response Times
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={apiLatencyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="name" stroke="#9CA3AF" fontSize={10} />
                <YAxis stroke="#9CA3AF" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: '1px solid #374151',
                    borderRadius: '8px'
                  }}
                />
                <Bar dataKey="latency" fill="#3B82F6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Memory Usage */}
        <div className="bg-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Memory Usage
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={memoryData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}MB`}
                >
                  <Cell fill="#3B82F6" />
                  <Cell fill="#6B7280" />
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* System Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Health Checks */}
        <div className="bg-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            Service Health
          </h3>
          <div className="space-y-3">
            {health?.checks.map((check, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${
                    check.status === 'healthy' ? 'bg-green-400' :
                    check.status === 'degraded' ? 'bg-yellow-400' : 'bg-red-400'
                  }`}></div>
                  <span className="font-medium capitalize">{check.service.replace('_', ' ')}</span>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-medium ${getStatusColor(check.status)}`}>
                    {check.status}
                  </div>
                  {check.responseTime && (
                    <div className="text-xs text-gray-400">{check.responseTime}ms</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* System Info */}
        <div className="bg-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            System Information
          </h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-400">Uptime</div>
                <div className="font-semibold">{formatUptime(metrics?.uptime || 0)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-400">Node Version</div>
                <div className="font-semibold">{metrics?.system_metrics.node.version || 'Unknown'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-400">Memory Usage</div>
                <div className="font-semibold">{metrics?.system_metrics.memory.usage_percentage || 0}%</div>
              </div>
              <div>
                <div className="text-sm text-gray-400">Environment</div>
                <div className="font-semibold capitalize">{process.env.NODE_ENV || 'development'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* API Endpoints Table */}
      <div className="bg-gray-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4">API Performance Details</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-700">
              <tr>
                <th className="text-left py-3 px-4">Endpoint</th>
                <th className="text-left py-3 px-4">Method</th>
                <th className="text-right py-3 px-4">Requests</th>
                <th className="text-right py-3 px-4">Avg Latency</th>
                <th className="text-right py-3 px-4">Error Rate</th>
              </tr>
            </thead>
            <tbody>
              {metrics?.api_metrics.map((api, index) => (
                <tr key={index} className="border-b border-gray-700/50">
                  <td className="py-3 px-4 font-mono text-xs">{api.endpoint}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      api.method === 'GET' ? 'bg-green-100 text-green-800' :
                      api.method === 'POST' ? 'bg-blue-100 text-blue-800' :
                      api.method === 'PUT' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {api.method}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">{api.request_count.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right">{Math.round(api.average_latency_ms)}ms</td>
                  <td className="py-3 px-4 text-right">
                    <span className={api.error_rate > 5 ? 'text-red-400' : 'text-green-400'}>
                      {api.error_rate.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}