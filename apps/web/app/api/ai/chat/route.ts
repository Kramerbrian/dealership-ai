import { NextRequest, NextResponse } from 'next/server';
import { withAuth, canAccessDealer } from '@/lib/auth';
import { generateAIResponse, selectOptimalModel } from '@/lib/ai/providers';
import { logCostEntry } from '@/lib/db';

export const POST = withAuth(async (request: NextRequest, session: any) => {
  try {
    const { message, dealerId, context = {} } = await request.json();

    // Check if user can access this dealer data
    if (dealerId && !canAccessDealer(session, dealerId)) {
      return NextResponse.json(
        { error: 'Access denied - Cannot access this dealer\'s AI assistant' },
        { status: 403 }
      );
    }

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Determine optimal AI model based on message content
    const taskType = determineTaskType(message);
    const complexity = determineComplexity(message);
    const provider = selectOptimalModel(taskType, complexity);

    // Prepare enhanced context with dealer-specific data
    const enhancedContext = {
      ...context,
      dealerId,
      userRole: session.user.role,
      taskType,
      dealershipData: await getDealershipData(dealerId)
    };

    try {
      // Generate real AI response
      const aiResponse = await generateAIResponse(message, enhancedContext, provider);

      // Log cost for tracking
      await logCostEntry({
        userId: session.user.id,
        dealerId,
        provider: aiResponse.provider,
        model: aiResponse.model,
        operation: 'chat-completion',
        inputTokens: aiResponse.tokensUsed.input,
        outputTokens: aiResponse.tokensUsed.output,
        totalCost: aiResponse.cost,
        metadata: {
          taskType,
          complexity,
          messageLength: message.length,
          responseLength: aiResponse.content.length
        }
      });

      return NextResponse.json({
        response: aiResponse.content,
        dealerId,
        timestamp: aiResponse.timestamp,
        metadata: {
          provider: aiResponse.provider,
          model: aiResponse.model,
          tokensUsed: aiResponse.tokensUsed,
          cost: aiResponse.cost,
          latency: aiResponse.latency
        },
        suggestions: generateContextualSuggestions(taskType, dealerId)
      });

    } catch (aiError) {
      console.error('AI generation failed, falling back to enhanced mock:', aiError);

      // Enhanced fallback with context-aware responses
      const fallbackResponse = generateEnhancedFallback(message, enhancedContext);

      return NextResponse.json({
        response: fallbackResponse,
        dealerId,
        timestamp: new Date().toISOString(),
        metadata: {
          provider: 'fallback',
          model: 'enhanced-mock',
          fallbackReason: 'ai-service-unavailable'
        },
        suggestions: generateContextualSuggestions(taskType, dealerId)
      });
    }

  } catch (error) {
    console.error('AI Chat API error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat request' },
      { status: 500 }
    );
  }
});

// Helper Functions
function determineTaskType(message: string): string {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('seo') || lowerMessage.includes('search')) return 'seo-analysis';
  if (lowerMessage.includes('competitor') || lowerMessage.includes('competition')) return 'competitive-analysis';
  if (lowerMessage.includes('content') || lowerMessage.includes('write') || lowerMessage.includes('create')) return 'content-generation';
  if (lowerMessage.includes('data') || lowerMessage.includes('metric') || lowerMessage.includes('analytics')) return 'data-analysis';
  if (lowerMessage.includes('customer') || lowerMessage.includes('service') || lowerMessage.includes('help')) return 'customer-service';
  if (lowerMessage.includes('technical') || lowerMessage.includes('implement') || lowerMessage.includes('setup')) return 'technical-recommendations';

  return 'general';
}

function determineComplexity(message: string): 'low' | 'medium' | 'high' {
  const wordCount = message.split(' ').length;
  const hasSpecificRequests = message.includes('analyze') || message.includes('compare') || message.includes('strategy');
  const hasMultipleQuestions = (message.match(/\?/g) || []).length > 1;

  if (wordCount > 100 || (hasSpecificRequests && hasMultipleQuestions)) return 'high';
  if (wordCount > 30 || hasSpecificRequests) return 'medium';
  return 'low';
}

async function getDealershipData(dealerId: string | null) {
  if (!dealerId) return {};

  try {
    // Fetch current dealership metrics
    const response = await fetch(`${process.env.NEXTAUTH_URL}/api/dashboard/enhanced?dealerId=${dealerId}`, {
      headers: { 'x-internal-request': 'true' }
    });

    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.error('Failed to fetch dealership data:', error);
  }

  return {};
}

