import React, { useState, useEffect, useRef } from 'react';
import { Send, Mic, MicOff, Volume2, AlertCircle, Zap, Lock, ArrowUp } from 'lucide-react';
import Pill from './Pill';
import Card from './Card';

// Tier configuration
const DEALER_TIERS: Record<number, { name: string; limits: { features: { voiceMinutes: number } } }> = {
  1: { name: "Starter", limits: { features: { voiceMinutes: 30 } } },
  2: { name: "Professional", limits: { features: { voiceMinutes: 120 } } },
  3: { name: "Enterprise", limits: { features: { voiceMinutes: 500 } } },
  4: { name: "Enterprise Plus", limits: { features: { voiceMinutes: 2000 } } }
};

interface AIAssistantProps {
  dealerId?: string;
  userTier?: number;
  businessInfo?: any;
  onUpgrade?: () => void;
}

interface Message {
  id: number;
  type: 'user' | 'assistant' | 'error';
  content: string;
  timestamp: Date;
  tokens?: number;
  cost?: number;
  functions?: string[];
}

export default function AIAssistant({
  dealerId = "demo-dealer",
  userTier = 1,
  businessInfo = {},
  onUpgrade
}: AIAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      type: 'assistant',
      content: "👋 Hi! I'm your AI Assistant. I can help you with customer inquiries, inventory questions, and dealership operations. What can I help you with today?",
      timestamp: new Date()
    }
  ]);

  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [rateLimitStatus, setRateLimitStatus] = useState<string | null>(null);
  const [usage, setUsage] = useState<{ remaining: number | null; resetTime: Date | null }>({
    remaining: null,
    resetTime: null
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  const tierInfo = DEALER_TIERS[userTier] || DEALER_TIERS[1];
  const upgradeInfo = userTier < 4;

  // Simple usage tracking
  useEffect(() => {
    checkRateLimit();
  }, [userTier]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const checkRateLimit = async () => {
    try {
      const response = await fetch(`/api/rate-limit/check?dealerId=${dealerId}&tier=${userTier}`);
      if (response.ok) {
        const data = await response.json();
        setUsage(data.usage);
        setRateLimitStatus(data.status);
      }
    } catch (error) {
      console.error('Rate limit check failed:', error);
    }
  };

  const handleSendMessage = async (messageText?: string) => {
    const textToSend = messageText || inputMessage.trim();
    if (!textToSend || isLoading) return;

    if (rateLimitStatus === 'exceeded') {
      setMessages(prev => [...prev, {
        id: Date.now(),
        type: 'error',
        content: 'Rate limit exceeded. Please wait before sending another message.',
        timestamp: new Date()
      }]);
      return;
    }

    const userMessage: Message = {
      id: Date.now(),
      type: 'user',
      content: textToSend,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai-assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          dealerId,
          userTier,
          businessInfo,
          conversationHistory: messages.slice(-10)
        })
      });

      if (response.ok) {
        const data = await response.json();
        const assistantMessage: Message = {
          id: Date.now() + 1,
          type: 'assistant',
          content: data.message,
          timestamp: new Date(),
          tokens: data.tokens,
          cost: data.cost,
          functions: data.functions
        };
        setMessages(prev => [...prev, assistantMessage]);
        setUsage(data.usage);
      } else {
        throw new Error('Failed to send message');
      }
    } catch (error) {
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        type: 'error',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const startListening = () => {
    if ('webkitSpeechRecognition' in window) {
      const recognition = new (window as any).webkitSpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputMessage(transcript);
        setIsListening(false);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);

      recognition.start();
      recognitionRef.current = recognition;
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  const speakMessage = (text: string) => {
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
              AI Assistant
              <Pill>{tierInfo.name}</Pill>
            </h3>
            <div className="text-xs text-slate-400">{usage?.remaining || '?'} messages left</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {rateLimitStatus === 'exceeded' && (
            <AlertCircle className="w-5 h-5 text-red-400" />
          )}
          {userTier < 4 && upgradeInfo && onUpgrade && (
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

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`p-3 rounded-lg max-w-[80%] ${
              message.type === 'user'
                ? 'bg-blue-600 text-white ml-auto'
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
        ))}
        {isLoading && (
          <div className="bg-slate-700 text-slate-100 p-3 rounded-lg max-w-[80%]">
            <div className="flex items-center gap-2">
              <div className="animate-spin w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full"></div>
              AI Assistant is thinking...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-slate-700">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder={rateLimitStatus === 'exceeded' ? 'Rate limit exceeded...' : 'Ask me anything...'}
              disabled={isLoading || rateLimitStatus === 'exceeded'}
              className="w-full px-3 py-2 pr-10 bg-slate-700 text-slate-100 border border-slate-600 rounded-lg focus:outline-none focus:border-blue-500 disabled:opacity-50"
            />
            {isListening && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
              </div>
            )}
          </div>

          <button
            onClick={isListening ? stopListening : startListening}
            disabled={isLoading || rateLimitStatus === 'exceeded'}
            className="p-2 bg-slate-700 text-slate-300 border border-slate-600 rounded-lg hover:bg-slate-600 disabled:opacity-50 transition-colors"
            title={isListening ? 'Stop listening' : 'Start voice input'}
          >
            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          <button
            onClick={() => handleSendMessage()}
            disabled={!inputMessage.trim() || isLoading || rateLimitStatus === 'exceeded'}
            className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            title="Send message"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-2 text-xs text-slate-500 flex items-center justify-between">
          <span>Tier {userTier}: {tierInfo.name}</span>
          {usage.resetTime && (
            <span>Resets: {usage.resetTime.toLocaleTimeString()}</span>
          )}
        </div>
      </div>
    </div>
  );
}