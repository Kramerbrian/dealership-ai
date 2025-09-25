import { useState, useEffect, useCallback } from 'react'
import { useToast } from 'react-hot-toast'
import { AIAnalysisResponse } from '@/lib/dealership-intelligence-client'

interface UseDealershipIntelligenceOptions {
  autoRefresh?: boolean
  refreshInterval?: number
  quick?: boolean
}

interface DealershipIntelligenceState {
  data: AIAnalysisResponse | null
  loading: boolean
  error: string | null
  lastUpdated: Date | null
}

interface DealershipReport {
  summary: string
  performance_breakdown: string[]
  critical_issues: string[]
  revenue_impact: string
  immediate_actions: string[]
}

export function useDealershipIntelligence(
  domain: string | null,
  options: UseDealershipIntelligenceOptions = {}
) {
  const { autoRefresh = false, refreshInterval = 300000, quick = false } = options
  const toast = useToast()

  const [state, setState] = useState<DealershipIntelligenceState>({
    data: null,
    loading: false,
    error: null,
    lastUpdated: null
  })

  const [report, setReport] = useState<DealershipReport | null>(null)

  const fetchAnalysis = useCallback(async (targetDomain: string, isQuick: boolean = quick) => {
    if (!targetDomain?.trim()) {
      setState(prev => ({ ...prev, error: 'Domain is required' }))
      return
    }

    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const params = new URLSearchParams({
        domain: targetDomain.trim(),
        quick: isQuick.toString(),
        format: 'json'
      })

      const response = await fetch(`/api/dealership-intelligence?${params}`)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `HTTP ${response.status}`)
      }

      const data = await response.json()

      setState({
        data,
        loading: false,
        error: null,
        lastUpdated: new Date()
      })

      // Generate formatted report
      if (data.scores) {
        const reportResponse = await fetch(`/api/dealership-intelligence?${new URLSearchParams({
          domain: targetDomain,
          format: 'report',
          quick: isQuick.toString()
        })}`)

        if (reportResponse.ok) {
          const reportData = await reportResponse.json()
          setReport(reportData.report)
        }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch analysis'
      setState({
        data: null,
        loading: false,
        error: errorMessage,
        lastUpdated: null
      })

      toast.error(`Analysis failed: ${errorMessage}`)
    }
  }, [quick, toast])

  const refresh = useCallback(() => {
    if (domain) {
      fetchAnalysis(domain, false) // Force fresh data on manual refresh
    }
  }, [domain, fetchAnalysis])

  const quickRefresh = useCallback(() => {
    if (domain) {
      fetchAnalysis(domain, true) // Use cache for quick refresh
    }
  }, [domain, fetchAnalysis])

  // Auto-fetch when domain changes
  useEffect(() => {
    if (domain) {
      fetchAnalysis(domain)
    } else {
      setState({
        data: null,
        loading: false,
        error: null,
        lastUpdated: null
      })
      setReport(null)
    }
  }, [domain, fetchAnalysis])

  // Auto-refresh functionality
  useEffect(() => {
    if (autoRefresh && domain && refreshInterval > 0) {
      const interval = setInterval(() => {
        fetchAnalysis(domain, true) // Use quick refresh for auto-refresh
      }, refreshInterval)

      return () => clearInterval(interval)
    }
  }, [autoRefresh, domain, refreshInterval, fetchAnalysis])

  // Helper functions for easier data access
  const getScoreGrade = (score: number): string => {
    if (score >= 90) return 'A+'
    if (score >= 80) return 'A'
    if (score >= 70) return 'B'
    if (score >= 60) return 'C'
    if (score >= 50) return 'D'
    return 'F'
  }

  const getCriticalIssuesCount = (): number => {
    return state.data?.critical_issues?.filter(issue => issue.severity === 'critical').length || 0
  }

  const getHighPriorityIssuesCount = (): number => {
    return state.data?.critical_issues?.filter(issue =>
      issue.severity === 'critical' || issue.severity === 'high'
    ).length || 0
  }

  const getROIMetrics = () => {
    if (!state.data?.roi_projection) return null

    return {
      monthlyAtRisk: state.data.roi_projection.monthly_at_risk,
      potentialRecovery: state.data.roi_projection.potential_recovery,
      paybackDays: state.data.roi_projection.payback_days,
      implementationCost: state.data.roi_projection.implementation_cost
    }
  }

  const getScoreInsights = () => {
    if (!state.data?.scores) return null

    const scores = state.data.scores
    return {
      aiVisibility: {
        score: scores.ai_visibility,
        grade: getScoreGrade(scores.ai_visibility),
        status: scores.ai_visibility >= 80 ? 'excellent' : scores.ai_visibility >= 60 ? 'good' : 'needs_improvement'
      },
      seoPerformance: {
        score: scores.seo_performance,
        grade: getScoreGrade(scores.seo_performance)
      },
      aeoReadiness: {
        score: scores.aeo_readiness,
        grade: getScoreGrade(scores.aeo_readiness)
      },
      geoOptimization: {
        score: scores.geo_optimization,
        grade: getScoreGrade(scores.geo_optimization)
      }
    }
  }

  return {
    // Core state
    ...state,

    // Formatted report
    report,

    // Actions
    refresh,
    quickRefresh,
    fetchAnalysis,

    // Helper functions
    getScoreGrade,
    getCriticalIssuesCount,
    getHighPriorityIssuesCount,
    getROIMetrics,
    getScoreInsights,

    // Computed values
    hasData: !!state.data,
    hasCriticalIssues: getCriticalIssuesCount() > 0,
    overallGrade: state.data?.scores?.ai_visibility ? getScoreGrade(state.data.scores.ai_visibility) : null,
    isStale: state.lastUpdated ? (Date.now() - state.lastUpdated.getTime()) > 900000 : false, // 15 minutes

    // Status indicators
    isLoading: state.loading,
    hasError: !!state.error,
    isReady: !state.loading && !state.error && !!state.data
  }
}

// Batch analysis hook for multiple domains
export function useBatchDealershipIntelligence() {
  const [state, setState] = useState<{
    results: Array<{ domain: string; success: boolean; data?: AIAnalysisResponse; error?: string }>
    loading: boolean
    error: string | null
  }>({
    results: [],
    loading: false,
    error: null
  })

  const analyzeBatch = useCallback(async (domains: string[], quick: boolean = true) => {
    if (!domains || domains.length === 0) {
      setState(prev => ({ ...prev, error: 'Domains array is required' }))
      return
    }

    if (domains.length > 10) {
      setState(prev => ({ ...prev, error: 'Maximum 10 domains allowed per batch' }))
      return
    }

    setState({ results: [], loading: true, error: null })

    try {
      const response = await fetch('/api/dealership-intelligence', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ domains, quick })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `HTTP ${response.status}`)
      }

      const data = await response.json()

      setState({
        results: data.results,
        loading: false,
        error: null
      })

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Batch analysis failed'
      setState({
        results: [],
        loading: false,
        error: errorMessage
      })
    }
  }, [])

  return {
    ...state,
    analyzeBatch,
    successCount: state.results.filter(r => r.success).length,
    failureCount: state.results.filter(r => !r.success).length
  }
}

export default useDealershipIntelligence