'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
  AreaChart, Area
} from 'recharts';
import {
  TrendingUp, TrendingDown, Users, Car, DollarSign,
  Phone, Mail, MapPin, Calendar, Search, Eye,
  ChevronUp, ChevronDown, Star, Target, Zap,
  BarChart3, Activity, AlertTriangle, CheckCircle
} from 'lucide-react';

// Import our new hooks and components
import { usePrompts } from '../hooks/usePrompts'
import { useVisibility, useVisibilityHistory, overallVisibility } from '../hooks/useVisibility'
import { useSchemaValidation } from '../hooks/useSchema'
import { useBatchTests } from '../hooks/useBatch'
import { useToast } from '../hooks/useToast'
import { useAdmin } from './AdminToggle'

import ToastContainer from './Toast'
import QueueWidget from './QueueWidget'
import PromptPreviewPanel from './PromptPreviewPanel'
import AdminToggle from './AdminToggle'

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  trend?: 'up' | 'down';
  icon: React.ComponentType<any>;
  color?: string;
}

interface ChartDataPoint {
  name: string;
  value: number;
  [key: string]: any;
}

interface KPIData {
  seo: number;
  aeo: number;
  geo: number;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  change,
  trend = 'up',
  icon: Icon,
  color = 'blue'
}) => {
  const colorClasses = {
    blue: 'border-blue-500 bg-blue-500/10',
    green: 'border-green-500 bg-green-500/10',
    purple: 'border-purple-500 bg-purple-500/10',
    orange: 'border-orange-500 bg-orange-500/10',
    red: 'border-red-500 bg-red-500/10'
  };

  return (
    <div className={`rounded-xl border ${colorClasses[color as keyof typeof colorClasses]} p-6 backdrop-blur-sm`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-400">{title}</p>
          <p className="text-2xl font-bold text-white">{value}</p>
          {change !== undefined && (
            <div className={`flex items-center mt-2 ${trend === 'up' ? 'text-green-400' : 'text-red-400'}`}>
              {trend === 'up' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              <span className="text-sm font-medium">{Math.abs(change)}%</span>
            </div>
          )}
        </div>
        <Icon className={`w-8 h-8 ${color === 'blue' ? 'text-blue-400' : color === 'green' ? 'text-green-400' : color === 'purple' ? 'text-purple-400' : color === 'orange' ? 'text-orange-400' : 'text-red-400'}`} />
      </div>
    </div>
  );
};

const Pill: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = ""
}) => {
  return (
    <span className={`px-2 py-0.5 text-xs rounded-full bg-gray-800 text-gray-300 border border-gray-700 ${className}`}>
      {children}
    </span>
  );
};

