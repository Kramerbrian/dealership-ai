// /agents/AgentLoader.tsx
import React, { useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

// Types
export interface AgentConfig {
  id: string;
  name: string;
  provider: 'claude' | 'chatgpt' | 'perplexity' | 'gemini';
  endpoint?: string;
  model?: string;
  priority: number;
  fallbackAgent?: string;
  capabilities: string[];
  costPerRequest: number;
  rateLimit: {
    requests: number;
    window: number; // seconds
  };
}

export interface AgentManifest {
  inputs: Record<string, {
    type: string;
    required: boolean;
    description: string;
  }>;
  outputs: Record<string, {
    type: string;
    description: string;
  }>;
  timeout: number;
  retries: number;
}

export interface AgentTask {
  id: string;
  blockId: string;
  agentId: string;
  taskType: string;
  inputs: Record<string, any>;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'escalated';
  result?: any;
  error?: string;
  escalatedTo?: string;
  createdAt: string;
  completedAt?: string;
}

export interface AgentRegistry {
  agents: Record<string, AgentConfig>;
  manifests: Record<string, AgentManifest>;
  routing: Record<string, string[]>; // taskType -> agentIds in priority order
}

// Default Agent Registry - Enhanced for Authority Schema
const DEFAULT_REGISTRY: AgentRegistry = {
  agents: {
    'claude-sonnet': {
      id: 'claude-sonnet',
      name: 'Claude Sonnet',
      provider: 'claude',
      model: 'claude-3-sonnet-20240229',
      priority: 1,
      capabilities: ['schema-analysis', 'technical-seo', 'content-analysis', 'authority-validation'],
      costPerRequest: 0.003,
      rateLimit: { requests: 1000, window: 3600 }
    },
    'chatgpt-4': {
      id: 'chatgpt-4',
      name: 'ChatGPT-4',
      provider: 'chatgpt',
      model: 'gpt-4-1106-preview',
      priority: 2,
      fallbackAgent: 'claude-sonnet',
      capabilities: ['voice-optimization', 'content-strategy', 'competitive-analysis', 'ugc-analysis'],
      costPerRequest: 0.01,
      rateLimit: { requests: 500, window: 3600 }
    },
    'perplexity': {
      id: 'perplexity',
      name: 'Perplexity',
      provider: 'perplexity',
      model: 'pplx-7b-online',
      priority: 3,
      capabilities: ['real-time-search', 'competitive-intel', 'market-research', 'ai-platform-testing'],
      costPerRequest: 0.001,
      rateLimit: { requests: 2000, window: 3600 }
    },
    'gemini': {
      id: 'gemini',
      name: 'Gemini Pro',
      provider: 'gemini',
      model: 'gemini-pro',
      priority: 4,
      capabilities: ['local-search', 'business-validation', 'review-analysis', 'authority-scoring'],
      costPerRequest: 0.0005,
      rateLimit: { requests: 1500, window: 3600 }
    }
  },
  manifests: {
    'schema-analysis': {
      inputs: {
        domain: { type: 'string', required: true, description: 'Domain to analyze' },
        schemaTypes: { type: 'array', required: false, description: 'Specific schema types to check' },
        business: { type: 'object', required: false, description: 'Business information' }
      },
      outputs: {
        score: { type: 'number', description: 'Schema completeness score 0-100' },
        issues: { type: 'array', description: 'Array of schema issues found' },
        recommendations: { type: 'array', description: 'Actionable recommendations' },
        authoritySignals: { type: 'array', description: 'Authority signals detected' }
      },
      timeout: 30000,
      retries: 2
    },
    'authority-validation': {
      inputs: {
        domain: { type: 'string', required: true, description: 'Domain to validate' },
        certifications: { type: 'array', required: false, description: 'Expected certifications' },
        awards: { type: 'array', required: false, description: 'Expected awards' },
        staff: { type: 'array', required: false, description: 'Staff credentials to verify' }
      },
      outputs: {
        authorityScore: { type: 'number', description: 'Overall authority score 0-100' },
        eatScores: { type: 'object', description: 'E-E-A-T component scores' },
        validatedSignals: { type: 'array', description: 'Validated authority signals' },
        improvements: { type: 'array', description: 'Improvement recommendations' }
      },
      timeout: 45000,
      retries: 1
    },
    'ai-platform-testing': {
      inputs: {
        business: { type: 'object', required: true, description: 'Business info object' },
        queries: { type: 'array', required: true, description: 'Test queries' },
        platforms: { type: 'array', required: false, description: 'Platforms to test' }
      },
      outputs: {
        platformScores: { type: 'object', description: 'Scores by AI platform' },
        visibilityRate: { type: 'number', description: 'Overall visibility percentage' },
        rankings: { type: 'object', description: 'Ranking positions by platform' },
        recommendations: { type: 'array', description: 'Platform-specific optimizations' }
      },
      timeout: 60000,
      retries: 2
    },
    'ugc-analysis': {
      inputs: {
        business: { type: 'object', required: true, description: 'Business information' },
        platforms: { type: 'array', required: true, description: 'UGC platforms to analyze' }
      },
      outputs: {
        overallRating: { type: 'number', description: 'Weighted average rating' },
        reviewCount: { type: 'number', description: 'Total review count' },
        sentimentScore: { type: 'number', description: 'Sentiment analysis score 0-100' },
        responseRate: { type: 'number', description: 'Business response rate percentage' },
        trustSignals: { type: 'array', description: 'Trust signals identified' }
      },
      timeout: 30000,
      retries: 1
    }
  },
  routing: {
    'schema-analysis': ['claude-sonnet', 'chatgpt-4'],
    'authority-validation': ['claude-sonnet', 'gemini'],
    'ai-platform-testing': ['perplexity', 'chatgpt-4'],
    'ugc-analysis': ['chatgpt-4', 'claude-sonnet'],
    'competitive-intel': ['perplexity', 'chatgpt-4'],
    'technical-audit': ['claude-sonnet']
  }
};

// Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Agent Loader Hook
export function useAgentLoader(registry: AgentRegistry = DEFAULT_REGISTRY) {
  const [tasks, setTasks] = useState<Record<string, AgentTask>>({});
  const [rateLimits, setRateLimits] = useState<Record<string, { count: number; resetTime: number }>>({});

  // Rate limiting check
  const checkRateLimit = useCallback((agentId: string): boolean => {
    const agent = registry.agents[agentId];
    const limit = rateLimits[agentId];

    if (!limit) return true;

    const now = Date.now();
    if (now > limit.resetTime) {
      setRateLimits(prev => ({ ...prev, [agentId]: { count: 0, resetTime: now + agent.rateLimit.window * 1000 } }));
      return true;
    }

    return limit.count < agent.rateLimit.requests;
  }, [registry.agents, rateLimits]);

  // Execute agent task
  const executeTask = useCallback(async (
    taskType: string,
    inputs: Record<string, any>,
    blockId: string,
    options?: { preferredAgent?: string; timeout?: number; dealerId?: string }
  ): Promise<AgentTask> => {
    const taskId = `${blockId}_${taskType}_${Date.now()}`;

    // Get agent priority list
    const agentIds = options?.preferredAgent
      ? [options.preferredAgent]
      : registry.routing[taskType] || [];

    if (agentIds.length === 0) {
      throw new Error(`No agents configured for task type: ${taskType}`);
    }

    // Create task record
    const task: AgentTask = {
      id: taskId,
      blockId,
      agentId: agentIds[0],
      taskType,
      inputs: { ...inputs, dealerId: options?.dealerId },
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    setTasks(prev => ({ ...prev, [taskId]: task }));

    // Try agents in priority order
    for (const agentId of agentIds) {
      if (!checkRateLimit(agentId)) {
        console.warn(`Rate limit exceeded for agent: ${agentId}`);
        continue;
      }

      const agent = registry.agents[agentId];
      const manifest = registry.manifests[taskType];

      try {
        // Update task status
        setTasks(prev => ({
          ...prev,
          [taskId]: { ...prev[taskId], status: 'running', agentId }
        }));

        // Update rate limit
        setRateLimits(prev => ({
          ...prev,
          [agentId]: {
            count: (prev[agentId]?.count || 0) + 1,
            resetTime: prev[agentId]?.resetTime || Date.now() + agent.rateLimit.window * 1000
          }
        }));

        // Execute the agent
        const result = await executeAgent(agent, manifest, task.inputs, options?.timeout || manifest.timeout);

        // Update task with result
        const completedTask = {
          ...task,
          status: 'completed' as const,
          result,
          completedAt: new Date().toISOString(),
          agentId
        };

        setTasks(prev => ({ ...prev, [taskId]: completedTask }));

        // Log to Supabase if available
        try {
          await supabase.from('agent_tasks').insert({
            id: taskId,
            block_id: blockId,
            agent_id: agentId,
            task_type: taskType,
            inputs: JSON.stringify(task.inputs),
            result: JSON.stringify(result),
            status: 'completed',
            created_at: task.createdAt,
            completed_at: completedTask.completedAt
          });
        } catch (dbError) {
          console.warn('Failed to log to Supabase:', dbError);
        }

        return completedTask;

      } catch (error) {
        console.error(`Agent ${agentId} failed:`, error);

        // If this was the last agent, escalate
        if (agentId === agentIds[agentIds.length - 1]) {
          const escalatedTask = await escalateTask(task, error as Error);
          setTasks(prev => ({ ...prev, [taskId]: escalatedTask }));
          return escalatedTask;
        }

        // Try next agent
        continue;
      }
    }

    throw new Error('All agents failed for task');
  }, [registry, checkRateLimit]);

  // Escalate task to human or premium agent
  const escalateTask = useCallback(async (task: AgentTask, error: Error): Promise<AgentTask> => {
    const escalatedTask: AgentTask = {
      ...task,
      status: 'escalated',
      error: error.message,
      escalatedTo: 'human-review',
      completedAt: new Date().toISOString()
    };

    // Log escalation to Supabase if available
    try {
      await supabase.from('agent_escalations').insert({
        task_id: task.id,
        block_id: task.blockId,
        original_agent: task.agentId,
        error_message: error.message,
        escalated_to: 'human-review',
        escalated_at: new Date().toISOString()
      });
    } catch (dbError) {
      console.warn('Failed to log escalation to Supabase:', dbError);
    }

    return escalatedTask;
  }, []);

  return {
    executeTask,
    tasks,
    registry,
    escalateTask
  };
}

// Agent execution function
async function executeAgent(
  agent: AgentConfig,
  manifest: AgentManifest,
  inputs: Record<string, any>,
  timeout: number
): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    let response: Response;

    switch (agent.provider) {
      case 'claude':
        // Check if using Vertex AI setup
        const useVertex = process.env.CLAUDE_CODE_USE_VERTEX === '1';
        const baseUrl = useVertex
          ? process.env.ANTHROPIC_VERTEX_BASE_URL || 'https://litellm-server:4000/vertex_ai/v1'
          : 'https://api.anthropic.com/v1/messages';

        const headers: Record<string, string> = {
          'Content-Type': 'application/json'
        };

        if (useVertex) {
          // Vertex AI via LiteLLM setup
          headers['Authorization'] = `Bearer ${process.env.ANTHROPIC_API_KEY || 'dummy-key'}`;
          if (process.env.ANTHROPIC_VERTEX_PROJECT_ID) {
            headers['x-vertex-project-id'] = process.env.ANTHROPIC_VERTEX_PROJECT_ID;
          }
          if (process.env.CLOUD_ML_REGION) {
            headers['x-vertex-region'] = process.env.CLOUD_ML_REGION;
          }
        } else {
          // Direct Anthropic API
          headers['x-api-key'] = process.env.ANTHROPIC_API_KEY!;
          headers['anthropic-version'] = '2023-06-01';
        }

        response = await fetch(baseUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: agent.model,
            max_tokens: 4000,
            messages: [{
              role: 'user',
              content: generateAuthorityPrompt(manifest, inputs)
            }]
          }),
          signal: controller.signal
        });
        break;

      case 'chatgpt':
        response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY!}`
          },
          body: JSON.stringify({
            model: agent.model,
            messages: [{
              role: 'user',
              content: generateAuthorityPrompt(manifest, inputs)
            }],
            max_tokens: 4000
          }),
          signal: controller.signal
        });
        break;

      case 'perplexity':
        response = await fetch('https://api.perplexity.ai/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY!}`
          },
          body: JSON.stringify({
            model: agent.model,
            messages: [{
              role: 'user',
              content: generateAuthorityPrompt(manifest, inputs)
            }]
          }),
          signal: controller.signal
        });
        break;

      case 'gemini':
        response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${agent.model}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: generateAuthorityPrompt(manifest, inputs)
              }]
            }]
          }),
          signal: controller.signal
        });
        break;

      default:
        throw new Error(`Unsupported provider: ${agent.provider}`);
    }

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Agent request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Extract content based on provider
    let content: string;
    switch (agent.provider) {
      case 'claude':
        content = data.content[0]?.text || '';
        break;
      case 'chatgpt':
      case 'perplexity':
        content = data.choices[0]?.message?.content || '';
        break;
      case 'gemini':
        content = data.candidates[0]?.content?.parts[0]?.text || '';
        break;
      default:
        content = '';
    }

    // Parse JSON response
    try {
      return JSON.parse(content);
    } catch (e) {
      throw new Error(`Agent returned invalid JSON: ${content}`);
    }

  } finally {
    clearTimeout(timeoutId);
  }
}

