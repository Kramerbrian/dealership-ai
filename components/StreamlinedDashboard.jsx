import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertTriangle, TrendingUp, Eye, Search, Shield, Brain, Target,
  BarChart3, RefreshCw, ExternalLink, Play, CheckCircle, Clock,
  DollarSign, Users, MapPin, Zap
} from 'lucide-react';
import { CompetitiveDataProvider, useCompetitiveData, ROICalculator, actionQueue } from '../lib/CompetitiveDataProvider';
import MetricRing, { ScoreRing, PercentageRing, CompetitorRing, TrendRing, MultiMetricRing } from './MetricRing';
import HalAssistant from './HalAssistant';

const Card = ({ className = "", children, title, action, loading = false }) => (
  <div className={`bg-slate-800 rounded-lg border border-slate-700 ${className}`}>
    {title && (
      <div className="flex items-center justify-between p-4 border-b border-slate-700">
        <h3 className="text-lg font-semibold text-slate-100">{title}</h3>
        {action && (
          <button
            onClick={action.onClick}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : action.icon}
            {action.label}
          </button>
        )}
      </div>
    )}
    {children}
  </div>
);

// Core Metrics Overview - Consolidates all the essential numbers
function MetricsOverview({ data, isLoading }) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1,2,3,4].map(i => (
          <Card key={i} className="p-6">
            <div className="animate-pulse">
              <div className="w-20 h-20 bg-slate-700 rounded-full mx-auto mb-4" />
              <div className="h-4 bg-slate-700 rounded w-3/4 mx-auto" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <Card className="p-6">
        <div className="flex flex-col items-center">
          <ScoreRing
            value={data.riskScore}
            size={80}
            label="Risk Score"
            className="mb-3"
          />
          <div className="text-center">
            <div className="text-sm font-medium text-slate-300">Authority Score</div>
            <div className="text-xs text-slate-500">Higher is better</div>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex flex-col items-center">
          <PercentageRing
            value={data.aiVisibilityScore}
            size={80}
            color="#F59E0B"
            className="mb-3"
          />
          <div className="text-center">
            <div className="text-sm font-medium text-slate-300">AI Visibility</div>
            <div className="text-xs text-slate-500">Across all platforms</div>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex flex-col items-center">
          <CompetitorRing
            position={data.marketPosition}
            total={data.totalCompetitors}
            size={80}
            className="mb-3"
          />
          <div className="text-center">
            <div className="text-sm font-medium text-slate-300">Market Position</div>
            <div className="text-xs text-slate-500">Of {data.totalCompetitors} competitors</div>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex flex-col items-center">
          <MetricRing
            value={data.monthlyLossRisk}
            maxValue={25000}
            size={80}
            formatter={(val) => `$${Math.round(val/1000)}k`}
            color="#EF4444"
            className="mb-3"
          />
          <div className="text-center">
            <div className="text-sm font-medium text-slate-300">Monthly Risk</div>
            <div className="text-xs text-slate-500">Revenue at stake</div>
          </div>
        </div>
      </Card>
    </div>
  );
}

