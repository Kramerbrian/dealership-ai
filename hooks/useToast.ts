import { useState, useCallback, useEffect } from 'react'

export interface Toast {
  id: string
  title: string
  message?: string
  type: 'success' | 'error' | 'warning' | 'info'
  duration?: number
  persistent?: boolean
  action?: {
    label: string
    onClick: () => void
  }
  timestamp: number
}

const TOAST_DURATION = 5000 // 5 seconds

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((toast: Omit<Toast, 'id' | 'timestamp'>) => {
    const id = Math.random().toString(36).substr(2, 9)
    const newToast: Toast = {
      ...toast,
      id,
      timestamp: Date.now(),
      duration: toast.duration ?? TOAST_DURATION,
    }

    setToasts(prev => [...prev, newToast])

    // Auto-remove toast after duration unless it's persistent
    if (!toast.persistent && newToast.duration > 0) {
      setTimeout(() => {
        removeToast(id)
      }, newToast.duration)
    }

    return id
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }, [])

  const clearAll = useCallback(() => {
    setToasts([])
  }, [])

  // Convenience methods
  const success = useCallback((title: string, message?: string, options?: Partial<Toast>) => {
    return addToast({ ...options, title, message, type: 'success' })
  }, [addToast])

  const error = useCallback((title: string, message?: string, options?: Partial<Toast>) => {
    return addToast({ ...options, title, message, type: 'error', duration: 0, persistent: true })
  }, [addToast])

  const warning = useCallback((title: string, message?: string, options?: Partial<Toast>) => {
    return addToast({ ...options, title, message, type: 'warning' })
  }, [addToast])

  const info = useCallback((title: string, message?: string, options?: Partial<Toast>) => {
    return addToast({ ...options, title, message, type: 'info' })
  }, [addToast])

  return {
    toasts,
    addToast,
    removeToast,
    clearAll,
    success,
    error,
    warning,
    info,
  }
}

// Global toast context provider hook
let globalToastManager: ReturnType<typeof useToast> | null = null

export function useGlobalToast() {
  const [, forceUpdate] = useState({})

  useEffect(() => {
    if (!globalToastManager) {
      const manager = useToast()
      globalToastManager = {
        ...manager,
        addToast: (toast) => {
          const id = manager.addToast(toast)
          forceUpdate({})
          return id
        },
        removeToast: (id) => {
          manager.removeToast(id)
          forceUpdate({})
        },
        clearAll: () => {
          manager.clearAll()
          forceUpdate({})
        },
      }
    }
  }, [])

  return globalToastManager!
}

// Utility for showing API errors
export function useAPIErrorToast() {
  const toast = useToast()

  const showAPIError = useCallback((error: any, context = 'Operation failed') => {
    let message = 'An unexpected error occurred'

    if (error instanceof Error) {
      message = error.message
    } else if (typeof error === 'string') {
      message = error
    } else if (error?.message) {
      message = error.message
    }

    toast.error(context, message, {
      action: {
        label: 'Retry',
        onClick: () => window.location.reload(),
      },
    })
  }, [toast])

  return { showAPIError }
}