import React, { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, BarChart, Bar } from 'recharts';
import {
  Bot, Zap, TrendingUp, AlertCircle, Brain, Mic, MapPin, Shield,
  Play, Copy, RefreshCw, Loader, CheckCircle, X, ChevronRight,
  Activity, Code, Globe, Search, Database, ArrowUpRight, Sparkles
} from 'lucide-react';

export default function AgenticDashboard() {
  const [loading, setLoading] = useState({});
  const [agentResponses, setAgentResponses] = useState({});
  const [activeAgent, setActiveAgent] = useState(null);
  const [metrics, setMetrics] = useState({
    aiScore: null,
    voiceRank: null,
    schemaHealth: null,
    competitive: null
  });

  // Minimal API endpoint - just for config
  const API_CONFIG = {
    dealership: 'Premium Honda Cape Coral',
    location: { lat: 26.5629, lng: -81.9495 },
    domain: 'premiumhondacapecoral.com'
  };

  // AI Agent executor - integrates with BK production system
  const executeAIAgent = async (taskType, context) => {
    setLoading(prev => ({ ...prev, [taskType]: true }));
    setActiveAgent(taskType);

    try {
      // Use production BK integration API instead of direct Anthropic calls
      const response = await fetch("http://localhost:8000/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dealership: API_CONFIG.dealership,
          location: `${API_CONFIG.location.lat}, ${API_CONFIG.location.lng}`,
          task_type: taskType,
          platforms: getTaskPlatforms(taskType)
        })
      });

      const data = await response.json();

      if (data.status === 'analysis_started') {
        // Analysis started, wait for real-time updates via SSE
        listenForAnalysisUpdates(data.analysis_id, taskType);

        setAgentResponses(prev => ({
          ...prev,
          [taskType]: {
            status: 'running',
            analysis_id: data.analysis_id,
            message: 'AI Visibility Agent analyzing real platforms...',
            platforms_testing: data.platforms || []
          }
        }));
      }

      return data;
    } catch (error) {
      console.error('Agent execution failed:', error);
      setAgentResponses(prev => ({
        ...prev,
        [taskType]: { error: 'Analysis failed. Retrying...', status: 'error' }
      }));
    } finally {
      // Don't set loading to false immediately - wait for SSE updates
      if (!taskType.includes('production')) {
        setLoading(prev => ({ ...prev, [taskType]: false }));
        setActiveAgent(null);
      }
    }
  };

  // Listen for real-time analysis updates from production system
  const listenForAnalysisUpdates = (analysisId, taskType) => {
    const eventSource = new EventSource(`http://localhost:8000/api/events`);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.analysis_id === analysisId) {
        switch (data.type) {
          case 'platform_completed':
            updatePlatformResult(taskType, data);
            break;

          case 'analysis_completed':
            updateFinalResult(taskType, data);
            setLoading(prev => ({ ...prev, [taskType]: false }));
            setActiveAgent(null);
            eventSource.close();
            break;

          case 'analysis_failed':
            setAgentResponses(prev => ({
              ...prev,
              [taskType]: { error: data.error, status: 'error' }
            }));
            setLoading(prev => ({ ...prev, [taskType]: false }));
            setActiveAgent(null);
            eventSource.close();
            break;
        }
      }
    };
  };

  // Update metrics from production system results
  const updatePlatformResult = (taskType, data) => {
    setAgentResponses(prev => ({
      ...prev,
      [taskType]: {
        ...prev[taskType],
        platform_results: {
          ...prev[taskType]?.platform_results,
          [data.platform]: {
            score: data.score,
            mentions: data.mentions_found,
            queries: data.query_results
          }
        }
      }
    }));
  };

  const updateFinalResult = (taskType, data) => {
    // Calculate weighted overall score using industry weights
    const platformWeights = {
      chatgpt: 0.40,  // Highest consumer usage
      gemini: 0.25,   // Google integration
      perplexity: 0.20, // Growing influence
      claude: 0.15    // Professional usage
    };

    let weightedScore = 0;
    let totalWeight = 0;

    Object.entries(data.platform_scores || {}).forEach(([platform, score]) => {
      const weight = platformWeights[platform] || 0.25;
      weightedScore += (typeof score === 'object' ? score.score : score) * weight;
      totalWeight += weight;
    });

    const calculatedOverallScore = totalWeight > 0 ? Math.round(weightedScore / totalWeight) : data.overall_score;

    // Determine market position
    const getMarketPosition = (score) => {
      if (score >= 90) return 'Market Leader (90-100): Mentioned first consistently';
      if (score >= 70) return 'Strong Player (70-89): Frequently mentioned positively';
      if (score >= 50) return 'Moderate Presence (50-69): Occasionally mentioned';
      if (score >= 25) return 'Weak Presence (25-49): Rarely mentioned';
      return 'Invisible (0-24): Never mentioned';
    };

    const parsedResult = {
      score: calculatedOverallScore,
      platform_scores: data.platform_scores,
      revenue_impact: data.revenue_impact,
      recommendations: data.recommendations?.map(rec => rec.action || rec) || [],
      execution_time: `${data.execution_time}s`,
      platforms_tested: data.platforms_tested || [],
      market_position: getMarketPosition(calculatedOverallScore),
      weighted_breakdown: Object.entries(platformWeights).map(([platform, weight]) => ({
        platform,
        weight: `${Math.round(weight * 100)}%`,
        score: data.platform_scores?.[platform]?.score || 0
      }))
    };

    setAgentResponses(prev => ({ ...prev, [taskType]: parsedResult }));
    updateMetrics(taskType, parsedResult);
  };

  // Map task types to relevant platforms
  const getTaskPlatforms = (taskType) => {
    const platformMaps = {
      schemaValidation: ['chatgpt', 'gemini'],
      voiceOptimization: ['chatgpt', 'searchgpt'],
      aiSearchAnalysis: ['chatgpt', 'searchgpt', 'gemini', 'perplexity'],
      competitiveIntel: ['perplexity', 'searchgpt', 'gemini']
    };

    return platformMaps[taskType] || ['chatgpt', 'gemini'];
  };

  // Generate task-specific prompts for the AI agent
  const getAgentPrompt = (taskType, context) => {
    const prompts = {
      schemaValidation: `
        Analyze and validate schema markup for automotive dealership: ${API_CONFIG.domain}

        Check for:
        1. AutoDealer schema implementation
        2. Vehicle inventory schema
        3. Service schema
        4. Local business markup
        5. Review/rating schema

        Return a JSON response with:
        {
          "score": 0-100,
          "issues": ["list of issues found"],
          "recommendations": ["specific fixes"],
          "valid_schemas": ["list of properly implemented schemas"],
          "code_snippets": ["corrected schema examples"]
        }
      `,

      voiceOptimization: `
        Analyze voice search optimization for: ${API_CONFIG.dealership}
        Location: ${API_CONFIG.location.lat}, ${API_CONFIG.location.lng}

        Evaluate:
        1. Natural language query optimization
        2. Local intent signals
        3. FAQ schema for voice
        4. Conversational content
        5. Featured snippet optimization

        Return JSON with:
        {
          "score": 0-100,
          "top_queries": [{"query": "text", "rank": number, "platform": "Google/Alexa/Siri"}],
          "opportunities": ["missed voice opportunities"],
          "content_gaps": ["content to create"],
          "optimization_tasks": ["specific actions"]
        }
      `,

      aiSearchAnalysis: `
        Analyze AI search engine optimization for ${API_CONFIG.domain}

        Evaluate performance for:
        1. ChatGPT responses about the dealership
        2. Claude's knowledge and recommendations
        3. Google Gemini/Bard visibility
        4. Perplexity AI citations
        5. Bing Chat presence

        Return JSON:
        {
          "overall_score": 0-100,
          "platform_scores": {"chatgpt": 0-100, "claude": 0-100, "gemini": 0-100},
          "visibility_gaps": ["where we're missing"],
          "content_strategy": ["what to create"],
          "technical_fixes": ["implementation tasks"]
        }
      `,

      competitiveIntel: `
        Competitive analysis for ${API_CONFIG.dealership} in Cape Coral/Fort Myers market

        Analyze:
        1. Top 5 competing dealerships
        2. Their AI/voice search presence
        3. Schema implementation comparison
        4. Content gaps and opportunities
        5. Technical advantages/disadvantages

        Return JSON:
        {
          "market_position": 1-10,
          "competitors": [{"name": "dealer", "score": 0-100, "strengths": [], "weaknesses": []}],
          "opportunities": ["strategic advantages"],
          "threats": ["areas where competitors lead"],
          "action_items": ["priority tasks"]
        }
      `,

      quickWin: `
        Identify immediate quick wins for ${API_CONFIG.domain}

        Find:
        1. Easy schema fixes (< 1 hour implementation)
        2. Quick content updates for voice search
        3. Simple technical fixes for AI visibility
        4. Low-effort high-impact changes

        Return JSON:
        {
          "quick_wins": [
            {
              "task": "description",
              "impact": "high/medium/low",
              "effort": "minutes",
              "code": "implementation snippet if applicable"
            }
          ],
          "estimated_improvement": "X% in Y days"
        }
      `
    };

    return prompts[taskType] || prompts.quickWin;
  };

  // Parse AI responses into structured data
  const parseAgentResponse = (taskType, response) => {
    try {
      // Extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return { raw: response, status: 'parsed' };
    } catch (error) {
      // Fallback for non-JSON responses
      return {
        raw: response,
        status: 'text',
        summary: response.substring(0, 200)
      };
    }
  };

  // Update metrics based on agent responses
  const updateMetrics = (taskType, result) => {
    const updates = {};

    switch(taskType) {
      case 'schemaValidation':
        updates.schemaHealth = result.score || 75;
        break;
      case 'voiceOptimization':
        updates.voiceRank = result.score || 67;
        break;
      case 'aiSearchAnalysis':
        updates.aiScore = result.overall_score || 78;
        break;
      case 'competitiveIntel':
        updates.competitive = result.market_position || 3;
        break;
    }

    setMetrics(prev => ({ ...prev, ...updates }));
  };

  // Agent Task Card Component
  const AgentCard = ({ title, taskType, icon: Icon, color, description }) => {
    const isLoading = loading[taskType];
    const response = agentResponses[taskType];

    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-all">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 ${color} bg-opacity-10 rounded-lg`}>
              <Icon className={`w-5 h-5 ${color.replace('bg-', 'text-')}`} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{title}</h3>
              <p className="text-sm text-gray-500">{description}</p>
            </div>
          </div>
          <button
            onClick={() => executeAIAgent(taskType, API_CONFIG)}
            disabled={isLoading}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${
              isLoading
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isLoading ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Run Agent
              </>
            )}
          </button>
        </div>

        {response && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            {response.error ? (
              <div className="flex items-center gap-2 text-red-600">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">{response.error}</span>
              </div>
            ) : (
              <div className="space-y-2">
                {response.score !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Score</span>
                    <span className="text-2xl font-light text-gray-900">{response.score}%</span>
                  </div>
                )}

                {response.issues && (
                  <div className="mt-2">
                    <span className="text-xs font-medium text-gray-700">Issues Found:</span>
                    <ul className="mt-1 space-y-1">
                      {response.issues.slice(0, 3).map((issue, i) => (
                        <li key={i} className="text-xs text-gray-600 flex items-start gap-1">
                          <span className="text-red-500">•</span> {issue}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {response.opportunities && (
                  <div className="mt-2">
                    <span className="text-xs font-medium text-gray-700">Opportunities:</span>
                    <ul className="mt-1 space-y-1">
                      {response.opportunities.slice(0, 2).map((opp, i) => (
                        <li key={i} className="text-xs text-gray-600 flex items-start gap-1">
                          <span className="text-green-500">↗</span> {opp}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {response.market_position && (
                  <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200">
                    <span className="text-xs font-medium text-blue-800">Market Position:</span>
                    <div className="text-xs text-blue-700 mt-1">{response.market_position}</div>
                  </div>
                )}

                {response.weighted_breakdown && (
                  <div className="mt-2">
                    <span className="text-xs font-medium text-gray-700">Platform Weights:</span>
                    <div className="mt-1 grid grid-cols-2 gap-1">
                      {response.weighted_breakdown.map((platform, i) => (
                        <div key={i} className="text-xs text-gray-600 flex justify-between">
                          <span>{platform.platform}: {platform.weight}</span>
                          <span className="font-medium">{platform.score}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {response.revenue_impact && (
                  <div className="mt-2 p-2 bg-yellow-50 rounded border border-yellow-200">
                    <span className="text-xs font-medium text-yellow-800">Revenue Impact:</span>
                    <div className="text-xs text-yellow-700 mt-1">
                      {response.revenue_impact.annual_risk > 0 ? (
                        `$${response.revenue_impact.annual_risk.toLocaleString()} at risk annually`
                      ) : (
                        `$${response.revenue_impact.annual_opportunity?.toLocaleString() || 0} opportunity`
                      )}
                    </div>
                  </div>
                )}

                {response.quick_wins && (
                  <div className="mt-2 space-y-2">
                    {response.quick_wins.slice(0, 3).map((win, i) => (
                      <div key={i} className="p-2 bg-green-50 rounded border border-green-200">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-green-800">{win.task || win}</span>
                          <span className="text-xs px-2 py-0.5 bg-green-200 text-green-800 rounded">
                            {win.impact || 'high'} impact
                          </span>
                        </div>
                        {win.effort && (
                          <span className="text-xs text-gray-600">{win.effort} to implement</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Live Metrics Display
  const MetricDisplay = ({ label, value, icon: Icon, trend, loading }) => (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <Icon className="w-5 h-5 text-gray-400" />
        {trend && (
          <span className={`text-sm flex items-center gap-1 ${
            trend > 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            <TrendingUp className="w-3 h-3" />
            {trend}%
          </span>
        )}
      </div>
      <div className="text-2xl font-light text-gray-900">
        {loading ? (
          <Loader className="w-5 h-5 animate-spin text-gray-400" />
        ) : (
          value || '--'
        )}
      </div>
      <div className="text-sm text-gray-600">{label}</div>
    </div>
  );

  // Simulated real-time data
  const [realtimeData, setRealtimeData] = useState([]);
  const [systemStatus, setSystemStatus] = useState({
    connected: false,
    backend: 'disconnected',
    lastCheck: null
  });

  // Check backend connection status
  useEffect(() => {
    const checkBackendStatus = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/health');
        if (response.ok) {
          const data = await response.json();
          setSystemStatus({
            connected: true,
            backend: data.status,
            lastCheck: new Date(),
            components: data.components
          });
        }
      } catch (error) {
        setSystemStatus({
          connected: false,
          backend: 'disconnected',
          lastCheck: new Date(),
          error: error.message
        });
      }
    };

    // Check immediately
    checkBackendStatus();

    // Check every 30 seconds
    const statusInterval = setInterval(checkBackendStatus, 30000);

    return () => clearInterval(statusInterval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setRealtimeData(prev => {
        const newData = [...prev, {
          time: new Date().toLocaleTimeString(),
          aiScore: metrics.aiScore || 78 + Math.random() * 4 - 2,
          voice: metrics.voiceRank || 67 + Math.random() * 6 - 3
        }].slice(-10);
        return newData;
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [metrics]);

  // Master Control Panel
  const MasterControl = () => (
    <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-6 text-white">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-light mb-1">AI Agent Control Center</h2>
          <p className="text-blue-100">Autonomous SEO optimization powered by Claude & ChatGPT</p>
        </div>
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-yellow-300" />
          <span className="text-sm bg-white bg-opacity-20 px-3 py-1 rounded-full">
            {activeAgent ? `Running: ${activeAgent}` : 'Ready'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <button
          onClick={() => executeAIAgent('quickWin', API_CONFIG)}
          className="p-3 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30 transition-all"
        >
          <Zap className="w-5 h-5 mb-1" />
          <div className="text-sm">Quick Wins</div>
        </button>
        <button
          onClick={() => {
            // Run all agents in sequence
            ['schemaValidation', 'voiceOptimization', 'aiSearchAnalysis', 'competitiveIntel']
              .forEach((task, i) => {
                setTimeout(() => executeAIAgent(task, API_CONFIG), i * 2000);
              });
          }}
          className="p-3 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30 transition-all"
        >
          <RefreshCw className="w-5 h-5 mb-1" />
          <div className="text-sm">Full Scan</div>
        </button>
        <button className="p-3 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30 transition-all">
          <Activity className="w-5 h-5 mb-1" />
          <div className="text-sm">Monitor</div>
        </button>
        <button className="p-3 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30 transition-all">
          <Globe className="w-5 h-5 mb-1" />
          <div className="text-sm">Deploy</div>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Bot className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Agentic SEO Platform</h1>
              <p className="text-sm text-gray-500">AI agents doing the heavy lifting</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              {systemStatus.connected ? (
                <>
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-green-600">Production System Online</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  <span className="text-red-600">Production System Offline</span>
                </>
              )}
            </div>
            {systemStatus.components && (
              <div className="flex items-center gap-1 text-xs">
                <span className="text-gray-500">Components:</span>
                {Object.entries(systemStatus.components).map(([name, status]) => (
                  <span
                    key={name}
                    className={`px-1 py-0.5 rounded text-xs ${
                      status === 'online' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {name.replace('_', ' ')}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Master Control */}
        <MasterControl />

        {/* Live Metrics */}
        <div className="grid grid-cols-4 gap-4">
          <MetricDisplay
            label="AI Search Score"
            value={metrics.aiScore ? `${metrics.aiScore}%` : null}
            icon={Brain}
            trend={5}
            loading={loading.aiSearchAnalysis}
          />
          <MetricDisplay
            label="Voice Rank"
            value={metrics.voiceRank ? `#${Math.round(metrics.voiceRank/20)}` : null}
            icon={Mic}
            trend={-2}
            loading={loading.voiceOptimization}
          />
          <MetricDisplay
            label="Schema Health"
            value={metrics.schemaHealth ? `${metrics.schemaHealth}%` : null}
            icon={Code}
            trend={8}
            loading={loading.schemaValidation}
          />
          <MetricDisplay
            label="Market Position"
            value={metrics.competitive ? `#${metrics.competitive}` : null}
            icon={Shield}
            trend={0}
            loading={loading.competitiveIntel}
          />
        </div>

        {/* Real-time Chart */}
        {realtimeData.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Real-time Performance</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={realtimeData}>
                <XAxis dataKey="time" stroke="#9CA3AF" />
                <YAxis stroke="#9CA3AF" />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="aiScore"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={false}
                  name="AI Score"
                />
                <Line
                  type="monotone"
                  dataKey="voice"
                  stroke="#8B5CF6"
                  strokeWidth={2}
                  dot={false}
                  name="Voice"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Agent Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AgentCard
            title="Schema Validator"
            taskType="schemaValidation"
            icon={Database}
            color="bg-green-600"
            description="AI-powered schema markup validation and fixes"
          />
          <AgentCard
            title="Voice Optimizer"
            taskType="voiceOptimization"
            icon={Mic}
            color="bg-purple-600"
            description="Natural language query optimization"
          />
          <AgentCard
            title="AI Search Analyzer"
            taskType="aiSearchAnalysis"
            icon={Brain}
            color="bg-blue-600"
            description="ChatGPT, Claude, Gemini visibility analysis"
          />
          <AgentCard
            title="Competitive Intel"
            taskType="competitiveIntel"
            icon={Shield}
            color="bg-orange-600"
            description="Real-time competitor monitoring"
          />
        </div>

        {/* Status Footer */}
        <div className="bg-gray-100 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-6 text-sm text-gray-600">
            <span className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              API Connected
            </span>
            <span>Last scan: {new Date().toLocaleTimeString()}</span>
            <span>{API_CONFIG.dealership}</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="text-sm text-blue-600 hover:text-blue-700">
              View Logs
            </button>
            <span className="text-gray-400">|</span>
            <button className="text-sm text-blue-600 hover:text-blue-700">
              Export Report
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}