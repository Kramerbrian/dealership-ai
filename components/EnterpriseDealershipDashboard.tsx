import React, { useState, useEffect, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, PieChart, Pie, Cell, LineChart, Line, Area, AreaChart
} from 'recharts'
import {
  Search, Filter, Download, Play, Pause, RotateCcw, TrendingUp,
  TrendingDown, AlertTriangle, CheckCircle, Clock, MapPin,
  Building2, Users, DollarSign, Target, Zap, Globe
} from 'lucide-react'

interface DealershipGroup {
  id: string
  name: string
  type: 'oem' | 'dealer_group' | 'independent'
  total_rooftops: number
  markets_covered: number
  avg_ai_visibility: number
  high_performers: number
  underperformers: number
  total_revenue_at_risk: number
  total_opportunity: number
  avg_market_rank: number
}

interface GeographicMarket {
  id: string
  name: string
  market_code: string
  state_code: string
  total_dealerships: number
  avg_ai_visibility: number
  total_revenue_at_risk: number
  total_recovery_potential: number
  market_leader: string
}

interface BulkJob {
  id: string
  job_name: string
  job_type: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  total_dealerships: number
  completed_dealerships: number
  failed_dealerships: number
  progress_pct: number
  created_at: string
  estimated_completion?: string
}

interface DashboardFilters {
  dealershipGroup?: string
  geographicMarket?: string
  franchiseType?: string
  performanceLevel?: string
  brands?: string[]
  timeframe?: '24h' | '7d' | '30d' | '90d'
}

