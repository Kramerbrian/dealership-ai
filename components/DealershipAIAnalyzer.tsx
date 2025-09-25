import React, { useState } from 'react'
import { Search, TrendingUp, AlertTriangle, DollarSign, Target, RefreshCw } from 'lucide-react'
import { useDealershipIntelligence } from '@/hooks/useDealershipIntelligence'

interface DealershipAIAnalyzerProps {
  initialDomain?: string
  className?: string
}

// Live data pulse visualizer component
const LiveDataVisualizer: React.FC = () => {
  const [dots] = useState(() => Array.from({ length: 25 }, (_, i) => ({ id: i, active: false })))

  React.useEffect(() => {
    const interval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * dots.length)
      const dot = document.querySelector(`[data-dot="${randomIndex}"]`)
      if (dot) {
        dot.classList.add('animate-pulse', 'bg-green-400', 'shadow-green-400/50')
        setTimeout(() => {
          dot.classList.remove('animate-pulse', 'bg-green-400', 'shadow-green-400/50')
        }, 500)
      }
    }, 800)

    return () => clearInterval(interval)
  }, [dots.length])

  return (
    <div className="fixed bottom-5 right-5 grid grid-cols-5 gap-1 opacity-30 hover:opacity-100 transition-opacity">
      {dots.map((dot) => (
        <div
          key={dot.id}
          data-dot={dot.id}
          className="w-3 h-3 bg-gray-300 rounded-full transition-all duration-300"
        />
      ))}
    </div>
  )
}

