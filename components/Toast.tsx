'use client'

import React, { useEffect } from 'react'
import { useToast, Toast as ToastType } from '../hooks/useToast'

interface ToastItemProps {
  toast: ToastType
  onRemove: (id: string) => void
}

function ToastItem({ toast, onRemove }: ToastItemProps) {
  useEffect(() => {
    if (!toast.persistent && toast.duration > 0) {
      const timer = setTimeout(() => onRemove(toast.id), toast.duration)
      return () => clearTimeout(timer)
    }
  }, [toast.id, toast.duration, toast.persistent, onRemove])

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return (
          <div className="flex-shrink-0">
            <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        )
      case 'error':
        return (
          <div className="flex-shrink-0">
            <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center">
              <svg className="w-3 h-3 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        )
      case 'warning':
        return (
          <div className="flex-shrink-0">
            <div className="w-5 h-5 rounded-full bg-yellow-100 flex items-center justify-center">
              <svg className="w-3 h-3 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        )
      case 'info':
        return (
          <div className="flex-shrink-0">
            <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center">
              <svg className="w-3 h-3 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        )
    }
  }

  const getBackgroundColor = () => {
    switch (toast.type) {
      case 'success': return 'bg-green-50 border-green-200'
      case 'error': return 'bg-red-50 border-red-200'
      case 'warning': return 'bg-yellow-50 border-yellow-200'
      case 'info': return 'bg-blue-50 border-blue-200'
      default: return 'bg-gray-50 border-gray-200'
    }
  }

  return (
    <div className={`p-4 border rounded-lg shadow-sm ${getBackgroundColor()} transition-all duration-300 ease-in-out`}>
      <div className="flex">
        {getIcon()}
        <div className="ml-3 flex-1">
          <p className="text-sm font-medium text-gray-900">{toast.title}</p>
          {toast.message && (
            <p className="mt-1 text-sm text-gray-700">{toast.message}</p>
          )}
          {toast.action && (
            <div className="mt-2">
              <button
                className="text-sm font-medium text-blue-600 hover:text-blue-500"
                onClick={toast.action.onClick}
              >
                {toast.action.label}
              </button>
            </div>
          )}
        </div>
        <div className="ml-4 flex-shrink-0 flex">
          <button
            className="inline-flex text-gray-400 hover:text-gray-600 focus:outline-none focus:text-gray-600"
            onClick={() => onRemove(toast.id)}
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ToastContainer() {
  const { toasts, removeToast } = useToast()

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 w-96">
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onRemove={removeToast}
        />
      ))}
    </div>
  )
}