function generateContextualSuggestions(taskType: string, dealerId: string | null): string[] {
  const baseSuggestions = {
    'seo-analysis': [
      "Show me my current SEO breakdown",
      "What are my quick SEO wins?",
      "How can I improve my local search ranking?",
      "Analyze my website's technical SEO"
    ],
    'competitive-analysis': [
      "Who are my main competitors?",
      "Compare my performance to competitors",
      "What advantages do I have over competitors?",
      "How can I differentiate from competition?"
    ],
    'content-generation': [
      "Write a blog post about car maintenance",
      "Create social media content for this month",
      "Generate FAQ answers for common questions",
      "Help me write promotional content"
    ],
    'data-analysis': [
      "Analyze my website traffic trends",
      "Show me my conversion funnel",
      "What metrics should I focus on?",
      "Create a performance report"
    ],
    'customer-service': [
      "How can I improve customer satisfaction?",
      "Help me handle customer complaints",
      "Create a customer onboarding process",
      "Improve my sales process"
    ],
    'technical-recommendations': [
      "What technical improvements should I make?",
      "Help me set up Google Analytics 4",
      "Implement schema markup",
      "Optimize my website speed"
    ]
  };

  const suggestions = baseSuggestions[taskType] || [
    "Analyze my current performance",
    "What should I focus on first?",
    "Show me improvement opportunities",
    "Help me create an action plan"
  ];

  // Add dealer-specific context if available
  if (dealerId) {
    return suggestions.map(suggestion => suggestion.replace('my ', `${dealerId}'s `));
  }

  return suggestions;
}

function generateEnhancedFallback(message: string, context: any): string {
  const taskType = determineTaskType(message);
  const dealerId = context.dealerId || 'your dealership';

  const fallbackResponses = {
    'seo-analysis': `Based on ${dealerId}'s current SEO profile, I recommend focusing on local search optimization first. Key areas to improve include: LocalBusiness schema markup, Google My Business optimization, and creating location-specific content. These changes typically show results within 2-4 weeks and can improve local visibility by 15-25%.`,

    'competitive-analysis': `In analyzing ${dealerId}'s competitive landscape, I've identified opportunities to differentiate through enhanced customer experience and digital presence. Your main advantages appear to be in service quality and local market knowledge. I recommend leveraging these strengths while addressing any digital marketing gaps.`,

    'content-generation': `For ${dealerId}, I suggest creating content that addresses common customer pain points like vehicle maintenance schedules, financing options, and seasonal driving tips. This type of helpful content builds trust and positions you as the local automotive expert.`,

    'data-analysis': `Looking at ${dealerId}'s performance data, I see potential for improvement in several key metrics. Focus on tracking: website conversion rates, lead quality scores, customer lifetime value, and digital marketing ROI. These metrics will help guide your optimization efforts.`,

    'customer-service': `To enhance ${dealerId}'s customer experience, consider implementing: streamlined appointment scheduling, proactive service reminders, transparent pricing communication, and follow-up satisfaction surveys. These improvements typically increase customer retention by 20-30%.`,

    'technical-recommendations': `For ${dealerId}'s technical optimization, prioritize: Core Web Vitals improvements, mobile responsiveness, SSL security, and structured data implementation. These technical foundations are essential for both user experience and search engine performance.`
  };

  return fallbackResponses[taskType] || `I understand you're asking about ${dealerId}'s operations. While I'm currently experiencing some connectivity issues with my advanced AI systems, I can still provide guidance based on automotive industry best practices and dealership optimization strategies. How would you like me to help you improve your dealership's performance?`;
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'AI Chat API is running',
    endpoints: {
      chat: 'POST /api/ai/chat',
      stream: 'POST /api/ai/chat/stream'
    },
    providers: ['OpenAI GPT-4', 'Anthropic Claude'],
    models: {
      openai: 'gpt-4-turbo-preview',
      claude: 'claude-3-sonnet-20240229'
    },
    features: [
      'real-ai-integration',
      'contextual-responses',
      'dealer-analytics',
      'seo-recommendations',
      'cost-tracking',
      'intelligent-model-selection'
    ]
  });
}