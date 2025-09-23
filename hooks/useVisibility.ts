import { useState, useCallback, useEffect } from 'react'

export interface PlatformScore {
  chatgpt: number
  claude: number
  perplexity: number
  gemini: number
}

export interface VisibilityData {
  overall_score: number
  platform_scores: PlatformScore
  trend: 'up' | 'down' | 'stable'
  change_percentage: number
  last_updated: string
  recommendations: Array<{
    priority: 'high' | 'medium' | 'low'
    category: string
    title: string
    description: string
    estimated_impact: string
  }>
}

export interface VisibilityHistory {
  date: string
  overall_score: number
  platform_scores: PlatformScore
}

// Platform weights for overall visibility calculation
const PLATFORM_WEIGHTS = {
  chatgpt: 0.35,
  claude: 0.3,
  perplexity: 0.2,
  gemini: 0.15
}

export function overallVisibility(platformScores: PlatformScore): number {
  return Math.round(
    platformScores.chatgpt * PLATFORM_WEIGHTS.chatgpt +
    platformScores.claude * PLATFORM_WEIGHTS.claude +
    platformScores.perplexity * PLATFORM_WEIGHTS.perplexity +
    platformScores.gemini * PLATFORM_WEIGHTS.gemini
  )
}

export function useVisibility(dealerId?: string) {
  const [state, setState] = useState({
    data: null as VisibilityData | null,
    loading: true,
    error: null as string | null,
  })

  const fetchVisibility = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const params = new URLSearchParams()
      if (dealerId) params.append('dealer_id', dealerId)

      const response = await fetch(`/api/visibility?${params.toString()}`)

      if (!response.ok) {
        throw new Error(`Failed to fetch visibility data: ${response.statusText}`)
      }

      const data = await response.json()

      setState(prev => ({
        ...prev,
        data,
        loading: false,
      }))
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to fetch visibility data',
        loading: false,
      }))
    }
  }, [dealerId])

  useEffect(() => {
    fetchVisibility()
  }, [fetchVisibility])

  return {
    ...state,
    refetch: fetchVisibility,
  }
}

export function useVisibilityHistory(dealerId?: string, days = 30) {
  const [state, setState] = useState({
    history: [] as VisibilityHistory[],
    loading: true,
    error: null as string | null,
  })

  const fetchHistory = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const params = new URLSearchParams({ days: days.toString() })
      if (dealerId) params.append('dealer_id', dealerId)

      const response = await fetch(`/api/visibility/history?${params.toString()}`)

      if (!response.ok) {
        throw new Error(`Failed to fetch visibility history: ${response.statusText}`)
      }

      const data = await response.json()

      setState(prev => ({
        ...prev,
        history: data.history || [],
        loading: false,
      }))
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to fetch visibility history',
        loading: false,
      }))
    }
  }, [dealerId, days])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  return {
    ...state,
    refetch: fetchHistory,
  }
}

export function useVisibilityAudit(dealerId?: string) {
  const [state, setState] = useState({
    loading: false,
    error: null as string | null,
    results: null as any,
  })

  const runAudit = useCallback(async (options: {
    deep_scan?: boolean
    include_competitors?: boolean
    platforms?: string[]
  } = {}) => {
    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const response = await fetch('/api/visibility/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealer_id: dealerId,
          ...options,
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to run visibility audit: ${response.statusText}`)
      }

      const data = await response.json()

      setState(prev => ({
        ...prev,
        results: data,
        loading: false,
      }))

      return data
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to run visibility audit'
      setState(prev => ({
        ...prev,
        error: errorMessage,
        loading: false,
      }))
      throw error
    }
  }, [dealerId])

  return {
    ...state,
    runAudit,
  }
}

export function useCompetitorAnalysis(dealerId?: string) {
  const [state, setState] = useState({
    competitors: [] as Array<{
      name: string
      visibility_score: number
      platform_scores: PlatformScore
      gap_analysis: Record<string, number>
    }>,
    loading: true,
    error: null as string | null,
  })

  const fetchCompetitors = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const params = new URLSearchParams()
      if (dealerId) params.append('dealer_id', dealerId)

      const response = await fetch(`/api/visibility/competitors?${params.toString()}`)

      if (!response.ok) {
        throw new Error(`Failed to fetch competitor data: ${response.statusText}`)
      }

      const data = await response.json()

      setState(prev => ({
        ...prev,
        competitors: data.competitors || [],
        loading: false,
      }))
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to fetch competitor data',
        loading: false,
      }))
    }
  }, [dealerId])

  useEffect(() => {
    fetchCompetitors()
  }, [fetchCompetitors])

  return {
    ...state,
    refetch: fetchCompetitors,
  }
}