// Generate authority-focused prompt for agent
function generateAuthorityPrompt(manifest: AgentManifest, inputs: Record<string, any>): string {
  const basePrompt = `You are an AI agent specialized in dealership authority and AI platform optimization. Respond with valid JSON only.

Expected inputs: ${JSON.stringify(manifest.inputs, null, 2)}
Expected outputs: ${JSON.stringify(manifest.outputs, null, 2)}

Input data: ${JSON.stringify(inputs, null, 2)}

Focus on E-E-A-T signals (Experience, Expertise, Authoritativeness, Trustworthiness) and authority schema validation.
Respond with a JSON object matching the expected outputs structure exactly.`;

  // Add task-specific context
  if (inputs.taskType === 'authority-validation') {
    return basePrompt + `

Additional context: Evaluate authority signals including:
- Staff certifications (ASE, manufacturer)
- Business awards and recognition
- Years in operation and experience
- Customer reviews and ratings
- Professional memberships and accreditations`;
  }

  if (inputs.taskType === 'ai-platform-testing') {
    return basePrompt + `

Additional context: Test visibility across AI platforms:
- ChatGPT mention rates and ranking
- Perplexity search result inclusion
- Gemini local business recognition
- Microsoft Copilot business recommendations
- Overall query success rates`;
  }

  return basePrompt;
}

// Agent Status Badge Component
export function AgentStatusBadge({ task }: { task?: AgentTask }) {
  if (!task) return null;

  const getStatusColor = (status: AgentTask['status']) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'running': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'escalated': return 'bg-red-100 text-red-800 border-red-200';
      case 'failed': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: AgentTask['status']) => {
    switch (status) {
      case 'completed': return '✅';
      case 'running': return '⟳';
      case 'escalated': return '⚠️';
      case 'failed': return '❌';
      default: return '⏳';
    }
  };

  return (
    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(task.status)}`}>
      <span>{getStatusIcon(task.status)}</span>
      <span className="font-mono">{task.agentId}</span>
      <span>•</span>
      <span>{task.status}</span>
    </div>
  );
}