// Actionable Insights - The 20% that delivers 80% of value
function ActionableInsights({ data }) {
  const [executingActions, setExecutingActions] = useState(false);
  const [queueStatus, setQueueStatus] = useState(actionQueue.getStatus());

  const realValueActions = useMemo(() => [
    {
      id: 'schema_audit',
      title: 'Schema Validation & Fix',
      description: 'Audit and implement missing structured data markup',
      impact: '+$2,400-4,200/month',
      confidence: 92,
      timeline: '1-2 weeks',
      category: 'Technical SEO',
      type: 'schema_implementation',
      complexity: 'medium'
    },
    {
      id: 'local_seo',
      title: 'Google Business Profile Optimization',
      description: 'Complete GMB setup, photos, hours, and posting schedule',
      impact: '+15-25% local visibility',
      confidence: 88,
      timeline: '1 week',
      category: 'Local SEO',
      type: 'local_seo_optimization',
      complexity: 'low'
    },
    {
      id: 'review_management',
      title: 'Automated Review Response System',
      description: 'Set up monitoring and template responses for all review platforms',
      impact: '+0.3-0.7 star rating',
      confidence: 85,
      timeline: '3-4 weeks',
      category: 'Reputation',
      type: 'review_management',
      complexity: 'medium'
    }
  ], []);

  const executeActions = async () => {
    setExecutingActions(true);

    // Add actions to queue
    realValueActions.forEach(action => {
      actionQueue.add({
        title: action.title,
        type: action.type,
        complexity: action.complexity,
        impact: action.impact
      });
    });

    // Execute queue
    await actionQueue.execute();

    setQueueStatus(actionQueue.getStatus());
    setExecutingActions(false);
  };

  return (
    <Card
      title="High-Impact Actions"
      action={{
        label: executingActions ? 'Executing...' : 'Execute All',
        icon: executingActions ? <Clock className="w-4 h-4" /> : <Play className="w-4 h-4" />,
        onClick: executeActions
      }}
      loading={executingActions}
    >
      <div className="p-6 space-y-4">
        {realValueActions.map((action) => (
          <div key={action.id} className="border border-slate-600 rounded-lg p-4 hover:bg-slate-700/50 transition-colors">
            <div className="flex justify-between items-start mb-3">
              <div className="flex-1">
                <h4 className="font-semibold text-slate-100 mb-1">{action.title}</h4>
                <p className="text-sm text-slate-400">{action.description}</p>
              </div>
              <div className="text-right ml-4">
                <div className="text-sm font-medium text-green-400">{action.impact}</div>
                <div className="text-xs text-slate-500">{action.confidence}% confidence</div>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="px-2 py-1 bg-slate-700 text-slate-300 rounded">
                {action.category}
              </span>
              <span className="text-slate-400">{action.timeline}</span>
            </div>
          </div>
        ))}

        {queueStatus.completedCount > 0 && (
          <div className="mt-6 pt-4 border-t border-slate-700">
            <div className="flex items-center gap-2 text-sm text-green-400">
              <CheckCircle className="w-4 h-4" />
              {queueStatus.completedCount} actions completed
              <span className="text-slate-500">
                ({Math.round(queueStatus.successRate * 100)}% success rate)
              </span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

// Revenue Attribution - Shows the money trail
function RevenueAttribution({ data }) {
  const roi = useMemo(() => {
    if (!data) return null;
    return ROICalculator.calculate(5000, 0.82); // $5k investment assumption
  }, [data]);

  if (!roi) return null;

  return (
    <Card title="Revenue Attribution" className="mb-6">
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">
              ${roi.pessimistic.toLocaleString()}
            </div>
            <div className="text-sm text-slate-400">Conservative</div>
            <div className="text-xs text-slate-500">Worst case scenario</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-400">
              ${roi.realistic.toLocaleString()}
            </div>
            <div className="text-sm text-slate-300">Realistic</div>
            <div className="text-xs text-slate-500">{roi.confidence}% confidence</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-400">
              ${roi.optimistic.toLocaleString()}
            </div>
            <div className="text-sm text-slate-400">Optimistic</div>
            <div className="text-xs text-slate-500">Best case scenario</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {Object.entries(roi.factors).map(([factor, details]) => (
            <div key={factor} className="border border-slate-600 rounded p-3">
              <div className="text-sm font-medium text-slate-300 mb-1">{factor}</div>
              <div className="text-xs text-slate-400">{details.impact}</div>
              <div className="text-xs text-slate-500">
                {details.confidence} confidence
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

// Competitor Matrix - Consolidated competitor view
function CompetitorMatrix({ data }) {
  if (!data?.competitors) return null;

  return (
    <Card title="Competitive Landscape">
      <div className="p-6">
        <div className="space-y-3">
          {data.competitors.slice(0, 5).map((competitor, index) => (
            <div key={competitor.name} className="flex items-center justify-between p-3 border border-slate-600 rounded">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-sm font-medium">
                  #{competitor.position}
                </div>
                <div>
                  <div className="font-medium text-slate-300">{competitor.name}</div>
                  <div className="text-xs text-slate-500">Visibility: {competitor.visibility}%</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <TrendRing
                  value={competitor.visibility}
                  change={competitor.trend === 'up' ? 5 : competitor.trend === 'down' ? -3 : 0}
                  size={40}
                  strokeWidth={4}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

// Main Streamlined Dashboard Component
function StreamlinedDashboardContent() {
  const { competitorData, isLoading, fetchCompetitorData } = useCompetitiveData();
  const [activeTab, setActiveTab] = useState('overview');
  const [userTier, setUserTier] = useState(1);
  const [dealerInfo, setDealerInfo] = useState({
    name: 'Toyota of Naples',
    location: 'Naples, FL',
    url: 'https://toyotaofnaples.com'
  });

  // Initialize data on mount
  useEffect(() => {
    fetchCompetitorData('demo-dealer', dealerInfo.location);
  }, [dealerInfo.location, fetchCompetitorData]);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'competitors', label: 'Competitors', icon: Target },
    { id: 'hal-assistant', label: 'AI Assistant', icon: Brain },
    { id: 'automation', label: 'Automation', icon: Zap }
  ];

  const refreshData = () => {
    fetchCompetitorData('demo-dealer', dealerInfo.location, true);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-700 shadow-lg sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg grid place-items-center font-bold">dAI</div>
              <div>
                <h1 className="text-xl font-bold">DealershipAI</h1>
                <div className="text-xs text-slate-400">Streamlined Intelligence</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={userTier}
                onChange={(e) => setUserTier(Number(e.target.value))}
                className="text-sm border border-slate-600 bg-slate-800 text-slate-200 rounded-lg px-3 py-2"
              >
                <option value={1}>Tier 1 ($99/mo)</option>
                <option value={2}>Tier 2 ($299/mo)</option>
                <option value={3}>Tier 3 ($699/mo)</option>
                <option value={4}>Tier 4 ($1,499/mo)</option>
              </select>

              <button
                onClick={refreshData}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 py-4 px-4 font-medium text-sm transition-colors rounded-t ${
                    isActive
                      ? "border-b-2 border-blue-500 text-blue-400 bg-slate-700"
                      : "text-slate-300 hover:text-slate-100 hover:bg-slate-700"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && (
          <div className="space-y-8">
            <MetricsOverview data={competitorData} isLoading={isLoading} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <ActionableInsights data={competitorData} />
              <RevenueAttribution data={competitorData} />
            </div>
          </div>
        )}

        {activeTab === 'competitors' && (
          <div className="space-y-8">
            <MetricsOverview data={competitorData} isLoading={isLoading} />
            <CompetitorMatrix data={competitorData} />
          </div>
        )}

        {activeTab === 'hal-assistant' && (
          <Card className="h-[600px]">
            <HalAssistant
              dealerId="demo-dealer"
              userTier={userTier}
              businessInfo={{
                name: dealerInfo.name,
                location: dealerInfo.location,
                url: dealerInfo.url,
                specialties: "New and used vehicle sales, service, parts, and financing"
              }}
              onUpgrade={() => setUserTier(Math.min(4, userTier + 1))}
            />
          </Card>
        )}

        {activeTab === 'automation' && (
          <ActionableInsights data={competitorData} />
        )}
      </main>
    </div>
  );
}

// Main Export with Provider
export default function StreamlinedDashboard() {
  return (
    <CompetitiveDataProvider>
      <StreamlinedDashboardContent />
    </CompetitiveDataProvider>
  );
}