'use client'

import React, { useState, useEffect } from 'react'
import { usePrompts, usePromptPreview, usePromptExpand, usePromptRun } from '../hooks/usePrompts'

interface PromptPreviewPanelProps {
  isOpen: boolean
  onClose: () => void
  promptId?: string
}

export default function PromptPreviewPanel({ isOpen, onClose, promptId }: PromptPreviewPanelProps) {
  const [selectedPromptId, setSelectedPromptId] = useState<string>(promptId || '')
  const [variables, setVariables] = useState<Record<string, any>>({})
  const [activeTab, setActiveTab] = useState<'preview' | 'expand' | 'run'>('preview')

  const { prompts, loading: promptsLoading } = usePrompts()
  const { preview, previewPrompt, loading: previewLoading } = usePromptPreview()
  const { expanded, expandPrompt, loading: expandLoading } = usePromptExpand()
  const { result, runPrompt, loading: runLoading } = usePromptRun()

  const selectedPrompt = prompts.find(p => p.id === selectedPromptId)

  useEffect(() => {
    if (promptId) {
      setSelectedPromptId(promptId)
    }
  }, [promptId])

  useEffect(() => {
    if (selectedPrompt) {
      // Initialize variables with defaults
      const defaultVars: Record<string, any> = {}
      selectedPrompt.variables.forEach(variable => {
        if (variable.default !== undefined) {
          defaultVars[variable.name] = variable.default
        }
      })
      setVariables(defaultVars)
    }
  }, [selectedPrompt])

  const handleVariableChange = (name: string, value: any) => {
    setVariables(prev => ({ ...prev, [name]: value }))
  }

  const handlePreview = () => {
    if (selectedPromptId) {
      previewPrompt(selectedPromptId, variables)
    }
  }

  const handleExpand = () => {
    if (selectedPromptId) {
      expandPrompt(selectedPromptId, variables)
    }
  }

  const handleRun = () => {
    if (selectedPromptId) {
      runPrompt(selectedPromptId, variables)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" aria-labelledby="slide-over-title" role="dialog" aria-modal="true">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={onClose}></div>

        <div className="fixed inset-y-0 right-0 pl-10 max-w-full flex">
          <div className="w-screen max-w-2xl">
            <div className="h-full flex flex-col bg-white shadow-xl overflow-y-scroll">
              {/* Header */}
              <div className="px-4 py-6 bg-gray-50 sm:px-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-medium text-gray-900" id="slide-over-title">
                    Prompt Preview
                  </h2>
                  <div className="ml-3 h-7 flex items-center">
                    <button
                      type="button"
                      className="bg-gray-50 rounded-md text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      onClick={onClose}
                    >
                      <span className="sr-only">Close panel</span>
                      <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 px-4 py-6 sm:px-6">
                {/* Prompt Selection */}
                <div className="mb-6">
                  <label htmlFor="prompt-select" className="block text-sm font-medium text-gray-700 mb-2">
                    Select Prompt
                  </label>
                  <select
                    id="prompt-select"
                    value={selectedPromptId}
                    onChange={(e) => setSelectedPromptId(e.target.value)}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                  >
                    <option value="">Select a prompt...</option>
                    {prompts.map((prompt) => (
                      <option key={prompt.id} value={prompt.id}>
                        {prompt.title} ({prompt.category})
                      </option>
                    ))}
                  </select>
                </div>

                {selectedPrompt && (
                  <>
                    {/* Prompt Info */}
                    <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                      <h3 className="text-lg font-medium text-gray-900 mb-2">{selectedPrompt.title}</h3>
                      <div className="flex flex-wrap gap-2 mb-2">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {selectedPrompt.category}
                        </span>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {selectedPrompt.intent}
                        </span>
                        {selectedPrompt.tags.map(tag => (
                          <span key={tag} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            {tag}
                          </span>
                        ))}
                      </div>
                      <p className="text-sm text-gray-600">
                        Language: {selectedPrompt.language} | Variables: {selectedPrompt.variables.length}
                      </p>
                    </div>

                    {/* Variables */}
                    {selectedPrompt.variables.length > 0 && (
                      <div className="mb-6">
                        <h4 className="text-sm font-medium text-gray-900 mb-3">Variables</h4>
                        <div className="space-y-4">
                          {selectedPrompt.variables.map((variable) => (
                            <div key={variable.name}>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                {variable.name}
                                {variable.required && <span className="text-red-500">*</span>}
                              </label>
                              <p className="text-xs text-gray-500 mb-1">{variable.description}</p>
                              {variable.type === 'boolean' ? (
                                <select
                                  value={variables[variable.name] || ''}
                                  onChange={(e) => handleVariableChange(variable.name, e.target.value === 'true')}
                                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                                >
                                  <option value="false">False</option>
                                  <option value="true">True</option>
                                </select>
                              ) : variable.type === 'number' ? (
                                <input
                                  type="number"
                                  value={variables[variable.name] || ''}
                                  onChange={(e) => handleVariableChange(variable.name, parseFloat(e.target.value) || 0)}
                                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                                />
                              ) : (
                                <textarea
                                  value={variables[variable.name] || ''}
                                  onChange={(e) => handleVariableChange(variable.name, e.target.value)}
                                  rows={2}
                                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Tabs */}
                    <div className="border-b border-gray-200 mb-6">
                      <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                        {(['preview', 'expand', 'run'] as const).map((tab) => (
                          <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                              activeTab === tab
                                ? 'border-indigo-500 text-indigo-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                          >
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                          </button>
                        ))}
                      </nav>
                    </div>

                    {/* Tab Content */}
                    <div>
                      {activeTab === 'preview' && (
                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-sm font-medium text-gray-900">Preview</h4>
                            <button
                              onClick={handlePreview}
                              disabled={previewLoading}
                              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                            >
                              {previewLoading ? 'Loading...' : 'Preview'}
                            </button>
                          </div>
                          {preview && (
                            <div className="bg-gray-50 rounded-lg p-4">
                              <pre className="whitespace-pre-wrap text-sm">{preview.rendered_prompt || 'No preview available'}</pre>
                            </div>
                          )}
                        </div>
                      )}

                      {activeTab === 'expand' && (
                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-sm font-medium text-gray-900">Expand</h4>
                            <button
                              onClick={handleExpand}
                              disabled={expandLoading}
                              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                            >
                              {expandLoading ? 'Loading...' : 'Expand'}
                            </button>
                          </div>
                          {expanded && (
                            <div className="bg-gray-50 rounded-lg p-4">
                              <pre className="whitespace-pre-wrap text-sm">{expanded.expanded_prompt || 'No expanded content available'}</pre>
                              {expanded.metadata && (
                                <div className="mt-4 pt-4 border-t border-gray-200">
                                  <h5 className="text-xs font-medium text-gray-700 mb-2">Metadata</h5>
                                  <pre className="text-xs text-gray-600">{JSON.stringify(expanded.metadata, null, 2)}</pre>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {activeTab === 'run' && (
                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-sm font-medium text-gray-900">Run</h4>
                            <button
                              onClick={handleRun}
                              disabled={runLoading}
                              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                            >
                              {runLoading ? 'Running...' : 'Run Prompt'}
                            </button>
                          </div>
                          {result && (
                            <div className="space-y-4">
                              <div className="bg-gray-50 rounded-lg p-4">
                                <h5 className="text-sm font-medium text-gray-900 mb-2">Response</h5>
                                <pre className="whitespace-pre-wrap text-sm">{result.response || 'No response available'}</pre>
                              </div>
                              {result.metadata && (
                                <div className="bg-blue-50 rounded-lg p-4">
                                  <h5 className="text-sm font-medium text-blue-900 mb-2">Metadata</h5>
                                  <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                      <span className="font-medium">Engine:</span> {result.metadata.engine}
                                    </div>
                                    <div>
                                      <span className="font-medium">Model:</span> {result.metadata.model}
                                    </div>
                                    <div>
                                      <span className="font-medium">Tokens:</span> {result.metadata.tokens_used}
                                    </div>
                                    <div>
                                      <span className="font-medium">Cost:</span> ${result.metadata.cost?.toFixed(4)}
                                    </div>
                                    <div>
                                      <span className="font-medium">Latency:</span> {result.metadata.latency_ms}ms
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}