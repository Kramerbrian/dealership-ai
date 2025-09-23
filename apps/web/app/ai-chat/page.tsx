'use client';

import { useState } from 'react';
import RoleBasedNav from '@/components/navigation/RoleBasedNav';
import { AuthenticatedOnly } from '@/components/auth/RoleGuard';

export default function AIChatPage() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hello! I\'m your DealershipAI assistant. How can I help you today?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;

    const newMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, newMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: input,
          context: 'dealership-ai-assistant'
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthenticatedOnly>
      <RoleBasedNav />
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-6">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-lg shadow-sm">
              <div className="border-b border-gray-200 px-6 py-4">
                <h1 className="text-2xl font-bold text-gray-900">AI Assistant</h1>
                <p className="text-gray-600 mt-1">Get help with dealership operations, SEO, and AI strategies</p>
              </div>

              <div className="flex flex-col h-96">
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {messages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                          message.role === 'user'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-800'
                        }`}
                      >
                        <p className="text-sm">{message.content}</p>
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="border-t border-gray-200 p-4">
                  <div className="flex space-x-4">
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                      placeholder="Ask me anything about your dealership..."
                      className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      disabled={isLoading}
                    />
                    <button
                      onClick={handleSend}
                      disabled={isLoading || !input.trim()}
                      className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Send
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <h3 className="font-medium text-gray-900 mb-2">SEO Optimization</h3>
                <p className="text-sm text-gray-600">Ask about improving your website's search rankings and AI visibility.</p>
                <button
                  onClick={() => setInput("How can I improve my dealership's SEO performance?")}
                  className="mt-2 text-blue-600 text-sm hover:text-blue-700"
                >
                  Try this →
                </button>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <h3 className="font-medium text-gray-900 mb-2">AI Strategy</h3>
                <p className="text-sm text-gray-600">Get insights on using AI for customer engagement and operations.</p>
                <button
                  onClick={() => setInput("What AI strategies work best for automotive dealerships?")}
                  className="mt-2 text-blue-600 text-sm hover:text-blue-700"
                >
                  Try this →
                </button>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <h3 className="font-medium text-gray-900 mb-2">Analytics</h3>
                <p className="text-sm text-gray-600">Understand your performance metrics and competitive positioning.</p>
                <button
                  onClick={() => setInput("How do I interpret my AI visibility scores?")}
                  className="mt-2 text-blue-600 text-sm hover:text-blue-700"
                >
                  Try this →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AuthenticatedOnly>
  );
}