interface EnterpriseDashboardProps {
  userId?: string
  accessLevel?: 'admin' | 'manager' | 'analyst'
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8']

export const EnterpriseDealershipDashboard: React.FC<EnterpriseDashboardProps> = ({
  userId,
  accessLevel = 'analyst'
}) => {
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<DashboardFilters>({ timeframe: '7d' })
  const [activeTab, setActiveTab] = useState<'overview' | 'groups' | 'markets' | 'jobs' | 'analytics'>('overview')

  // Mock data - in production this would come from APIs
  const [dealershipGroups, setDealershipGroups] = useState<DealershipGroup[]>([])
  const [geographicMarkets, setGeographicMarkets] = useState<GeographicMarket[]>([])
  const [bulkJobs, setBulkJobs] = useState<BulkJob[]>([])
  const [summaryStats, setSummaryStats] = useState({
    total_dealerships: 5247,
    active_dealerships: 5180,
    avg_ai_visibility: 64.2,
    high_performers: 1876,
    underperformers: 1243,
    total_revenue_at_risk: 47850000,
    total_opportunity: 31200000,
    markets_covered: 156,
    running_jobs: 3
  })

  useEffect(() => {
    loadDashboardData()
  }, [filters])

  const loadDashboardData = async () => {
    setLoading(true)
    try {
      // Simulate API calls
      await Promise.all([
        loadDealershipGroups(),
        loadGeographicMarkets(),
        loadBulkJobs(),
        loadSummaryStats()
      ])
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadDealershipGroups = async () => {
    // Mock data - replace with actual API call
    const mockGroups: DealershipGroup[] = [
      {
        id: '1',
        name: 'AutoNation',
        type: 'dealer_group',
        total_rooftops: 326,
        markets_covered: 15,
        avg_ai_visibility: 72.4,
        high_performers: 187,
        underperformers: 45,
        total_revenue_at_risk: 8450000,
        total_opportunity: 5200000,
        avg_market_rank: 3.2
      },
      {
        id: '2',
        name: 'Toyota Motor Sales',
        type: 'oem',
        total_rooftops: 1247,
        markets_covered: 48,
        avg_ai_visibility: 68.9,
        high_performers: 623,
        underperformers: 234,
        total_revenue_at_risk: 15600000,
        total_opportunity: 11800000,
        avg_market_rank: 4.1
      },
      {
        id: '3',
        name: 'Penske Automotive',
        type: 'dealer_group',
        total_rooftops: 285,
        markets_covered: 22,
        avg_ai_visibility: 75.1,
        high_performers: 201,
        underperformers: 28,
        total_revenue_at_risk: 3200000,
        total_opportunity: 4500000,
        avg_market_rank: 2.8
      }
    ]
    setDealershipGroups(mockGroups)
  }

  const loadGeographicMarkets = async () => {
    const mockMarkets: GeographicMarket[] = [
      {
        id: '1',
        name: 'Los Angeles-Long Beach-Santa Ana',
        market_code: 'DMA803',
        state_code: 'CA',
        total_dealerships: 247,
        avg_ai_visibility: 71.2,
        total_revenue_at_risk: 12400000,
        total_recovery_potential: 8900000,
        market_leader: 'Toyota of Hollywood'
      },
      {
        id: '2',
        name: 'New York-Newark-Bridgeport',
        market_code: 'DMA501',
        state_code: 'NY',
        total_dealerships: 189,
        avg_ai_visibility: 69.8,
        total_revenue_at_risk: 9800000,
        total_recovery_potential: 7200000,
        market_leader: 'Manhattan Honda'
      }
    ]
    setGeographicMarkets(mockMarkets)
  }

  const loadBulkJobs = async () => {
    const mockJobs: BulkJob[] = [
      {
        id: '1',
        job_name: 'Q4 2024 Full Analysis - All Toyota Dealerships',
        job_type: 'full_analysis',
        status: 'running',
        total_dealerships: 1247,
        completed_dealerships: 856,
        failed_dealerships: 12,
        progress_pct: 68.6,
        created_at: '2024-03-15T10:30:00Z',
        estimated_completion: '2024-03-15T14:45:00Z'
      },
      {
        id: '2',
        job_name: 'Weekly Refresh - Southeast Region',
        job_type: 'quick_refresh',
        status: 'completed',
        total_dealerships: 1400,
        completed_dealerships: 1387,
        failed_dealerships: 13,
        progress_pct: 100,
        created_at: '2024-03-14T06:00:00Z'
      }
    ]
    setBulkJobs(mockJobs)
  }

  const loadSummaryStats = async () => {
    // Mock implementation - in production, this would aggregate real data
  }

  const performanceData = useMemo(() => {
    return dealershipGroups.map(group => ({
      name: group.name.length > 15 ? group.name.substring(0, 15) + '...' : group.name,
      ai_visibility: group.avg_ai_visibility,
      rooftops: group.total_rooftops,
      revenue_at_risk: group.total_revenue_at_risk / 1000000, // Convert to millions
      opportunity: group.total_opportunity / 1000000
    }))
  }, [dealershipGroups])

  const marketDistributionData = useMemo(() => {
    const distribution = dealershipGroups.reduce((acc, group) => {
      acc[group.type] = (acc[group.type] || 0) + group.total_rooftops
      return acc
    }, {} as Record<string, number>)

    return Object.entries(distribution).map(([type, count]) => ({
      name: type.replace('_', ' ').toUpperCase(),
      value: count,
      percentage: ((count / summaryStats.total_dealerships) * 100).toFixed(1)
    }))
  }, [dealershipGroups, summaryStats])

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const formatLargeCurrency = (amount: number): string => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`
    }
    if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(0)}K`
    }
    return formatCurrency(amount)
  }

  const getPerformanceColor = (score: number): string => {
    if (score >= 80) return 'text-green-600 bg-green-50'
    if (score >= 60) return 'text-yellow-600 bg-yellow-50'
    return 'text-red-600 bg-red-50'
  }

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-50'
      case 'running': return 'text-blue-600 bg-blue-50'
      case 'failed': return 'text-red-600 bg-red-50'
      case 'pending': return 'text-yellow-600 bg-yellow-50'
      case 'cancelled': return 'text-gray-600 bg-gray-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading enterprise dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Enterprise Dashboard</h1>
          <p className="text-gray-600">Managing {summaryStats.total_dealerships.toLocaleString()} dealership rooftops across {summaryStats.markets_covered} markets</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Download className="w-4 h-4" />
            Export Data
          </button>
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
            <Play className="w-4 h-4" />
            Start Analysis
          </button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Rooftops</p>
              <p className="text-2xl font-bold text-gray-900">{summaryStats.total_dealerships.toLocaleString()}</p>
            </div>
            <Building2 className="h-8 w-8 text-blue-600" />
          </div>
          <div className="mt-2 flex items-center text-sm">
            <CheckCircle className="w-4 h-4 text-green-500 mr-1" />
            <span className="text-green-600">{summaryStats.active_dealerships.toLocaleString()} active</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg AI Visibility</p>
              <p className="text-2xl font-bold text-gray-900">{summaryStats.avg_ai_visibility}%</p>
            </div>
            <Target className="h-8 w-8 text-green-600" />
          </div>
          <div className="mt-2 flex items-center text-sm">
            <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
            <span className="text-green-600">+2.3% from last month</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Revenue at Risk</p>
              <p className="text-2xl font-bold text-gray-900">{formatLargeCurrency(summaryStats.total_revenue_at_risk)}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
          <div className="mt-2 flex items-center text-sm">
            <TrendingDown className="w-4 h-4 text-red-500 mr-1" />
            <span className="text-red-600">{summaryStats.underperformers} underperforming</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Recovery Opportunity</p>
              <p className="text-2xl font-bold text-gray-900">{formatLargeCurrency(summaryStats.total_opportunity)}</p>
            </div>
            <DollarSign className="h-8 w-8 text-green-600" />
          </div>
          <div className="mt-2 flex items-center text-sm">
            <Zap className="w-4 h-4 text-blue-500 mr-1" />
            <span className="text-blue-600">{summaryStats.high_performers} high performers</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {[
            { id: 'overview', label: 'Overview', icon: Globe },
            { id: 'groups', label: 'Dealer Groups', icon: Building2 },
            { id: 'markets', label: 'Markets', icon: MapPin },
            { id: 'jobs', label: 'Bulk Jobs', icon: Clock },
            { id: 'analytics', label: 'Analytics', icon: TrendingUp }
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as any)}
              className={`flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Performance Chart */}
          <div className="bg-white p-6 rounded-lg border shadow-sm">
            <h3 className="text-lg font-semibold mb-4">Group Performance Overview</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip
                  formatter={(value, name) => {
                    if (name === 'revenue_at_risk' || name === 'opportunity') {
                      return [`$${value}M`, name.replace('_', ' ')]
                    }
                    return [value, name.replace('_', ' ')]
                  }}
                />
                <Bar dataKey="ai_visibility" fill="#8884d8" name="AI Visibility %" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Market Distribution */}
          <div className="bg-white p-6 rounded-lg border shadow-sm">
            <h3 className="text-lg font-semibold mb-4">Rooftop Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={marketDistributionData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percentage }) => `${name}: ${percentage}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {marketDistributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {activeTab === 'groups' && (
        <div className="bg-white rounded-lg border shadow-sm">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold">Dealership Groups</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Group</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rooftops</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">AI Visibility</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Performance</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue Impact</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {dealershipGroups.map((group) => (
                  <tr key={group.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{group.name}</div>
                        <div className="text-sm text-gray-500 capitalize">{group.type.replace('_', ' ')} • {group.markets_covered} markets</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {group.total_rooftops.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPerformanceColor(group.avg_ai_visibility)}`}>
                        {group.avg_ai_visibility}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center space-x-2">
                        <div className="flex items-center text-green-600">
                          <TrendingUp className="w-4 h-4 mr-1" />
                          {group.high_performers}
                        </div>
                        <div className="flex items-center text-red-600">
                          <TrendingDown className="w-4 h-4 mr-1" />
                          {group.underperformers}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>
                        <div className="text-red-600">-{formatLargeCurrency(group.total_revenue_at_risk)}</div>
                        <div className="text-green-600">+{formatLargeCurrency(group.total_opportunity)}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                      <button className="hover:text-blue-800">View Details</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'jobs' && (
        <div className="space-y-6">
          {/* Active Jobs */}
          <div className="bg-white rounded-lg border shadow-sm">
            <div className="p-6 border-b flex justify-between items-center">
              <h3 className="text-lg font-semibold">Bulk Analysis Jobs</h3>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Create New Job
              </button>
            </div>
            <div className="divide-y divide-gray-200">
              {bulkJobs.map((job) => (
                <div key={job.id} className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">{job.job_name}</h4>
                      <p className="text-sm text-gray-500 capitalize">
                        {job.job_type.replace('_', ' ')} • {job.total_dealerships} dealerships
                      </p>
                    </div>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(job.status)}`}>
                      {job.status.toUpperCase()}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span>Progress</span>
                      <span>{job.progress_pct.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${job.progress_pct}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Completed:</span>
                      <span className="ml-2 font-medium">{job.completed_dealerships.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Failed:</span>
                      <span className="ml-2 font-medium text-red-600">{job.failed_dealerships}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Success Rate:</span>
                      <span className="ml-2 font-medium">
                        {job.completed_dealerships > 0
                          ? ((job.completed_dealerships / (job.completed_dealerships + job.failed_dealerships)) * 100).toFixed(1)
                          : 0}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Real-time activity indicator */}
      <div className="fixed bottom-6 right-6">
        <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-sm text-gray-600">
              {summaryStats.running_jobs} jobs running
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EnterpriseDealershipDashboard