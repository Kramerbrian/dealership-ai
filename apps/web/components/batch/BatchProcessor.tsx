"use client";
import { useState } from 'react';
import { Card } from '@dealershipai/ui';
import { usePromptPreview, usePromptExpand, useBatchRun } from '@/hooks';
import {
  Play,
  Eye,
  Settings,
  Upload,
  Download,
  AlertCircle,
  CheckCircle,
  Clock,
  DollarSign
} from 'lucide-react';

interface BatchProcessorProps {
  dealerId: string;
}

export default function BatchProcessor({ dealerId }: BatchProcessorProps) {
  const { preview, loading: previewLoading, data: previewData } = usePromptPreview();
  const { expand, loading: expandLoading, data: expandData } = usePromptExpand();
  const { run, loading: runLoading, data: runData } = useBatchRun();

  const [templateId, setTemplateId] = useState('');
  const [variables, setVariables] = useState('{}');
  const [settings, setSettings] = useState({
    model: 'gpt-3.5-turbo',
    temperature: 0.7,
    maxTokens: 1000,
    provider: 'openai' as 'openai' | 'anthropic',
  });
  const [options, setOptions] = useState({
    priority: 'normal' as 'low' | 'normal' | 'high',
    maxAttempts: 3,
  });
  const [currentStep, setCurrentStep] = useState<'setup' | 'preview' | 'run'>('setup');

  const parseVariables = () => {
    try {
      return JSON.parse(variables);
    } catch {
      return {};
    }
  };

  const handlePreview = async () => {
    const parsedVariables = parseVariables();
    await preview({ templateId, variables: parsedVariables });
    setCurrentStep('preview');
  };

  const handleExpand = async () => {
    const parsedVariables = parseVariables();
    await expand({
      templateId,
      variables: parsedVariables,
      options: { includeMetadata: true }
    });
  };

  const handleRun = async () => {
    const parsedVariables = parseVariables();
    await run({
      templateId,
      variables: parsedVariables,
      settings,
      options,
    });
    setCurrentStep('run');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Batch Processor</h1>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span>Dealer ID: {dealerId}</span>
        </div>
      </div>

      {/* Progress Steps */}
      <Card>
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div className={`flex items-center gap-2 ${currentStep === 'setup' ? 'text-blue-600' : 'text-green-600'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                currentStep === 'setup' ? 'bg-blue-100' : 'bg-green-100'
              }`}>
                {currentStep === 'setup' ? '1' : <CheckCircle className="w-5 h-5" />}
              </div>
              <span className="font-medium">Setup</span>
            </div>
            <div className="flex-1 h-px bg-gray-300 mx-4"></div>
            <div className={`flex items-center gap-2 ${
              currentStep === 'preview' ? 'text-blue-600' :
              currentStep === 'run' ? 'text-green-600' : 'text-gray-400'
            }`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                currentStep === 'preview' ? 'bg-blue-100' :
                currentStep === 'run' ? 'bg-green-100' : 'bg-gray-100'
              }`}>
                {currentStep === 'run' ? <CheckCircle className="w-5 h-5" /> : '2'}
              </div>
              <span className="font-medium">Preview</span>
            </div>
            <div className="flex-1 h-px bg-gray-300 mx-4"></div>
            <div className={`flex items-center gap-2 ${currentStep === 'run' ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                currentStep === 'run' ? 'bg-blue-100' : 'bg-gray-100'
              }`}>
                3
              </div>
              <span className="font-medium">Execute</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Setup Form */}
      <Card>
        <div className="p-4">
          <h3 className="text-lg font-semibold mb-4">Batch Configuration</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Template ID</label>
              <input
                type="text"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                placeholder="e.g., seo_audit_comprehensive"
                className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Variables (JSON)</label>
              <textarea
                value={variables}
                onChange={(e) => setVariables(e.target.value)}
                placeholder='{"dealer_name": "Toyota Naples", "website_url": "https://example.com"}'
                rows={4}
                className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
              />
              {variables && (() => {
                try {
                  JSON.parse(variables);
                  return (
                    <div className="flex items-center gap-2 text-sm text-green-600 mt-1">
                      <CheckCircle className="w-4 h-4" />
                      Valid JSON
                    </div>
                  );
                } catch {
                  return (
                    <div className="flex items-center gap-2 text-sm text-red-600 mt-1">
                      <AlertCircle className="w-4 h-4" />
                      Invalid JSON syntax
                    </div>
                  );
                }
              })()}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">AI Provider</label>
                <select
                  value={settings.provider}
                  onChange={(e) => setSettings({ ...settings, provider: e.target.value as 'openai' | 'anthropic' })}
                  className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                >
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Model</label>
                <select
                  value={settings.model}
                  onChange={(e) => setSettings({ ...settings, model: e.target.value })}
                  className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                >
                  {settings.provider === 'openai' ? (
                    <>
                      <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                      <option value="gpt-4">GPT-4</option>
                      <option value="gpt-4-turbo-preview">GPT-4 Turbo</option>
                    </>
                  ) : (
                    <>
                      <option value="claude-3-haiku-20240307">Claude 3 Haiku</option>
                      <option value="claude-3-sonnet-20240229">Claude 3 Sonnet</option>
                      <option value="claude-3-opus-20240229">Claude 3 Opus</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Temperature</label>
                <input
                  type="number"
                  min="0"
                  max="2"
                  step="0.1"
                  value={settings.temperature}
                  onChange={(e) => setSettings({ ...settings, temperature: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Max Tokens</label>
                <input
                  type="number"
                  min="1"
                  max="8000"
                  value={settings.maxTokens}
                  onChange={(e) => setSettings({ ...settings, maxTokens: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Priority</label>
                <select
                  value={options.priority}
                  onChange={(e) => setOptions({ ...options, priority: e.target.value as 'low' | 'normal' | 'high' })}
                  className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Max Attempts</label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={options.maxAttempts}
                  onChange={(e) => setOptions({ ...options, maxAttempts: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handlePreview}
                disabled={!templateId || previewLoading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                <Eye className="w-4 h-4" />
                {previewLoading ? 'Previewing...' : 'Preview'}
              </button>

              <button
                onClick={handleExpand}
                disabled={!templateId || expandLoading}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                <Settings className="w-4 h-4" />
                {expandLoading ? 'Expanding...' : 'Expand'}
              </button>

              <button
                onClick={handleRun}
                disabled={!templateId || runLoading}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
              >
                <Play className="w-4 h-4" />
                {runLoading ? 'Queuing...' : 'Run Batch'}
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Preview Results */}
      {previewData && (
        <Card>
          <div className="p-4">
            <h3 className="text-lg font-semibold mb-4">Preview Results</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-blue-50 rounded">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-blue-600" />
                  <span className="font-medium">Estimated Cost</span>
                </div>
                <span className="text-xl font-bold text-blue-600">
                  {formatCurrency(previewData.estimatedCost)}
                </span>
              </div>

              <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                <span className="font-medium">Estimated Tokens</span>
                <span className="text-lg font-semibold">
                  {previewData.estimatedTokens.toLocaleString()}
                </span>
              </div>

              <div>
                <h4 className="font-medium mb-2">Expanded Prompt Preview</h4>
                <div className="p-3 bg-gray-100 rounded text-sm whitespace-pre-wrap max-h-60 overflow-y-auto">
                  {previewData.expandedPrompt}
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Expand Results */}
      {expandData && (
        <Card>
          <div className="p-4">
            <h3 className="text-lg font-semibold mb-4">Expansion Results</h3>
            <div className="space-y-4">
              {expandData.validation && (
                <div className="space-y-2">
                  {expandData.validation.missingVariables.length > 0 && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded">
                      <AlertCircle className="w-5 h-5 text-red-600" />
                      <span className="text-red-800">
                        Missing variables: {expandData.validation.missingVariables.join(', ')}
                      </span>
                    </div>
                  )}
                  {expandData.validation.invalidVariables.length > 0 && (
                    <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded">
                      <AlertCircle className="w-5 h-5 text-yellow-600" />
                      <span className="text-yellow-800">
                        Invalid variables: {expandData.validation.invalidVariables.join(', ')}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div>
                <h4 className="font-medium mb-2">Final Expanded Prompt</h4>
                <div className="p-3 bg-gray-100 rounded text-sm whitespace-pre-wrap max-h-60 overflow-y-auto">
                  {expandData.expandedPrompt}
                </div>
              </div>

              {expandData.metadata && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-3 bg-blue-50 rounded">
                    <p className="text-sm text-blue-600">Template ID</p>
                    <p className="font-medium">{expandData.metadata.templateId}</p>
                  </div>
                  <div className="p-3 bg-green-50 rounded">
                    <p className="text-sm text-green-600">Estimated Tokens</p>
                    <p className="font-medium">{expandData.metadata.estimatedTokens.toLocaleString()}</p>
                  </div>
                  <div className="p-3 bg-purple-50 rounded">
                    <p className="text-sm text-purple-600">Estimated Cost</p>
                    <p className="font-medium">{formatCurrency(expandData.metadata.estimatedCost)}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Run Results */}
      {runData && (
        <Card>
          <div className="p-4">
            <h3 className="text-lg font-semibold mb-4">Batch Job Queued</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-green-800 font-medium">{runData.message}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-3 bg-blue-50 rounded">
                  <p className="text-sm text-blue-600">Job ID</p>
                  <p className="font-mono text-sm">{runData.jobId}</p>
                </div>
                {runData.queuePosition && (
                  <div className="p-3 bg-yellow-50 rounded">
                    <p className="text-sm text-yellow-600">Queue Position</p>
                    <p className="font-medium">#{runData.queuePosition}</p>
                  </div>
                )}
                {runData.estimatedCost && (
                  <div className="p-3 bg-purple-50 rounded">
                    <p className="text-sm text-purple-600">Estimated Cost</p>
                    <p className="font-medium">{formatCurrency(runData.estimatedCost)}</p>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Clock className="w-4 h-4" />
                <span>
                  Your job has been queued for processing. You can monitor its progress in the Queue Dashboard.
                </span>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}