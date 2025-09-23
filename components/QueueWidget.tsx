'use client'

import React, { useState } from 'react'
import { useQueueMetrics, useQueueJobs, useQueueControl } from '../hooks/useQueue'

export default function QueueWidget({ queueName = 'default' }: { queueName?: string }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const { metrics, loading: metricsLoading } = useQueueMetrics(queueName, 5000)
  const { jobs, loading: jobsLoading, retryJob, removeJob } = useQueueJobs(queueName, { limit: 10 })
  const {
    control,
    pauseQueue,
    resumeQueue,
    drainQueue,
    actionLoading
  } = useQueueControl(queueName)

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'paused': return 'bg-yellow-100 text-yellow-800'
      case 'draining': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getJobStatusColor = (state: string) => {
    switch (state) {
      case 'active': return 'bg-blue-100 text-blue-800'
      case 'completed': return 'bg-green-100 text-green-800'
      case 'failed': return 'bg-red-100 text-red-800'
      case 'waiting': return 'bg-gray-100 text-gray-800'
      case 'delayed': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (metricsLoading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
          <div className="h-8 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div
        className="p-4 cursor-pointer hover:bg-gray-50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse"></div>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-900">Queue: {queueName}</h3>
              {metrics && (
                <p className="text-xs text-gray-500">
                  {metrics.active} active, {metrics.waiting} waiting, {metrics.failed} failed
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {control && (
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(control.status)}`}>
                {control.status}
              </span>
            )}
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-gray-200">
          {/* Queue Controls */}
          <div className="p-4 bg-gray-50">
            <div className="flex items-center space-x-2">
              {control?.can_pause && control.status !== 'paused' && (
                <button
                  onClick={(e) => { e.stopPropagation(); pauseQueue() }}
                  disabled={actionLoading}
                  className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  Pause
                </button>
              )}
              {control?.can_resume && control.status === 'paused' && (
                <button
                  onClick={(e) => { e.stopPropagation(); resumeQueue() }}
                  disabled={actionLoading}
                  className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  Resume
                </button>
              )}
              {control?.can_drain && (
                <button
                  onClick={(e) => { e.stopPropagation(); drainQueue() }}
                  disabled={actionLoading}
                  className="inline-flex items-center px-2.5 py-1.5 border border-orange-300 shadow-sm text-xs font-medium rounded text-orange-700 bg-orange-50 hover:bg-orange-100 disabled:opacity-50"
                >
                  Drain
                </button>
              )}
            </div>
          </div>

          {/* Queue Metrics */}
          {metrics && (
            <div className="p-4">
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-lg font-semibold text-gray-900">{metrics.total}</div>
                  <div className="text-xs text-gray-500">Total Jobs</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold text-blue-600">{metrics.throughput.per_minute}</div>
                  <div className="text-xs text-gray-500">Per Minute</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold text-green-600">{Math.round(metrics.performance.success_rate)}%</div>
                  <div className="text-xs text-gray-500">Success Rate</div>
                </div>
              </div>

              {/* Recent Jobs */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Recent Jobs</h4>
                {jobsLoading ? (
                  <div className="space-y-2">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="animate-pulse h-8 bg-gray-200 rounded"></div>
                    ))}
                  </div>
                ) : jobs.length > 0 ? (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {jobs.slice(0, 5).map((job) => (
                      <div key={job.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-xs">
                        <div className="flex items-center space-x-2 flex-1 min-w-0">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getJobStatusColor(job.state)}`}>
                            {job.state}
                          </span>
                          <span className="truncate">{job.name}</span>
                        </div>
                        {job.state === 'failed' && (
                          <div className="flex space-x-1 ml-2">
                            <button
                              onClick={() => retryJob(job.id)}
                              className="text-blue-600 hover:text-blue-800"
                              title="Retry"
                            >
                              ↻
                            </button>
                            <button
                              onClick={() => removeJob(job.id)}
                              className="text-red-600 hover:text-red-800"
                              title="Remove"
                            >
                              ✕
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No jobs found</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}