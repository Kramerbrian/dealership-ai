import { useState, useCallback } from 'react'

export interface SchemaValidationResult {
  url: string
  status: 'success' | 'error' | 'no_schema'
  schemas_found: number
  validation_results: SchemaValidation[]
  issues: Issue[]
  score: number
  html_title?: string
  meta_description?: string
  error?: string
}

export interface SchemaValidation {
  type: string
  valid: boolean
  required_fields_present: string[]
  missing_required_fields: string[]
  recommended_fields_present: string[]
  missing_recommended_fields: string[]
  errors: string[]
  warnings: string[]
}

export interface Issue {
  severity: 'error' | 'warning' | 'info'
  type: string
  field?: string
  message: string
}

export interface SchemaValidationSummary {
  total_urls: number
  successful_validations: number
  failed_validations: number
  no_schema_found: number
  total_schemas: number
  average_score: number
  total_errors: number
  total_warnings: number
}

export function useSchemaValidation() {
  const [state, setState] = useState({
    results: [] as SchemaValidationResult[],
    summary: null as SchemaValidationSummary | null,
    loading: false,
    error: null as string | null,
  })

  const validateURLs = useCallback(async (
    urls: string[],
    options: {
      dealer_id?: string
      validation_types?: string[]
    } = {}
  ) => {
    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const response = await fetch('/api/schema/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urls,
          ...options,
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to validate schemas: ${response.statusText}`)
      }

      const data = await response.json()

      setState(prev => ({
        ...prev,
        results: data.validation_results || [],
        summary: data.summary || null,
        loading: false,
      }))

      return data
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to validate schemas'
      setState(prev => ({
        ...prev,
        error: errorMessage,
        loading: false,
      }))
      throw error
    }
  }, [])

  const clearResults = useCallback(() => {
    setState({
      results: [],
      summary: null,
      loading: false,
      error: null,
    })
  }, [])

  return {
    ...state,
    validateURLs,
    clearResults,
  }
}

export function useSingleSchemaValidation() {
  const [state, setState] = useState({
    result: null as SchemaValidationResult | null,
    loading: false,
    error: null as string | null,
  })

  const validateURL = useCallback(async (
    url: string,
    options: {
      dealer_id?: string
      validation_types?: string[]
    } = {}
  ) => {
    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const response = await fetch('/api/schema/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urls: [url],
          ...options,
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to validate schema: ${response.statusText}`)
      }

      const data = await response.json()
      const result = data.validation_results?.[0] || null

      setState(prev => ({
        ...prev,
        result,
        loading: false,
      }))

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to validate schema'
      setState(prev => ({
        ...prev,
        error: errorMessage,
        loading: false,
      }))
      throw error
    }
  }, [])

  const clearResult = useCallback(() => {
    setState({
      result: null,
      loading: false,
      error: null,
    })
  }, [])

  return {
    ...state,
    validateURL,
    clearResult,
  }
}