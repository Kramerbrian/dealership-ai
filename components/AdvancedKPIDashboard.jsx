import React, { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Clock, Users, Search, Brain, Zap, Target } from 'lucide-react';
import Pill from './Pill';
import {
  generateMockKPIData,
  calculateAdvancedSEOScore,
  calculateAdvancedAEOScore,
  calculateAdvancedGEOScore,
  calculateTrend,
  generateAlerts,
  calculateCoreWebVitals,
  calculateAIMentionFrequency,
  calculateAIGVR,
  calculateCompetitiveShare
} from '../lib/advanced-kpi-algorithms';

const Card = ({ className = "", children }) => (
  <div className={`bg-slate-800 rounded-lg border border-slate-700 p-6 ${className}`}>
    {children}
  </div>
);

const MetricCard = ({ title, value, change, icon, trend, alert, pills = [] }) => (
  <Card className="hover:bg-slate-700 transition-colors">
    <div className="flex items-start justify-between mb-4">
      <div className="p-3 rounded-lg bg-slate-700">
        {icon}
      </div>
      {trend && (
        <div className={`flex items-center text-sm ${
          trend.direction === 'up' ? 'text-green-400' :
          trend.direction === 'down' ? 'text-red-400' : 'text-slate-400'
        }`}>
          {trend.direction === 'up' ? <TrendingUp className="w-4 h-4 mr-1" /> :
           trend.direction === 'down' ? <TrendingDown className="w-4 h-4 mr-1" /> :
           <Clock className="w-4 h-4 mr-1" />}
          {trend.change > 0 ? '+' : ''}{trend.change}%
        </div>
      )}
    </div>

    <div className="space-y-1">
      <p className="text-3xl font-bold text-slate-100">{value}</p>
      <p className="text-sm text-slate-400">{title}</p>

      {alert && (
        <div className={`mt-2 p-2 rounded text-xs flex items-center ${
          alert.type === 'critical' ? 'bg-red-900 text-red-200' :
          alert.type === 'warning' ? 'bg-yellow-900 text-yellow-200' :
          'bg-green-900 text-green-200'
        }`}>
          <AlertTriangle className="w-3 h-3 mr-1" />
          {alert.message}
        </div>
      )}

      {pills.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {pills.map((pill, idx) => (
            <Pill key={idx} className={pill.className || ""}>
              {pill.text}
            </Pill>
          ))}
        </div>
      )}
    </div>
  </Card>
);

const AdvancedKPISection = ({ title, icon, children, expanded, onToggle }) => (
  <Card className="mb-6">
    <div
      className="flex items-center justify-between cursor-pointer"
      onClick={onToggle}
    >
      <div className="flex items-center gap-3">
        {icon}
        <h3 className="text-xl font-semibold text-slate-100">{title}</h3>
      </div>
      <div className={`transform transition-transform ${expanded ? 'rotate-180' : ''}`}>
        <TrendingDown className="w-5 h-5 text-slate-400" />
      </div>
    </div>

    {expanded && (
      <div className="mt-6 pt-6 border-t border-slate-700">
        {children}
      </div>
    )}
  </Card>
);

