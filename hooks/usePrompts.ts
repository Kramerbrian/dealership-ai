import { useState, useEffect, useCallback } from 'react'

export interface Prompt {
  id: string
  title: string
  category: string
  intent: string
  personas: string[]
  language: string
  tags: string[]
  variables: Array<{
    name: string
    description: string
    type: string
    required: boolean
    default?: any
  }>
  engine_defaults: Record<string, any>
  rate_limit?: {
    requests_per_minute: number
    requests_per_hour: number
    requests_per_day: number
  }
}

export interface PromptStats {
  total: number
  by_category: Record<string, number>
  by_intent: Record<string, number>
  by_language: Record<string, number>
}

export interface UsePromptsOptions {
  category?: string
  intent?: string
  language?: string
  tags?: string
  validate?: boolean
}

export interface UsePromptsState {
  prompts: Prompt[]
  stats: PromptStats | null
  loading: boolean
  error: string | null
  validationErrors: any[]
}

export function usePrompts(options: UsePromptsOptions = {}) {
  const [state, setState] = useState<UsePromptsState>({
    prompts: [],
    stats: null,
    loading: false,
    error: null,
    validationErrors: [],
  })

  const fetchPrompts = useCallback(async (fetchOptions: UsePromptsOptions = {}) => {
    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const params = new URLSearchParams()

      if (fetchOptions.category) params.append('category', fetchOptions.category)
      if (fetchOptions.intent) params.append('intent', fetchOptions.intent)
      if (fetchOptions.language) params.append('language', fetchOptions.language)
      if (fetchOptions.tags) params.append('tags', fetchOptions.tags)
      if (fetchOptions.validate) params.append('validate', 'true')

      const response = await fetch(`/api/prompts?${params.toString()}`)

      if (!response.ok) {
        throw new Error(`Failed to fetch prompts: ${response.statusText}`)
      }

      const data = await response.json()

      setState(prev => ({
        ...prev,
        prompts: data.prompts || [],
        stats: data.stats || null,
        validationErrors: data.validation_errors || [],
        loading: false,
      }))
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to fetch prompts',
        loading: false,
      }))
    }
  }, [])

  useEffect(() => {
    fetchPrompts(options)
  }, [fetchPrompts, options.category, options.intent, options.language, options.tags, options.validate])

  const refetch = useCallback((newOptions?: UsePromptsOptions) => {
    return fetchPrompts(newOptions || options)
  }, [fetchPrompts, options])

  return {
    ...state,
    refetch,
  }
}

export function usePromptPreview() {
  const [state, setState] = useState({
    loading: false,
    error: null as string | null,
    preview: null as any,
  })

  const previewPrompt = useCallback(async (promptId: string, variables: Record<string, any> = {}) => {
    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const response = await fetch('/api/prompts/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt_id: promptId, variables }),
      })

      if (!response.ok) {
        throw new Error(`Failed to preview prompt: ${response.statusText}`)
      }

      const data = await response.json()

      setState(prev => ({
        ...prev,
        preview: data,
        loading: false,
      }))

      return data
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to preview prompt'
      setState(prev => ({
        ...prev,
        error: errorMessage,
        loading: false,
      }))
      throw error
    }
  }, [])

  return {
    ...state,
    previewPrompt,
  }
}

export function usePromptExpand() {
  const [state, setState] = useState({
    loading: false,
    error: null as string | null,
    expanded: null as any,
  })

  const expandPrompt = useCallback(async (promptId: string, variables: Record<string, any> = {}) => {
    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const response = await fetch('/api/prompts/expand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt_id: promptId, variables }),
      })

      if (!response.ok) {
        throw new Error(`Failed to expand prompt: ${response.statusText}`)
      }

      const data = await response.json()

      setState(prev => ({
        ...prev,
        expanded: data,
        loading: false,
      }))

      return data
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to expand prompt'
      setState(prev => ({
        ...prev,
        error: errorMessage,
        loading: false,
      }))
      throw error
    }
  }, [])

  return {
    ...state,
    expandPrompt,
  }
}

export function usePromptRun() {
  const [state, setState] = useState({
    loading: false,
    error: null as string | null,
    result: null as any,
  })

  const runPrompt = useCallback(async (
    promptId: string,
    variables: Record<string, any> = {},
    options: {
      engine?: string
      model?: string
      temperature?: number
      max_tokens?: number
      stream?: boolean
    } = {}
  ) => {
    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const response = await fetch('/api/prompts/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt_id: promptId,
          variables,
          ...options
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to run prompt: ${response.statusText}`)
      }

      const data = await response.json()

      setState(prev => ({
        ...prev,
        result: data,
        loading: false,
      }))

      return data
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to run prompt'
      setState(prev => ({
        ...prev,
        error: errorMessage,
        loading: false,
      }))
      throw error
    }
  }, [])

  return {
    ...state,
    runPrompt,
  }
}