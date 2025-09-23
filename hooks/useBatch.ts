import { useState, useCallback } from 'react'

export interface BatchTest {
  id: string
  name: string
  description: string
  prompts: Array<{
    prompt_id: string
    variables: Record<string, any>
    expected_outputs?: string[]
    evaluation_criteria?: string[]
  }>
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  results?: BatchTestResult[]
  created_at: string
  started_at?: string
  completed_at?: string
  progress: number
  total_prompts: number
  completed_prompts: number
  failed_prompts: number
}

export interface BatchTestResult {
  prompt_id: string
  variables: Record<string, any>
  response: {
    text: string
    metadata: {
      engine: string
      model: string
      tokens_used: number
      cost: number
      latency_ms: number
    }
  }
  evaluation: {
    scores: Record<string, number>
    passed: boolean
    feedback: string
  }
  status: 'success' | 'failed' | 'error'
  error?: string
}

export interface BatchTestSummary {
  total_tests: number
  running_tests: number
  completed_tests: number
  failed_tests: number
  average_score: number
  total_cost: number
  total_tokens: number
  success_rate: number
}

export function useBatchTests() {
  const [state, setState] = useState({
    tests: [] as BatchTest[],
    summary: null as BatchTestSummary | null,
    loading: true,
    error: null as string | null,
  })

  const fetchTests = useCallback(async (options: {
    status?: string
    limit?: number
    offset?: number
  } = {}) => {
    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const params = new URLSearchParams()
      if (options.status) params.append('status', options.status)
      if (options.limit) params.append('limit', options.limit.toString())
      if (options.offset) params.append('offset', options.offset.toString())

      const response = await fetch(`/api/batch/tests?${params.toString()}`)

      if (!response.ok) {
        throw new Error(`Failed to fetch batch tests: ${response.statusText}`)
      }

      const data = await response.json()

      setState(prev => ({
        ...prev,
        tests: data.tests || [],
        summary: data.summary || null,
        loading: false,
      }))
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to fetch batch tests',
        loading: false,
      }))
    }
  }, [])

  const createTest = useCallback(async (testData: {
    name: string
    description: string
    prompts: Array<{
      prompt_id: string
      variables: Record<string, any>
      expected_outputs?: string[]
      evaluation_criteria?: string[]
    }>
  }) => {
    try {
      const response = await fetch('/api/batch/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testData),
      })

      if (!response.ok) {
        throw new Error(`Failed to create batch test: ${response.statusText}`)
      }

      const data = await response.json()
      await fetchTests()
      return data
    } catch (error) {
      console.error('Failed to create batch test:', error)
      throw error
    }
  }, [fetchTests])

  const runTest = useCallback(async (testId: string) => {
    try {
      const response = await fetch(`/api/batch/run/${testId}`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error(`Failed to run batch test: ${response.statusText}`)
      }

      const data = await response.json()
      await fetchTests()
      return data
    } catch (error) {
      console.error('Failed to run batch test:', error)
      throw error
    }
  }, [fetchTests])

  const cancelTest = useCallback(async (testId: string) => {
    try {
      const response = await fetch(`/api/batch/cancel/${testId}`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error(`Failed to cancel batch test: ${response.statusText}`)
      }

      await fetchTests()
      return true
    } catch (error) {
      console.error('Failed to cancel batch test:', error)
      return false
    }
  }, [fetchTests])

  const deleteTest = useCallback(async (testId: string) => {
    try {
      const response = await fetch(`/api/batch/tests/${testId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error(`Failed to delete batch test: ${response.statusText}`)
      }

      await fetchTests()
      return true
    } catch (error) {
      console.error('Failed to delete batch test:', error)
      return false
    }
  }, [fetchTests])

  return {
    ...state,
    refetch: fetchTests,
    createTest,
    runTest,
    cancelTest,
    deleteTest,
  }
}

export function useBatchTestDetails(testId: string) {
  const [state, setState] = useState({
    test: null as BatchTest | null,
    loading: true,
    error: null as string | null,
  })

  const fetchTestDetails = useCallback(async () => {
    if (!testId) return

    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const response = await fetch(`/api/batch/tests/${testId}`)

      if (!response.ok) {
        throw new Error(`Failed to fetch test details: ${response.statusText}`)
      }

      const data = await response.json()

      setState(prev => ({
        ...prev,
        test: data,
        loading: false,
      }))
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to fetch test details',
        loading: false,
      }))
    }
  }, [testId])

  const exportResults = useCallback(async (format: 'json' | 'csv') => {
    if (!testId) return

    try {
      const response = await fetch(`/api/batch/export/${testId}?format=${format}`)

      if (!response.ok) {
        throw new Error(`Failed to export results: ${response.statusText}`)
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url
      a.download = `batch-test-${testId}.${format}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Failed to export results:', error)
      throw error
    }
  }, [testId])

  return {
    ...state,
    refetch: fetchTestDetails,
    exportResults,
  }
}