import { useState, useEffect, useCallback } from 'react'

export interface QueueJob {
  id: string
  name: string
  data: any
  opts: {
    delay?: number
    priority?: number
    attempts?: number
    backoff?: string | number
    removeOnComplete?: boolean | number
    removeOnFail?: boolean | number
  }
  progress: number
  timestamp: number
  processedOn?: number
  finishedOn?: number
  failedReason?: string
  returnvalue?: any
  attemptsMade: number
  stacktrace?: string[]
  delay: number
  priority: number
  state: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'paused'
}

export interface QueueMetrics {
  waiting: number
  active: number
  completed: number
  failed: number
  delayed: number
  paused: number
  total: number
  throughput: {
    per_minute: number
    per_hour: number
    per_day: number
  }
  performance: {
    avg_processing_time_ms: number
    success_rate: number
    failure_rate: number
  }
  memory_usage: {
    queue_size_mb: number
    jobs_in_memory: number
  }
}

export interface QueueControl {
  status: 'active' | 'paused' | 'draining'
  can_pause: boolean
  can_resume: boolean
  can_drain: boolean
  can_obliterate: boolean
}

export function useQueueMetrics(queueName = 'default', refreshInterval = 5000) {
  const [state, setState] = useState({
    metrics: null as QueueMetrics | null,
    loading: true,
    error: null as string | null,
  })

  const fetchMetrics = useCallback(async () => {
    try {
      const response = await fetch(`/api/queue/metrics?queue=${queueName}`)

      if (!response.ok) {
        throw new Error(`Failed to fetch metrics: ${response.statusText}`)
      }

      const data = await response.json()
      setState(prev => ({ ...prev, metrics: data.metrics, loading: false, error: null }))
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to fetch metrics',
        loading: false,
      }))
    }
  }, [queueName])

  useEffect(() => {
    fetchMetrics()

    if (refreshInterval > 0) {
      const interval = setInterval(fetchMetrics, refreshInterval)
      return () => clearInterval(interval)
    }
  }, [fetchMetrics, refreshInterval])

  return {
    ...state,
    refetch: fetchMetrics,
  }
}

export function useQueueJobs(queueName = 'default', options = {}) {
  const [state, setState] = useState({
    jobs: [] as QueueJob[],
    totalCount: 0,
    loading: true,
    error: null as string | null,
  })

  const fetchJobs = useCallback(async (fetchOptions: {
    state?: string
    limit?: number
    offset?: number
    search?: string
  } = {}) => {
    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const params = new URLSearchParams({
        queue: queueName,
        ...fetchOptions,
        limit: fetchOptions.limit?.toString() || '50',
        offset: fetchOptions.offset?.toString() || '0',
      })

      if (fetchOptions.state) params.append('state', fetchOptions.state)
      if (fetchOptions.search) params.append('search', fetchOptions.search)

      const response = await fetch(`/api/queue/jobs?${params.toString()}`)

      if (!response.ok) {
        throw new Error(`Failed to fetch jobs: ${response.statusText}`)
      }

      const data = await response.json()

      setState(prev => ({
        ...prev,
        jobs: data.jobs || [],
        totalCount: data.total_count || 0,
        loading: false,
      }))
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to fetch jobs',
        loading: false,
      }))
    }
  }, [queueName])

  useEffect(() => {
    fetchJobs(options)
  }, [fetchJobs, JSON.stringify(options)])

  const retryJob = useCallback(async (jobId: string) => {
    try {
      const response = await fetch(`/api/queue/job/${jobId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'retry' }),
      })

      if (!response.ok) {
        throw new Error(`Failed to retry job: ${response.statusText}`)
      }

      await fetchJobs()
      return true
    } catch (error) {
      console.error('Failed to retry job:', error)
      return false
    }
  }, [fetchJobs])

  const removeJob = useCallback(async (jobId: string) => {
    try {
      const response = await fetch(`/api/queue/job/${jobId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error(`Failed to remove job: ${response.statusText}`)
      }

      await fetchJobs()
      return true
    } catch (error) {
      console.error('Failed to remove job:', error)
      return false
    }
  }, [fetchJobs])

  return {
    ...state,
    refetch: fetchJobs,
    retryJob,
    removeJob,
  }
}

export function useQueueControl(queueName = 'default') {
  const [state, setState] = useState({
    control: null as QueueControl | null,
    loading: true,
    error: null as string | null,
    actionLoading: false,
  })

  const fetchControl = useCallback(async () => {
    try {
      const response = await fetch(`/api/queue/control?queue=${queueName}`)

      if (!response.ok) {
        throw new Error(`Failed to fetch control status: ${response.statusText}`)
      }

      const data = await response.json()
      setState(prev => ({ ...prev, control: data, loading: false, error: null }))
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to fetch control status',
        loading: false,
      }))
    }
  }, [queueName])

  useEffect(() => {
    fetchControl()
  }, [fetchControl])

  const executeAction = useCallback(async (action: 'pause' | 'resume' | 'drain' | 'obliterate') => {
    setState(prev => ({ ...prev, actionLoading: true, error: null }))

    try {
      const response = await fetch('/api/queue/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queue: queueName, action }),
      })

      if (!response.ok) {
        throw new Error(`Failed to execute ${action}: ${response.statusText}`)
      }

      await fetchControl()
      setState(prev => ({ ...prev, actionLoading: false }))
      return true
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : `Failed to execute ${action}`,
        actionLoading: false,
      }))
      return false
    }
  }, [queueName, fetchControl])

  const bulkAction = useCallback(async (action: 'retry' | 'remove', jobIds: string[]) => {
    setState(prev => ({ ...prev, actionLoading: true, error: null }))

    try {
      const response = await fetch('/api/queue/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queue: queueName, action, job_ids: jobIds }),
      })

      if (!response.ok) {
        throw new Error(`Failed to execute bulk ${action}: ${response.statusText}`)
      }

      setState(prev => ({ ...prev, actionLoading: false }))
      return true
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : `Failed to execute bulk ${action}`,
        actionLoading: false,
      }))
      return false
    }
  }, [queueName])

  return {
    ...state,
    refetch: fetchControl,
    pauseQueue: () => executeAction('pause'),
    resumeQueue: () => executeAction('resume'),
    drainQueue: () => executeAction('drain'),
    obliterateQueue: () => executeAction('obliterate'),
    bulkRetry: (jobIds: string[]) => bulkAction('retry', jobIds),
    bulkRemove: (jobIds: string[]) => bulkAction('remove', jobIds),
  }
}