export default function PremiumDealershipDashboard() {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [kpiData, setKpiData] = useState<KPIData>({ seo: 0, aeo: 0, geo: 0 });
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedDealerId] = useState('DEMO_DEALER_001')
  const [isPromptPanelOpen, setIsPromptPanelOpen] = useState(false)
  const [selectedPromptId, setSelectedPromptId] = useState<string>()

  // New hooks for integrated functionality
  const { isAdmin } = useAdmin()
  const toast = useToast()
  const { prompts, loading: promptsLoading, stats } = usePrompts({ validate: true })
  const { data: visibilityData } = useVisibility(selectedDealerId)
  const { history: visibilityHistory } = useVisibilityHistory(selectedDealerId, 30)
  const { validateURLs } = useSchemaValidation()
  const { tests: batchTests, summary: batchSummary } = useBatchTests()

  // Generate mock data for various charts
  const salesData: ChartDataPoint[] = useMemo(() => [
    { name: 'Jan', sales: 45000, leads: 320, visits: 1240 },
    { name: 'Feb', sales: 52000, leads: 380, visits: 1350 },
    { name: 'Mar', sales: 48000, leads: 340, visits: 1180 },
    { name: 'Apr', sales: 61000, leads: 420, visits: 1580 },
    { name: 'May', sales: 55000, leads: 390, visits: 1420 },
    { name: 'Jun', sales: 67000, leads: 450, visits: 1680 }
  ], []);

  const inventoryData: ChartDataPoint[] = useMemo(() => [
    { name: 'New', value: 45, color: '#3B82F6' },
    { name: 'Used', value: 120, color: '#10B981' },
    { name: 'Certified', value: 35, color: '#8B5CF6' },
    { name: 'Trade-ins', value: 28, color: '#F59E0B' }
  ], []);

  const performanceData: ChartDataPoint[] = useMemo(() => [
    { name: 'Mon', seo: 85, aeo: 72, geo: 68, traffic: 145 },
    { name: 'Tue', seo: 87, aeo: 75, geo: 71, traffic: 152 },
    { name: 'Wed', seo: 82, aeo: 70, geo: 65, traffic: 138 },
    { name: 'Thu', seo: 90, aeo: 78, geo: 74, traffic: 168 },
    { name: 'Fri', seo: 88, aeo: 76, geo: 72, traffic: 155 },
    { name: 'Sat', seo: 85, aeo: 73, geo: 69, traffic: 142 },
    { name: 'Sun', seo: 83, aeo: 71, geo: 67, traffic: 135 }
  ], []);

  // Helper functions
  const handlePromptSelect = (promptId: string) => {
    setSelectedPromptId(promptId)
    setIsPromptPanelOpen(true)
  }

  const handleSchemaValidation = async () => {
    try {
      const urls = [
        'https://example-dealership.com',
        'https://example-dealership.com/inventory',
        'https://example-dealership.com/services'
      ]

      await validateURLs(urls, { dealer_id: selectedDealerId })
      toast.success('Schema validation completed', 'Check the Schema tab for results')
    } catch (error) {
      toast.error('Schema validation failed', error instanceof Error ? error.message : 'Unknown error')
    }
  }

  // Fetch KPI data
  useEffect(() => {
    const fetchKPIData = async () => {
      try {
        const response = await fetch('/api/advanced-kpis');
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data.scores) {
            setKpiData(data.data.scores);
          }
        }
      } catch (error) {
        console.error('Failed to fetch KPI data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchKPIData();
    const interval = setInterval(fetchKPIData, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'prompts', label: 'Prompts', icon: Zap },
    { id: 'schema', label: 'Schema', icon: Search },
    { id: 'batch', label: 'Batch Tests', icon: Target },
    { id: 'sales', label: 'Sales Analytics', icon: DollarSign },
    { id: 'inventory', label: 'Inventory', icon: Car },
    { id: 'advanced-kpi', label: 'Advanced KPIs', icon: Eye },
    { id: 'leads', label: 'Lead Management', icon: Users },
    { id: 'performance', label: 'Performance', icon: Activity }
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-6">
            {/* Key Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <MetricCard
                title="Monthly Sales"
                value="$67,000"
                change={12.5}
                trend="up"
                icon={DollarSign}
                color="green"
              />
              <MetricCard
                title="Active Leads"
                value="89"
                change={8.2}
                trend="up"
                icon={Users}
                color="blue"
              />
              <MetricCard
                title="Inventory"
                value="228"
                change={-2.1}
                trend="down"
                icon={Car}
                color="purple"
              />
              <MetricCard
                title="Conversion Rate"
                value="18.4%"
                change={3.7}
                trend="up"
                icon={Target}
                color="orange"
              />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Sales Trend
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={salesData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="name" stroke="#9CA3AF" />
                    <YAxis stroke="#9CA3AF" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1F2937',
                        border: '1px solid #374151',
                        borderRadius: '8px'
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="sales"
                      stroke="#3B82F6"
                      strokeWidth={3}
                      dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Car className="w-5 h-5" />
                  Inventory Distribution
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={inventoryData}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {inventoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        );

      case 'prompts':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">Prompt Management</h2>
              <button
                onClick={() => setIsPromptPanelOpen(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Test Prompt
              </button>
            </div>

            {/* Prompt Stats */}
            {stats && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <MetricCard
                  title="Total Prompts"
                  value={stats.total}
                  icon={Zap}
                  color="blue"
                />
                <MetricCard
                  title="Categories"
                  value={Object.keys(stats.by_category).length}
                  icon={Target}
                  color="green"
                />
                <MetricCard
                  title="Intents"
                  value={Object.keys(stats.by_intent).length}
                  icon={Activity}
                  color="purple"
                />
              </div>
            )}

            {/* Prompts List */}
            <div className="bg-gray-900/50 rounded-xl border border-gray-800">
              <div className="p-6 border-b border-gray-800">
                <h3 className="text-lg font-semibold text-white">Available Prompts</h3>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {promptsLoading ? (
                  <div className="p-6 text-gray-400">Loading prompts...</div>
                ) : (
                  <div className="divide-y divide-gray-800">
                    {prompts.map((prompt) => (
                      <div key={prompt.id} className="p-4 hover:bg-gray-800/50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h4 className="text-sm font-medium text-white">{prompt.title}</h4>
                            <div className="mt-2 flex items-center gap-2">
                              <Pill className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                                {prompt.category}
                              </Pill>
                              <Pill className="bg-green-500/20 text-green-400 border-green-500/30">
                                {prompt.intent}
                              </Pill>
                              <span className="text-xs text-gray-400">{prompt.variables.length} variables</span>
                            </div>
                          </div>
                          <button
                            onClick={() => handlePromptSelect(prompt.id)}
                            className="px-3 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors text-sm"
                          >
                            Test
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 'schema':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">Schema Validation</h2>
              <button
                onClick={handleSchemaValidation}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Run Schema Check
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <MetricCard
                title="Schema Coverage"
                value="73%"
                change={5.2}
                trend="up"
                icon={Search}
                color="blue"
              />
              <MetricCard
                title="Valid Schemas"
                value="12/16"
                icon={CheckCircle}
                color="green"
              />
              <MetricCard
                title="Issues Found"
                value="4"
                icon={AlertTriangle}
                color="red"
              />
            </div>

            <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Schema Status</h3>
              <p className="text-gray-400">Schema validation results will appear here after running a check.</p>
            </div>
          </div>
        );

      case 'batch':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white">Batch Testing</h2>

            {batchSummary && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <MetricCard
                  title="Total Tests"
                  value={batchSummary.total_tests}
                  icon={Activity}
                  color="blue"
                />
                <MetricCard
                  title="Completed"
                  value={batchSummary.completed_tests}
                  icon={CheckCircle}
                  color="green"
                />
                <MetricCard
                  title="Running"
                  value={batchSummary.running_tests}
                  icon={Zap}
                  color="orange"
                />
                <MetricCard
                  title="Failed"
                  value={batchSummary.failed_tests}
                  icon={AlertTriangle}
                  color="red"
                />
              </div>
            )}

            <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Batch Test Management</h3>
              <p className="text-gray-400">Batch test results and management interface will be displayed here.</p>
            </div>
          </div>
        );

      case 'advanced-kpi':
        return (
          <div className="space-y-6">
            {/* KPI Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <MetricCard
                title="SEO Score"
                value={loading ? "..." : `${Math.round(kpiData.seo)}%`}
                change={loading ? undefined : 5.2}
                trend="up"
                icon={Search}
                color="blue"
              />
              <MetricCard
                title="AEO Score"
                value={loading ? "..." : `${Math.round(kpiData.aeo)}%`}
                change={loading ? undefined : 3.1}
                trend="up"
                icon={Zap}
                color="purple"
              />
              <MetricCard
                title="GEO Score"
                value={loading ? "..." : `${Math.round(kpiData.geo)}%`}
                change={loading ? undefined : 7.8}
                trend="up"
                icon={Eye}
                color="green"
              />
            </div>

            {/* Performance Trends */}
            <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5" />
                SEO/AEO/GEO Performance Trends
                <Pill>Weekly View</Pill>
              </h3>
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={performanceData}>
                  <defs>
                    <linearGradient id="seoGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="aeoGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="geoGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9CA3AF" />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1F2937',
                      border: '1px solid #374151',
                      borderRadius: '8px'
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="seo"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#seoGradient)"
                  />
                  <Area
                    type="monotone"
                    dataKey="aeo"
                    stroke="#8B5CF6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#aeoGradient)"
                  />
                  <Area
                    type="monotone"
                    dataKey="geo"
                    stroke="#10B981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#geoGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* KPI Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-6">
                <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <Search className="w-4 h-4 text-blue-400" />
                  SEO Metrics
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Core Web Vitals</span>
                    <Pill className="bg-blue-500/20 text-blue-400 border-blue-500/30">85%</Pill>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Local SERP</span>
                    <Pill className="bg-green-500/20 text-green-400 border-green-500/30">92%</Pill>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Schema Coverage</span>
                    <Pill className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">78%</Pill>
                  </div>
                </div>
              </div>

              <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-6">
                <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-purple-400" />
                  AEO Metrics
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Mention Frequency</span>
                    <Pill className="bg-purple-500/20 text-purple-400 border-purple-500/30">15.2%</Pill>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Position Score</span>
                    <Pill className="bg-green-500/20 text-green-400 border-green-500/30">3.2 avg</Pill>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Accuracy Rate</span>
                    <Pill className="bg-blue-500/20 text-blue-400 border-blue-500/30">94.1%</Pill>
                  </div>
                </div>
              </div>

              <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-6">
                <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <Eye className="w-4 h-4 text-green-400" />
                  GEO Metrics
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">AI Visibility</span>
                    <Pill className="bg-green-500/20 text-green-400 border-green-500/30">68.9%</Pill>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Market Share</span>
                    <Pill className="bg-blue-500/20 text-blue-400 border-blue-500/30">12.4%</Pill>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Engagement Rate</span>
                    <Pill className="bg-orange-500/20 text-orange-400 border-orange-500/30">45.7%</Pill>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'sales':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <MetricCard
                title="Total Revenue"
                value="$324,500"
                change={15.3}
                trend="up"
                icon={DollarSign}
                color="green"
              />
              <MetricCard
                title="Units Sold"
                value="47"
                change={8.7}
                trend="up"
                icon={Car}
                color="blue"
              />
              <MetricCard
                title="Avg Sale Price"
                value="$6,906"
                change={2.1}
                trend="up"
                icon={TrendingUp}
                color="purple"
              />
              <MetricCard
                title="Profit Margin"
                value="22.4%"
                change={1.8}
                trend="up"
                icon={Target}
                color="orange"
              />
            </div>
          </div>
        );

      default:
        return (
          <div className="text-center py-12">
            <div className="text-gray-400">
              <Calendar className="w-16 h-16 mx-auto mb-4" />
              <h3 className="text-lg font-medium">Coming Soon</h3>
              <p className="text-sm mt-2">This feature is under development.</p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <Car className="w-5 h-5 text-white" />
                </div>
                Premium Auto Naples
                <Pill className="bg-green-500/20 text-green-400 border-green-500/30">Live</Pill>
              </h1>
              <p className="text-gray-400 mt-1">Enterprise Dealership Analytics Dashboard</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-gray-400">Real-time data</span>
              </div>
              {isAdmin && <QueueWidget />}
              <AdminToggle />
              <Pill>{new Date().toLocaleDateString()}</Pill>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-800">
        <div className="px-8">
          <nav className="flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3 py-4 border-b-2 text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-400'
                      : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-8">
        {renderTabContent()}
      </div>

      {/* Panels and Widgets */}
      <PromptPreviewPanel
        isOpen={isPromptPanelOpen}
        onClose={() => setIsPromptPanelOpen(false)}
        promptId={selectedPromptId}
      />

      {/* Global Toast Container */}
      <ToastContainer />
    </div>
  );
}