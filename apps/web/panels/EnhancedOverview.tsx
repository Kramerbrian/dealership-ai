"use client";
import { useState, useEffect } from "react";
import { Card, Metric, Pill, MetricRing } from "@dealershipai/ui";
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { RefreshCw, TrendingUp, AlertTriangle, CheckCircle, Target, Brain, Search } from "lucide-react";

interface EnhancedDashboardData {
  metrics: {
    revenueAtRisk: string;
    aiVisibility: string;
    websiteHealth: string;
    authorityScore: number;
  };
  scores: {
    seo: {
      overall: number;
      breakdown: {
        technical: number;
        schema: number;
        content: number;
        backlinks: number;
        reviews: number;
      };
    };
    aeo: {
      overall: number;
      breakdown: {
        citations: number;
        relevance: number;
        faqSchema: number;
        authority: number;
        sentiment: number;
      };
    };
    geo: {
      overall: number;
      breakdown: {
        presence: number;
        schemaMatch: number;
        freshness: number;
        accuracy: number;
        competition: number;
      };
    };
  };
  charts: {
    weeklyRevenue: Array<{ w: string; rev: number }>;
    scoreProgression: {
      seo: number[];
      aeo: number[];
      geo: number[];
    };
  };
  competitive: {
    percentiles: {
      seoPercentile: number;
      aeoPercentile: number;
      geoPercentile: number;
    };
    gapToLeader: {
      seo: number;
      aeo: number;
      geo: number;
    };
    marketPosition: string;
  };
  insights: {
    topStrength: string;
    primaryWeakness: string;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    quickWins: string[];
    estimatedImpact: {
      monthly: number;
      annual: number;
    };
  };
  recommendations: Array<{
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    category: string;
    action: string;
    impact: string;
    effort: string;
  }>;
  metadata: {
    algorithm: string;
    sources: string[];
    confidence: number;
    lastUpdated: string;
  };
  timestamp: string;
}

