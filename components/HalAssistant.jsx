import React, { useState, useEffect, useRef } from 'react';
import { Send, Mic, MicOff, Volume2, AlertCircle, Zap, Lock, ArrowUp } from 'lucide-react';
import Pill from './Pill';

// Tier configuration
const DEALER_TIERS = {
  1: { name: "Starter", limits: { features: { voiceMinutes: 30 } } },
  2: { name: "Professional", limits: { features: { voiceMinutes: 120 } } },
  3: { name: "Enterprise", limits: { features: { voiceMinutes: 500 } } },
  4: { name: "Enterprise Plus", limits: { features: { voiceMinutes: 2000 } } }
};

const Card = ({ className = "", children }) => (
  <div className={`bg-slate-800 rounded-lg border border-slate-700 ${className}`}>{children}</div>
);

export default function HalAssistant({
  dealerId = "demo-dealer",
  userTier = 1,
  businessInfo = {},
  onUpgrade
}) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: 'assistant',
      content: "👋 Hi! I'm Hal, your dealership AI assistant. I can help you with customer inquiries, inventory questions, and dealership operations. What can I help you with today?",
      timestamp: new Date()
    }
  ]);

  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [rateLimitStatus, setRateLimitStatus] = useState(null);
  const [usage, setUsage] = useState({ remaining: null, resetTime: null });

  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);

  // Simple usage tracking
  useEffect(() => {
    checkRateLimit();
  }, [userTier]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Voice recognition setup
  useEffect(() => {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      recognitionRef.current = new window.webkitSpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInputMessage(transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = () => {
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const checkRateLimit = () => {
    // Simple rate limit simulation
    const hourlyLimits = { 1: 50, 2: 200, 3: 500, 4: 2000 };
    const remaining = hourlyLimits[userTier] || 50;
    const resetTime = new Date();
    resetTime.setHours(resetTime.getHours() + 1, 0, 0, 0);

    setUsage({ remaining, resetTime });
    setRateLimitStatus('ok');
  };

  const tierInfo = DEALER_TIERS[userTier];
  const hasVoice = tierInfo?.limits?.features?.voiceMinutes > 0;
  const upgradeInfo = userTier < 4 ? { nextTier: DEALER_TIERS[userTier + 1] } : null;

  const quickActions = [
    {
      label: "Check Inventory",
      prompt: "Show me our current inventory status and best sellers",
      tier: 1
    },
    {
      label: "Customer Scripts",
      prompt: "Give me a sales script for first-time buyers",
      tier: 1
    },
    {
      label: "Competitive Analysis",
      prompt: "How do we compare to competitors in our area?",
      tier: 2
    },
    {
      label: "Marketing Ideas",
      prompt: "Suggest marketing campaigns for this month",
      tier: 2
    },
    {
      label: "Financial Analysis",
      prompt: "Analyze our profit margins by vehicle category",
      tier: 3
    },
    {
      label: "Custom Reports",
      prompt: "Generate a custom performance report",
      tier: 3
    }
  ];

  const handleSendMessage = async (messageText = inputMessage.trim()) => {
    if (!messageText || isLoading) return;

    // Check rate limits
    if (rateLimitStatus === 'exceeded') {
      setMessages(prev => [...prev, {
        id: Date.now(),
        type: 'error',
        content: `Rate limit exceeded. You have ${usage?.remaining || 0} messages remaining. Resets at ${usage?.resetTime ? new Date(usage.resetTime).toLocaleTimeString() : 'unknown'}.`,
        timestamp: new Date()
      }]);
      return;
    }

    const newMessage = {
      id: Date.now(),
      type: 'user',
      content: messageText,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, newMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      // Update usage tracking
      setUsage(prev => ({
        ...prev,
        remaining: Math.max(0, (prev?.remaining || 50) - 1)
      }));

      // Call your existing agent system
      const response = await fetch('/api/agents/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          manifest: 'hal-conversation',
          inputs: {
            message: messageText,
            conversation: messages.slice(-10), // Last 10 messages for context
            business: businessInfo,
            personality: 'helpful, knowledgeable dealership assistant'
          },
          dealerId,
          tier: userTier
        }),
      });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const result = await response.json();

      const assistantMessage = {
        id: Date.now() + 1,
        type: 'assistant',
        content: result.outputs?.response || result.result || "I'm sorry, I couldn't process that request. Please try again.",
        functions: result.outputs?.functions || [],
        tokens: result.outputs?.tokens || 0,
        cost: result.outputs?.cost || 0.02,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Update rate limit status
      checkRateLimit();

    } catch (error) {
      console.error('Hal message error:', error);

      const errorMessage = {
        id: Date.now() + 1,
        type: 'error',
        content: "I'm experiencing some technical difficulties. Please try again in a moment.",
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVoiceToggle = () => {
    if (!hasVoice) {
      setMessages(prev => [...prev, {
        id: Date.now(),
        type: 'error',
        content: "Voice input requires Professional tier or higher. Upgrade to unlock this feature!",
        timestamp: new Date()
      }]);
      return;
    }

    if (!recognitionRef.current) {
      alert('Voice recognition not supported in this browser');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const handleQuickAction = (action) => {
    if (userTier < action.tier) {
      setMessages(prev => [...prev, {
        id: Date.now(),
        type: 'error',
        content: `"${action.label}" requires ${DEALER_TIERS[action.tier].name} tier or higher. ${upgradeInfo ? `Upgrade to unlock this feature!` : ''}`,
        timestamp: new Date()
      }]);
      return;
    }

    handleSendMessage(action.prompt);
  };

  const speakMessage = (text) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <div className="flex flex-col h-full max-h-[600px]">
      {/* Header with rate limit status */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full grid place-items-center">
            🤖
          </div>
          <div>
            <h3 className="font-semibold text-slate-100 flex items-center gap-2">
              Hal Assistant
              <Pill>{tierInfo.name}</Pill>
            </h3>
            <div className="text-xs text-slate-400">{usage?.remaining || '?'} messages left</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {rateLimitStatus === 'exceeded' && (
            <AlertCircle className="w-5 h-5 text-red-400" />
          )}
          {userTier < 4 && upgradeInfo && (
            <button
              onClick={onUpgrade}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              <ArrowUp className="w-3 h-3" />
              Upgrade
            </button>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="p-4 border-b border-slate-700">
        <div className="flex flex-wrap gap-2">
          {quickActions.map((action, index) => (
            <button
              key={index}
              onClick={() => handleQuickAction(action)}
              disabled={isLoading}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                userTier >= action.tier
                  ? 'border-slate-600 bg-slate-700 text-slate-200 hover:bg-slate-600'
                  : 'border-slate-600 bg-slate-800/50 text-slate-500 cursor-not-allowed'
              }`}
            >
              {action.label}
              {userTier < action.tier && <Lock className="w-3 h-3 ml-1 inline" />}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                message.type === 'user'
                  ? 'bg-blue-600 text-white'
                  : message.type === 'error'
                  ? 'bg-red-900/50 text-red-200 border border-red-700'
                  : 'bg-slate-700 text-slate-100'
              }`}
            >
              <div className="whitespace-pre-wrap">{message.content}</div>

              {message.functions && message.functions.length > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-600">
                  <div className="flex items-center gap-1 mb-1">
                    <Zap className="w-3 h-3 text-slate-400" />
                    <span className="text-xs text-slate-400">Functions:</span>
                    <div className="flex flex-wrap gap-1">
                      {message.functions.map((func, idx) => (
                        <Pill key={idx}>{func}</Pill>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {message.type === 'assistant' && (
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-600">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">{message.timestamp.toLocaleTimeString()}</span>
                    {message.tokens && <Pill>{message.tokens} tokens</Pill>}
                    {message.cost && <Pill>${message.cost.toFixed(3)}</Pill>}
                  </div>
                  <button
                    onClick={() => speakMessage(message.content)}
                    className="p-1 text-slate-400 hover:text-slate-200 transition-colors"
                    title="Read aloud"
                  >
                    <Volume2 className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-700 rounded-lg p-3 max-w-[80%]">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-100" />
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-200" />
                <span className="text-slate-400 text-sm ml-2">Hal is thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-slate-700">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder={rateLimitStatus === 'exceeded' ? 'Rate limit exceeded' : 'Ask Hal anything...'}
              disabled={isLoading || rateLimitStatus === 'exceeded'}
              className="w-full px-4 py-2 pr-12 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            />

            {hasVoice && (
              <button
                onClick={handleVoiceToggle}
                disabled={isLoading}
                className={`absolute right-2 top-1/2 transform -translate-y-1/2 p-1 rounded transition-colors ${
                  isListening
                    ? 'text-red-400 hover:text-red-300'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title={isListening ? 'Stop listening' : 'Start voice input'}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            )}
          </div>

          <button
            onClick={() => handleSendMessage()}
            disabled={!inputMessage.trim() || isLoading || rateLimitStatus === 'exceeded'}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        {usage && usage.resetTime && (
          <div className="mt-2 text-xs text-slate-500">
            {usage.remaining > 0
              ? `${usage.remaining} messages remaining this hour`
              : `Resets at ${new Date(usage.resetTime).toLocaleTimeString()}`
            }
          </div>
        )}
      </div>
    </div>
  );
}