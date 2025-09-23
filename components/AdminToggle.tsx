'use client'

import React, { useState, useEffect } from 'react'

interface AdminToggleProps {
  onToggle?: (isAdmin: boolean) => void
  className?: string
}

export default function AdminToggle({ onToggle, className = '' }: AdminToggleProps) {
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    // Load admin state from localStorage on mount
    const savedAdminState = localStorage.getItem('dealershipai-admin-mode')
    if (savedAdminState) {
      const adminState = JSON.parse(savedAdminState)
      setIsAdmin(adminState)
      onToggle?.(adminState)
    }
  }, [onToggle])

  const handleToggle = async () => {
    setIsLoading(true)

    try {
      const newAdminState = !isAdmin

      // Save to localStorage
      localStorage.setItem('dealershipai-admin-mode', JSON.stringify(newAdminState))

      // Update state
      setIsAdmin(newAdminState)
      onToggle?.(newAdminState)

      // Optional: You could also make an API call here to validate admin privileges
      // await fetch('/api/admin/toggle', { method: 'POST', body: JSON.stringify({ admin: newAdminState }) })

    } catch (error) {
      console.error('Failed to toggle admin mode:', error)
      // Revert on error
      setIsAdmin(!isAdmin)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      <span className={`text-sm font-medium ${isAdmin ? 'text-red-700' : 'text-gray-700'}`}>
        {isAdmin ? 'Admin Mode' : 'User Mode'}
      </span>

      <button
        type="button"
        onClick={handleToggle}
        disabled={isLoading}
        className={`${
          isAdmin ? 'bg-red-600' : 'bg-gray-200'
        } ${
          isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        } relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2`}
        role="switch"
        aria-checked={isAdmin}
        aria-label="Toggle admin mode"
      >
        <span
          aria-hidden="true"
          className={`${
            isAdmin ? 'translate-x-5' : 'translate-x-0'
          } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
        />
      </button>

      {isAdmin && (
        <div className="flex items-center space-x-1">
          <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span className="text-xs text-red-600 font-medium">DEBUG</span>
        </div>
      )}
    </div>
  )
}

// Hook to use admin state throughout the app
export function useAdmin() {
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const savedAdminState = localStorage.getItem('dealershipai-admin-mode')
    if (savedAdminState) {
      setIsAdmin(JSON.parse(savedAdminState))
    }

    // Listen for storage changes (for multi-tab sync)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'dealershipai-admin-mode' && e.newValue) {
        setIsAdmin(JSON.parse(e.newValue))
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  const toggleAdmin = (newState?: boolean) => {
    const adminState = newState !== undefined ? newState : !isAdmin
    localStorage.setItem('dealershipai-admin-mode', JSON.stringify(adminState))
    setIsAdmin(adminState)
  }

  return { isAdmin, toggleAdmin }
}