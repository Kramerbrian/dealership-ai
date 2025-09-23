"use client";
import { useState, useEffect } from 'react';
import { Card } from '@dealershipai/ui';
import { useQueueMetrics, useQueueJobs, useQueueControl } from '@/hooks';
import {
  Activity,
  Clock,
  CheckCircle,
  XCircle,
  Pause,
  Play,
  Trash2,
  BarChart3,
  RefreshCw,
  Eye,
  RotateCcw,
  X
} from 'lucide-react';

export default function QueueDashboard() {
  const { metrics, health, loading: metricsLoading, refresh } = useQueueMetrics(true, 5000);
  const { jobs, loading: jobsLoading, fetchJobs, retryJob, cancelJob } = useQueueJobs();
  const { pauseQueue, resumeQueue, clearQueue, loading: controlLoading } = useQueueControl();

  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedJob, setSelectedJob] = useState<any>(null);

  useEffect(() => {
    const filters = selectedStatus === 'all' ? {} : { status: selectedStatus as any };
    fetchJobs(filters);
  }, [selectedStatus, fetchJobs]);

  const handleRetryJob = async (jobId: string) => {
    const success = await retryJob(jobId);
    if (success) {
      fetchJobs();
    }
  };

  const handleCancelJob = async (jobId: string) => {
    const success = await cancelJob(jobId);
    if (success) {
      fetchJobs();
    }
  };

  const handleClearQueue = async (status?: string) => {
    await clearQueue(status as any);
    fetchJobs();
    refresh();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600';
      case 'failed': return 'text-red-600';
      case 'processing': return 'text-blue-600';
      case 'cancelled': return 'text-gray-600';
      default: return 'text-yellow-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'failed': return <XCircle className="w-4 h-4" />;
      case 'processing': return <Activity className="w-4 h-4 animate-spin" />;
      case 'cancelled': return <X className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Queue Management</h1>
        <button
          onClick={refresh}
          disabled={metricsLoading}
          className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${metricsLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Queue Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">{metrics?.pending || 0}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-600" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Processing</p>
                <p className="text-2xl font-bold text-blue-600">{metrics?.processing || 0}</p>
              </div>
              <Activity className="w-8 h-8 text-blue-600" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-green-600">{metrics?.completed || 0}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Failed</p>
                <p className="text-2xl font-bold text-red-600">{metrics?.failed || 0}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Queue Health */}
      {health && (
        <Card>
          <div className="p-4">
            <h3 className="text-lg font-semibold mb-4">Queue Health</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-600">Status</p>
                <p className={`text-lg font-semibold capitalize ${
                  health.status === 'active' ? 'text-green-600' :
                  health.status === 'idle' ? 'text-yellow-600' : 'text-gray-600'
                }`}>
                  {health.status}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Utilization</p>
                <p className="text-lg font-semibold">{health.utilization}%</p>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${health.utilization}%` }}
                  />
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-600">Success Rate</p>
                <p className="text-lg font-semibold text-green-600">{health.successRate}%</p>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                  <div
                    className="bg-green-600 h-2 rounded-full"
                    style={{ width: `${health.successRate}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Queue Controls */}
      <Card>
        <div className="p-4">
          <h3 className="text-lg font-semibold mb-4">Queue Controls</h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={pauseQueue}
              disabled={controlLoading}
              className="flex items-center gap-2 px-3 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50"
            >
              <Pause className="w-4 h-4" />
              Pause Queue
            </button>
            <button
              onClick={resumeQueue}
              disabled={controlLoading}
              className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              <Play className="w-4 h-4" />
              Resume Queue
            </button>
            <button
              onClick={() => handleClearQueue('failed')}
              disabled={controlLoading}
              className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              Clear Failed
            </button>
            <button
              onClick={() => handleClearQueue('completed')}
              disabled={controlLoading}
              className="flex items-center gap-2 px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              Clear Completed
            </button>
          </div>
        </div>
      </Card>

      {/* Job Status Filter */}
      <Card>
        <div className="p-4">
          <h3 className="text-lg font-semibold mb-4">Jobs</h3>
          <div className="flex gap-2 mb-4">
            {['all', 'pending', 'processing', 'completed', 'failed', 'cancelled'].map((status) => (
              <button
                key={status}
                onClick={() => setSelectedStatus(status)}
                className={`px-3 py-1 rounded text-sm capitalize ${
                  selectedStatus === status
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          {/* Jobs List */}
          <div className="space-y-2">
            {jobsLoading ? (
              <div className="text-center py-4">Loading jobs...</div>
            ) : jobs.length === 0 ? (
              <div className="text-center py-4 text-gray-500">No jobs found</div>
            ) : (
              jobs.map((job) => (
                <div key={job.id} className="border rounded p-3 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={getStatusColor(job.status)}>
                        {getStatusIcon(job.status)}
                      </span>
                      <div>
                        <p className="font-medium">{job.type}</p>
                        <p className="text-sm text-gray-600">
                          Created: {new Date(job.createdAt).toLocaleString()}
                        </p>
                        {job.processingTime && (
                          <p className="text-sm text-gray-600">
                            Processing time: {job.processingTime}ms
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedJob(job)}
                        className="p-1 text-gray-600 hover:text-gray-800"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {(job.status === 'failed' || job.status === 'cancelled') && (
                        <button
                          onClick={() => handleRetryJob(job.id)}
                          className="p-1 text-blue-600 hover:text-blue-800"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      )}
                      {(job.status === 'pending' || job.status === 'processing') && (
                        <button
                          onClick={() => handleCancelJob(job.id)}
                          className="p-1 text-red-600 hover:text-red-800"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  {job.error && (
                    <div className="mt-2 p-2 bg-red-50 rounded text-sm text-red-700">
                      Error: {job.error}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </Card>

      {/* Job Details Modal */}
      {selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl max-h-[80vh] overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">Job Details</h3>
              <button
                onClick={() => setSelectedJob(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <strong>ID:</strong> {selectedJob.id}
              </div>
              <div>
                <strong>Type:</strong> {selectedJob.type}
              </div>
              <div>
                <strong>Status:</strong>
                <span className={`ml-2 ${getStatusColor(selectedJob.status)}`}>
                  {selectedJob.status}
                </span>
              </div>
              <div>
                <strong>Priority:</strong> {selectedJob.priority}
              </div>
              <div>
                <strong>Attempts:</strong> {selectedJob.attempts} / {selectedJob.maxAttempts}
              </div>
              <div>
                <strong>Payload:</strong>
                <pre className="mt-2 p-3 bg-gray-100 rounded text-sm overflow-auto">
                  {JSON.stringify(selectedJob.payload, null, 2)}
                </pre>
              </div>
              {selectedJob.result && (
                <div>
                  <strong>Result:</strong>
                  <pre className="mt-2 p-3 bg-green-50 rounded text-sm overflow-auto">
                    {JSON.stringify(selectedJob.result, null, 2)}
                  </pre>
                </div>
              )}
              {selectedJob.error && (
                <div>
                  <strong>Error:</strong>
                  <div className="mt-2 p-3 bg-red-50 rounded text-sm text-red-700">
                    {selectedJob.error}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}