export const DealershipAIAnalyzer: React.FC<DealershipAIAnalyzerProps> = ({
  initialDomain = '',
  className = ''
}) => {
  const [inputDomain, setInputDomain] = useState(initialDomain)
  const [analyzedDomain, setAnalyzedDomain] = useState<string | null>(null)

  const {
    data,
    loading,
    error,
    refresh,
    quickRefresh,
    hasData,
    hasCriticalIssues,
    overallGrade,
    getScoreInsights,
    getROIMetrics,
    getCriticalIssuesCount,
    isStale
  } = useDealershipIntelligence(analyzedDomain)

  const handleAnalyze = () => {
    if (inputDomain.trim()) {
      setAnalyzedDomain(inputDomain.trim())
    }
  }

  const extractDomain = (input: string): string => {
    // Extract domain from URL, business name, or domain
    if (input.includes('://')) {
      try {
        return new URL(input).hostname
      } catch {
        return input
      }
    }
    return input
  }

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const getPerformanceInsight = (score: number, category: string): string => {
    if (score >= 80) return 'Excellent AI visibility'
    if (score >= 70) return 'Strong digital presence'
    if (score >= 60) return 'Good foundation'
    if (score >= 50) return 'Needs optimization'
    return 'Critical attention required'
  }

  const getSeverityColor = (severity: string): string => {
    const colors = {
      critical: 'text-red-600 bg-red-50 border-red-200',
      high: 'text-orange-600 bg-orange-50 border-orange-200',
      medium: 'text-yellow-600 bg-yellow-50 border-yellow-200',
      low: 'text-blue-600 bg-blue-50 border-blue-200'
    }
    return colors[severity as keyof typeof colors] || colors.medium
  }

  const scoreInsights = getScoreInsights()
  const roiMetrics = getROIMetrics()

  return (
    <div className={`max-w-4xl mx-auto space-y-6 ${className}`}>
      <LiveDataVisualizer />

      {/* Search Interface */}
      <div className="bg-white rounded-lg border shadow-sm p-6">
        <div className="flex gap-4">
          <div className="flex-1">
            <input
              type="text"
              value={inputDomain}
              onChange={(e) => setInputDomain(e.target.value)}
              placeholder="Enter dealership domain, URL, or business name..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
            />
          </div>
          <button
            onClick={handleAnalyze}
            disabled={!inputDomain.trim() || loading}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
            Analyze
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-800">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-medium">Analysis Failed</span>
          </div>
          <p className="text-red-700 mt-1">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading && !data && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-3" />
          <p className="text-blue-800 font-medium">Analyzing dealership digital intelligence...</p>
          <p className="text-blue-600 text-sm mt-1">Scanning AI visibility patterns across search engines</p>
        </div>
      )}

      {/* Results */}
      {hasData && data && (
        <div className="space-y-6">
          {/* AI Visibility Report Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold mb-2">🎯 AI Visibility Report</h2>
                <p className="text-blue-100">
                  {data.dealer.name} • {data.dealer.location} • {data.dealer.type.charAt(0).toUpperCase() + data.dealer.type.slice(1)}
                </p>
              </div>
              <div className="text-right">
                <div className="text-4xl font-bold">{data.scores.ai_visibility}/100</div>
                <div className="text-xl text-blue-200">Grade: {overallGrade}</div>
                {isStale && (
                  <button
                    onClick={refresh}
                    className="mt-2 px-3 py-1 bg-blue-800 rounded text-sm hover:bg-blue-900"
                  >
                    Refresh Data
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Performance Breakdown */}
          <div className="bg-white rounded-lg border shadow-sm p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              📊 Performance Breakdown
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-medium">SEO Performance:</span>
                <span className="text-right">
                  {data.scores.seo_performance}/100 - {getPerformanceInsight(data.scores.seo_performance, 'SEO')}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium">AEO Readiness:</span>
                <span className="text-right">
                  {data.scores.aeo_readiness}/100 - {getPerformanceInsight(data.scores.aeo_readiness, 'AEO')}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium">GEO Optimization:</span>
                <span className="text-right">
                  {data.scores.geo_optimization}/100 - {getPerformanceInsight(data.scores.geo_optimization, 'GEO')}
                </span>
              </div>
            </div>
          </div>

          {/* Critical Issues */}
          {data.critical_issues && data.critical_issues.length > 0 && (
            <div className="bg-white rounded-lg border shadow-sm p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                🚨 Critical Issues
                {hasCriticalIssues && (
                  <span className="text-sm bg-red-100 text-red-800 px-2 py-1 rounded-full">
                    {getCriticalIssuesCount()} Critical
                  </span>
                )}
              </h3>
              <div className="space-y-3">
                {data.critical_issues.slice(0, 3).map((issue, index) => (
                  <div
                    key={index}
                    className={`border rounded-lg p-4 ${getSeverityColor(issue.severity)}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-medium">{issue.issue}</div>
                        <div className="text-sm mt-1">{issue.impact}</div>
                      </div>
                      <span className="text-xs font-medium uppercase tracking-wide">
                        {issue.severity}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Revenue Impact */}
          {roiMetrics && (
            <div className="bg-white rounded-lg border shadow-sm p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                💰 Revenue Impact
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="text-red-800 font-medium">At Risk</div>
                  <div className="text-2xl font-bold text-red-900">
                    {formatCurrency(roiMetrics.monthlyAtRisk)}
                  </div>
                  <div className="text-sm text-red-700">Monthly potential loss</div>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="text-green-800 font-medium">Recovery Potential</div>
                  <div className="text-2xl font-bold text-green-900">
                    {formatCurrency(roiMetrics.potentialRecovery)}
                  </div>
                  <div className="text-sm text-green-700">Monthly opportunity</div>
                </div>
              </div>
              <div className="mt-4 text-center text-gray-600">
                <span className="font-medium">ROI Timeline:</span> {roiMetrics.paybackDays} days
              </div>
            </div>
          )}

          {/* Immediate Actions */}
          {data.critical_issues && data.critical_issues.length > 0 && (
            <div className="bg-white rounded-lg border shadow-sm p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                🎯 Immediate Actions
              </h3>
              <div className="space-y-3">
                {data.critical_issues.slice(0, 3).map((issue, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0">
                      {index + 1}
                    </div>
                    <div className="text-gray-700">{issue.fix}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Competitive Position */}
          {data.competitive_position && (
            <div className="bg-white rounded-lg border shadow-sm p-6">
              <h3 className="text-lg font-semibold mb-4">🏁 Market Position</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-gray-900">#{data.competitive_position.market_rank}</div>
                  <div className="text-sm text-gray-600">Market Rank</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900 capitalize">
                    {data.competitive_position.vs_average}
                  </div>
                  <div className="text-sm text-gray-600">vs. Market Average</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-900">Top Competitor</div>
                  <div className="text-sm text-gray-600">{data.competitive_position.top_competitor}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default DealershipAIAnalyzer