export default function EnhancedOverview({ dealerId }: { dealerId: string }) {
  const [data, setData] = useState<EnhancedDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/dashboard/enhanced?dealerId=${dealerId}&location=Naples, FL`);
      if (response.ok) {
        const dashboardData = await response.json();
        setData(dashboardData);
        setLastUpdated(new Date());
      }
    } catch (error) {
      console.error('Failed to fetch enhanced dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [dealerId]);

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <Card key={i}>
              <div className="animate-pulse">
                <div className="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-700 rounded w-1/2 mb-2"></div>
                <div className="h-2 bg-gray-700 rounded w-full"></div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!data) return <div>No data available</div>;

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'HIGH': return 'text-red-400';
      case 'MEDIUM': return 'text-yellow-400';
      case 'LOW': return 'text-green-400';
      default: return 'text-gray-400';
    }
  };

  const getRiskIcon = (level: string) => {
    switch (level) {
      case 'HIGH': return <AlertTriangle className="w-4 h-4 text-red-400" />;
      case 'MEDIUM': return <Target className="w-4 h-4 text-yellow-400" />;
      case 'LOW': return <CheckCircle className="w-4 h-4 text-green-400" />;
      default: return null;
    }
  };

  // Prepare chart data for score progression
  const progressionData = [
    { period: 'Month 1', SEO: data.charts.scoreProgression.seo[0], AEO: data.charts.scoreProgression.aeo[0], GEO: data.charts.scoreProgression.geo[0] },
    { period: 'Month 2', SEO: data.charts.scoreProgression.seo[1], AEO: data.charts.scoreProgression.aeo[1], GEO: data.charts.scoreProgression.geo[1] },
    { period: 'Month 3', SEO: data.charts.scoreProgression.seo[2], AEO: data.charts.scoreProgression.aeo[2], GEO: data.charts.scoreProgression.geo[2] },
    { period: 'Current', SEO: data.charts.scoreProgression.seo[3], AEO: data.charts.scoreProgression.aeo[3], GEO: data.charts.scoreProgression.geo[3] }
  ];

  return (
    <div className="space-y-6">
      {/* Header with Algorithm Info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold text-gray-100">Enhanced Dashboard</h2>
          <Pill className="bg-purple-800 text-purple-200 border-purple-700">
            {data.metadata.algorithm}
          </Pill>
          {lastUpdated && (
            <span className="text-sm text-gray-400">
              Updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
        <button
          onClick={fetchDashboardData}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Primary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Metric
          title="Revenue at Risk"
          value={data.metrics.revenueAtRisk}
          sub={`${data.insights.estimatedImpact.annual.toLocaleString()}/year potential`}
          progress={100 - data.scores.aeo.overall}
        />
        <Metric
          title="AI Visibility"
          value={data.metrics.aiVisibility}
          sub="Answer Engine Optimization"
          progress={data.scores.aeo.overall}
        />
        <Metric
          title="Website Health"
          value={data.metrics.websiteHealth}
          sub="Technical SEO Foundation"
          progress={data.scores.seo.overall}
        />
        <Metric
          title="Authority Score"
          value={data.metrics.authorityScore}
          sub={`Market position: ${data.competitive.marketPosition}`}
          progress={data.metrics.authorityScore}
        />
      </div>

      {/* Risk Assessment & Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-100">Risk Assessment</h3>
            <div className="flex items-center gap-3">
              {getRiskIcon(data.insights.riskLevel)}
              <span className={`text-lg font-medium ${getRiskColor(data.insights.riskLevel)}`}>
                {data.insights.riskLevel} RISK
              </span>
            </div>
            <div className="space-y-2">
              <div className="text-sm">
                <span className="text-gray-400">Top Strength:</span>
                <span className="ml-2 text-green-400">{data.insights.topStrength}</span>
              </div>
              <div className="text-sm">
                <span className="text-gray-400">Primary Weakness:</span>
                <span className="ml-2 text-red-400">{data.insights.primaryWeakness}</span>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-100">Quick Wins</h3>
            <div className="space-y-2">
              {data.insights.quickWins.map((win, index) => (
                <div key={index} className="flex items-start gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-300">{win}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Research-Based Scoring Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Search className="w-5 h-5 text-blue-400" />
              <h3 className="text-lg font-semibold text-gray-100">SEO Score</h3>
              <span className="text-2xl font-bold text-blue-400">{data.scores.seo.overall}</span>
            </div>
            <div className="space-y-3">
              {Object.entries(data.scores.seo.breakdown).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm text-gray-400 capitalize">{key}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-400 transition-all duration-300"
                        style={{ width: `${value}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium w-8">{value}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-400" />
              <h3 className="text-lg font-semibold text-gray-100">AEO Score</h3>
              <span className="text-2xl font-bold text-purple-400">{data.scores.aeo.overall}</span>
            </div>
            <div className="space-y-3">
              {Object.entries(data.scores.aeo.breakdown).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm text-gray-400 capitalize">{key === 'faqSchema' ? 'FAQ Schema' : key}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-400 transition-all duration-300"
                        style={{ width: `${value}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium w-8">{value}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-400" />
              <h3 className="text-lg font-semibold text-gray-100">GEO Score</h3>
              <span className="text-2xl font-bold text-green-400">{data.scores.geo.overall}</span>
            </div>
            <div className="space-y-3">
              {Object.entries(data.scores.geo.breakdown).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm text-gray-400 capitalize">{key === 'schemaMatch' ? 'Schema Match' : key}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-400 transition-all duration-300"
                        style={{ width: `${value}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium w-8">{value}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="text-sm text-gray-300 mb-3">Score Progression (SEO/AEO/GEO)</div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={progressionData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="SEO" stroke="#3B82F6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="AEO" stroke="#A855F7" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="GEO" stroke="#10B981" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <div className="text-sm text-gray-300 mb-3">Weekly Revenue Trend</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.charts.weeklyRevenue} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="w" />
              <YAxis />
              <Tooltip formatter={(value) => [`$${(value as number).toLocaleString()}`, 'Revenue']} />
              <Bar dataKey="rev" fill="#0EA5E9" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Top Recommendations */}
      <Card>
        <h3 className="text-lg font-semibold text-gray-100 mb-4">Priority Recommendations</h3>
        <div className="space-y-3">
          {data.recommendations.slice(0, 3).map((rec, index) => (
            <div key={index} className="flex items-start gap-3 p-3 bg-slate-700/50 rounded-lg">
              <div className={`px-2 py-1 text-xs rounded font-medium ${
                rec.priority === 'HIGH' ? 'bg-red-800 text-red-200' :
                rec.priority === 'MEDIUM' ? 'bg-yellow-800 text-yellow-200' :
                'bg-green-800 text-green-200'
              }`}>
                {rec.priority}
              </div>
              <div className="flex-1">
                <div className="font-medium text-gray-100">{rec.action}</div>
                <div className="text-sm text-gray-400">
                  <span className="mr-4">Impact: {rec.impact}</span>
                  <span>Effort: {rec.effort}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Metadata */}
      <Card>
        <div className="flex items-center justify-between text-sm text-gray-400">
          <div className="flex items-center gap-4">
            <span>Confidence: {data.metadata.confidence}%</span>
            <span>Sources: {data.metadata.sources.length} integrated</span>
          </div>
          <span>Last Analysis: {new Date(data.metadata.lastUpdated).toLocaleString()}</span>
        </div>
      </Card>
    </div>
  );
}