export default function AdvancedKPIDashboard({ dealershipName = "Premium Auto Naples" }) {
  const [kpiData, setKpiData] = useState(null);
  const [historicalData, setHistoricalData] = useState([]);
  const [expandedSections, setExpandedSections] = useState({
    seo: true,
    aeo: true,
    geo: true,
    competitive: false,
    alerts: true
  });
  const [alerts, setAlerts] = useState([]);

  // Generate mock data and calculate scores
  useEffect(() => {
    const mockData = generateMockKPIData(dealershipName);
    setKpiData(mockData);

    // Generate historical data for trends
    const historical = Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (29 - i));

      return {
        date: date.toISOString().split('T')[0],
        seoScore: calculateAdvancedSEOScore(mockData) + (Math.random() - 0.5) * 10,
        aeoScore: calculateAdvancedAEOScore(mockData) + (Math.random() - 0.5) * 15,
        geoScore: calculateAdvancedGEOScore(mockData) + (Math.random() - 0.5) * 12,
        coreWebVitals: calculateCoreWebVitals(mockData.performance) + (Math.random() - 0.5) * 8,
        aiMentions: calculateAIMentionFrequency(mockData.mentions) + (Math.random() - 0.5) * 20,
        competitiveShare: calculateCompetitiveShare(mockData.competitive) + (Math.random() - 0.5) * 15
      };
    });

    setHistoricalData(historical);

    // Generate alerts
    if (historical.length >= 2) {
      const current = historical[historical.length - 1];
      const previous = historical[historical.length - 2];
      const generatedAlerts = generateAlerts(
        {
          'SEO Score': current.seoScore,
          'AEO Score': current.aeoScore,
          'GEO Score': current.geoScore
        },
        {
          'SEO Score': previous.seoScore,
          'AEO Score': previous.aeoScore,
          'GEO Score': previous.geoScore
        }
      );
      setAlerts(generatedAlerts);
    }
  }, [dealershipName]);

  // Calculate current scores
  const currentScores = useMemo(() => {
    if (!kpiData) return {};

    return {
      seo: calculateAdvancedSEOScore(kpiData),
      aeo: calculateAdvancedAEOScore(kpiData),
      geo: calculateAdvancedGEOScore(kpiData),
      coreWebVitals: calculateCoreWebVitals(kpiData.performance),
      aiMentionFreq: calculateAIMentionFrequency(kpiData.mentions),
      aigvr: calculateAIGVR(kpiData.visibility),
      competitiveShare: calculateCompetitiveShare(kpiData.competitive)
    };
  }, [kpiData]);

  // Calculate trends
  const trends = useMemo(() => {
    if (historicalData.length < 2) return {};

    const current = historicalData[historicalData.length - 1];
    const previous = historicalData[historicalData.length - 2];

    return {
      seo: calculateTrend(current.seoScore, previous.seoScore),
      aeo: calculateTrend(current.aeoScore, previous.aeoScore),
      geo: calculateTrend(current.geoScore, previous.geoScore),
      coreWebVitals: calculateTrend(current.coreWebVitals, previous.coreWebVitals),
      aiMentions: calculateTrend(current.aiMentions, previous.aiMentions),
      competitiveShare: calculateTrend(current.competitiveShare, previous.competitiveShare)
    };
  }, [historicalData]);

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  if (!kpiData) {
    return <div className="text-center py-8 text-slate-400">Loading advanced KPI data...</div>;
  }

  const alertsByType = alerts.reduce((acc, alert) => {
    acc[alert.type] = (acc[alert.type] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Advanced SEO Score"
          value={`${currentScores.seo}/100`}
          trend={trends.seo}
          icon={<Search className="w-6 h-6 text-blue-400" />}
          alert={alerts.find(a => a.metric === 'SEO Score')}
          pills={[
            { text: "Core Web Vitals", className: "bg-blue-800 text-blue-200 border-blue-700" },
            { text: "Local SERP", className: "bg-green-800 text-green-200 border-green-700" }
          ]}
        />

        <MetricCard
          title="AEO Visibility Score"
          value={`${currentScores.aeo}/100`}
          trend={trends.aeo}
          icon={<Brain className="w-6 h-6 text-purple-400" />}
          alert={alerts.find(a => a.metric === 'AEO Score')}
          pills={[
            { text: `${currentScores.aiMentionFreq}% AI Mentions`, className: "bg-purple-800 text-purple-200 border-purple-700" },
            { text: "4 Engines", className: "bg-indigo-800 text-indigo-200 border-indigo-700" }
          ]}
        />

        <MetricCard
          title="GEO Performance"
          value={`${currentScores.geo}/100`}
          trend={trends.geo}
          icon={<Zap className="w-6 h-6 text-green-400" />}
          alert={alerts.find(a => a.metric === 'GEO Score')}
          pills={[
            { text: `${currentScores.aigvr}% AIGVR`, className: "bg-green-800 text-green-200 border-green-700" },
            { text: `${currentScores.competitiveShare}% Share`, className: "bg-yellow-800 text-yellow-200 border-yellow-700" }
          ]}
        />

        <MetricCard
          title="Market Position"
          value="#2 of 12"
          trend={trends.competitiveShare}
          icon={<Target className="w-6 h-6 text-orange-400" />}
          pills={[
            { text: "Local Leader", className: "bg-orange-800 text-orange-200 border-orange-700" },
            { text: "Trending Up", className: "bg-green-800 text-green-200 border-green-700" }
          ]}
        />
      </div>

      {/* Alerts Section */}
      {alerts.length > 0 && (
        <AdvancedKPISection
          title={`Active Alerts (${alerts.length})`}
          icon={<AlertTriangle className="w-5 h-5 text-yellow-400" />}
          expanded={expandedSections.alerts}
          onToggle={() => toggleSection('alerts')}
        >
          <div className="space-y-3">
            {alerts.map((alert, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-lg border-l-4 ${
                  alert.type === 'critical' ? 'bg-red-900/20 border-red-500 text-red-200' :
                  alert.type === 'warning' ? 'bg-yellow-900/20 border-yellow-500 text-yellow-200' :
                  'bg-green-900/20 border-green-500 text-green-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium">{alert.metric}</div>
                    <div className="text-sm opacity-90">{alert.message}</div>
                  </div>
                  <Pill className={
                    alert.type === 'critical' ? 'bg-red-800 text-red-200 border-red-700' :
                    alert.type === 'warning' ? 'bg-yellow-800 text-yellow-200 border-yellow-700' :
                    'bg-green-800 text-green-200 border-green-700'
                  }>
                    {alert.type.toUpperCase()}
                  </Pill>
                </div>
              </div>
            ))}
          </div>
        </AdvancedKPISection>
      )}

      {/* SEO Detailed Metrics */}
      <AdvancedKPISection
        title="SEO Visibility Deep Dive"
        icon={<Search className="w-5 h-5 text-blue-400" />}
        expanded={expandedSections.seo}
        onToggle={() => toggleSection('seo')}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-4">
            <h4 className="font-medium mb-4 text-slate-200">Core Web Vitals Performance</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">LCP (Largest Contentful Paint)</span>
                <div className="flex items-center gap-2">
                  <span className="text-green-400 font-medium">2.3s</span>
                  <Pill className="bg-green-800 text-green-200 border-green-700">Good</Pill>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">FID (First Input Delay)</span>
                <div className="flex items-center gap-2">
                  <span className="text-green-400 font-medium">85ms</span>
                  <Pill className="bg-green-800 text-green-200 border-green-700">Good</Pill>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">CLS (Cumulative Layout Shift)</span>
                <div className="flex items-center gap-2">
                  <span className="text-green-400 font-medium">0.08</span>
                  <Pill className="bg-green-800 text-green-200 border-green-700">Good</Pill>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <h4 className="font-medium mb-4 text-slate-200">Local SERP Performance</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Local Pack Appearances</span>
                <span className="text-slate-200 font-medium">320/450</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Average Position</span>
                <span className="text-slate-200 font-medium">2.1</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Click-Through Rate</span>
                <div className="flex items-center gap-2">
                  <span className="text-green-400 font-medium">3.8%</span>
                  <Pill className="bg-green-800 text-green-200 border-green-700">Above Avg</Pill>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="mt-6">
          <h4 className="font-medium mb-4 text-slate-200">SEO Performance Trend (30 Days)</h4>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={historicalData.slice(-30)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="date"
                stroke="#9CA3AF"
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              />
              <YAxis stroke="#9CA3AF" tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '8px'
                }}
              />
              <Line
                type="monotone"
                dataKey="seoScore"
                stroke="#60A5FA"
                strokeWidth={2}
                dot={{ fill: '#60A5FA', strokeWidth: 2, r: 4 }}
                name="SEO Score"
              />
              <Line
                type="monotone"
                dataKey="coreWebVitals"
                stroke="#34D399"
                strokeWidth={2}
                dot={{ fill: '#34D399', strokeWidth: 2, r: 4 }}
                name="Core Web Vitals"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </AdvancedKPISection>

      {/* AEO Detailed Metrics */}
      <AdvancedKPISection
        title="AEO (Answer Engine Optimization) Analytics"
        icon={<Brain className="w-5 h-5 text-purple-400" />}
        expanded={expandedSections.aeo}
        onToggle={() => toggleSection('aeo')}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-4">
            <h4 className="font-medium mb-4 text-slate-200">AI Engine Mentions</h4>
            <div className="space-y-3">
              {Object.entries(kpiData.mentions.engines).map(([engine, mentions]) => (
                <div key={engine} className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">{engine}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-200 font-medium">{mentions}</span>
                    <div className="w-20 bg-slate-600 rounded-full h-2">
                      <div
                        className="bg-purple-500 h-2 rounded-full"
                        style={{ width: `${(mentions / Math.max(...Object.values(kpiData.mentions.engines))) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <h4 className="font-medium mb-4 text-slate-200">Citation Quality Metrics</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Citation Stability</span>
                <div className="flex items-center gap-2">
                  <span className="text-green-400 font-medium">87%</span>
                  <Pill className="bg-green-800 text-green-200 border-green-700">Stable</Pill>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Hallucination Rate</span>
                <div className="flex items-center gap-2">
                  <span className="text-green-400 font-medium">5.9%</span>
                  <Pill className="bg-green-800 text-green-200 border-green-700">Low</Pill>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">First Position Rate</span>
                <span className="text-slate-200 font-medium">25%</span>
              </div>
            </div>
          </Card>
        </div>

        <div className="mt-6">
          <h4 className="font-medium mb-4 text-slate-200">AI Mention Frequency Trend</h4>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={historicalData.slice(-30)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="date"
                stroke="#9CA3AF"
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              />
              <YAxis stroke="#9CA3AF" tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '8px'
                }}
              />
              <Line
                type="monotone"
                dataKey="aeoScore"
                stroke="#A78BFA"
                strokeWidth={2}
                dot={{ fill: '#A78BFA', strokeWidth: 2, r: 4 }}
                name="AEO Score"
              />
              <Line
                type="monotone"
                dataKey="aiMentions"
                stroke="#F59E0B"
                strokeWidth={2}
                dot={{ fill: '#F59E0B', strokeWidth: 2, r: 4 }}
                name="AI Mentions"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </AdvancedKPISection>

      {/* GEO Performance */}
      <AdvancedKPISection
        title="GEO (Generative Engine Optimization) Performance"
        icon={<Zap className="w-5 h-5 text-green-400" />}
        expanded={expandedSections.geo}
        onToggle={() => toggleSection('geo')}
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="p-4">
            <h4 className="font-medium mb-4 text-slate-200">AIGVR Performance</h4>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-400 mb-2">{currentScores.aigvr}%</div>
              <div className="text-sm text-slate-400">AI-Generated Visibility Rate</div>
              <Pill className="bg-green-800 text-green-200 border-green-700 mt-2">
                vs Traditional SEO
              </Pill>
            </div>
          </Card>

          <Card className="p-4">
            <h4 className="font-medium mb-4 text-slate-200">Competitive Position</h4>
            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-400 mb-2">#{Math.ceil(12 - (currentScores.competitiveShare / 10))}</div>
              <div className="text-sm text-slate-400">Market Ranking</div>
              <Pill className="bg-yellow-800 text-yellow-200 border-yellow-700 mt-2">
                {currentScores.competitiveShare}% Share of Voice
              </Pill>
            </div>
          </Card>

          <Card className="p-4">
            <h4 className="font-medium mb-4 text-slate-200">Engagement Rate</h4>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-400 mb-2">4.2%</div>
              <div className="text-sm text-slate-400">AI Traffic Conversion</div>
              <Pill className="bg-blue-800 text-blue-200 border-blue-700 mt-2">
                Above Industry Avg
              </Pill>
            </div>
          </Card>
        </div>
      </AdvancedKPISection>
    </div>
  );
}