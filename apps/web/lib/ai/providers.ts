import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

// AI Provider Configuration
export interface AIProvider {
  name: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

export const AI_PROVIDERS: Record<string, AIProvider> = {
  openai: {
    name: 'OpenAI',
    model: 'gpt-4-turbo-preview',
    maxTokens: 4096,
    temperature: 0.7
  },
  claude: {
    name: 'Anthropic Claude',
    model: 'claude-3-sonnet-20240229',
    maxTokens: 4096,
    temperature: 0.7
  }
};

// OpenAI Client
export const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Anthropic Client
export const anthropicClient = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// AI Response Interface
export interface AIResponse {
  content: string;
  provider: string;
  model: string;
  tokensUsed: {
    input: number;
    output: number;
    total: number;
  };
  cost: number;
  latency: number;
  timestamp: string;
}

// Generate AI Response
export async function generateAIResponse(
  message: string,
  context: any = {},
  provider: 'openai' | 'claude' = 'openai'
): Promise<AIResponse> {
  const startTime = Date.now();

  try {
    let response: AIResponse;

    switch (provider) {
      case 'openai':
        response = await generateOpenAIResponse(message, context);
        break;
      case 'claude':
        response = await generateClaudeResponse(message, context);
        break;
      default:
        throw new Error(`Unsupported AI provider: ${provider}`);
    }

    response.latency = Date.now() - startTime;
    response.timestamp = new Date().toISOString();

    return response;
  } catch (error) {
    console.error(`AI generation error (${provider}):`, error);
    throw error;
  }
}

// OpenAI Implementation
async function generateOpenAIResponse(message: string, context: any): Promise<AIResponse> {
  const systemPrompt = buildDealershipSystemPrompt(context);

  const completion = await openaiClient.chat.completions.create({
    model: AI_PROVIDERS.openai.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message }
    ],
    max_tokens: AI_PROVIDERS.openai.maxTokens,
    temperature: AI_PROVIDERS.openai.temperature,
    stream: false
  });

  const inputTokens = completion.usage?.prompt_tokens || 0;
  const outputTokens = completion.usage?.completion_tokens || 0;
  const totalTokens = completion.usage?.total_tokens || 0;

  return {
    content: completion.choices[0].message.content || '',
    provider: 'openai',
    model: AI_PROVIDERS.openai.model,
    tokensUsed: {
      input: inputTokens,
      output: outputTokens,
      total: totalTokens
    },
    cost: calculateOpenAICost(inputTokens, outputTokens),
    latency: 0, // Will be set by caller
    timestamp: ''
  };
}

// Claude Implementation
async function generateClaudeResponse(message: string, context: any): Promise<AIResponse> {
  const systemPrompt = buildDealershipSystemPrompt(context);

  const response = await anthropicClient.messages.create({
    model: AI_PROVIDERS.claude.model,
    max_tokens: AI_PROVIDERS.claude.maxTokens,
    temperature: AI_PROVIDERS.claude.temperature,
    system: systemPrompt,
    messages: [
      { role: 'user', content: message }
    ]
  });

  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;
  const totalTokens = inputTokens + outputTokens;

  return {
    content: response.content[0].type === 'text' ? response.content[0].text : '',
    provider: 'claude',
    model: AI_PROVIDERS.claude.model,
    tokensUsed: {
      input: inputTokens,
      output: outputTokens,
      total: totalTokens
    },
    cost: calculateClaudeCost(inputTokens, outputTokens),
    latency: 0,
    timestamp: ''
  };
}

// Build Dealership-Specific System Prompt
function buildDealershipSystemPrompt(context: any): string {
  const basePrompt = `You are an expert AI assistant specialized in automotive dealership optimization and digital marketing. Your primary expertise includes:

1. **AI Visibility Optimization**: Voice search, local SEO, schema markup, and search engine optimization
2. **Revenue Attribution**: Multi-channel marketing attribution, ROI analysis, and performance tracking
3. **Competitive Intelligence**: Market analysis, competitive positioning, and strategic recommendations
4. **Dealership Operations**: Inventory management, customer experience optimization, and process improvement

Your responses should be:
- Actionable and specific to automotive dealerships
- Data-driven with clear metrics and KPIs
- Focused on measurable business outcomes
- Professional yet conversational in tone`;

  // Add dealer-specific context
  if (context.dealerId) {
    return `${basePrompt}

**Current Dealership Context:**
- Dealer ID: ${context.dealerId}
- Brand: ${context.brand || 'Not specified'}
- Location: ${context.location || 'Not specified'}
- Current AI Visibility Score: ${context.aiVisibility || 'Unknown'}
- Current SEO Score: ${context.seoScore || 'Unknown'}
- Monthly Revenue: ${context.monthlyRevenue ? `$${context.monthlyRevenue.toLocaleString()}` : 'Unknown'}

Provide insights and recommendations based on this specific dealership context.`;
  }

  return basePrompt;
}

// Cost Calculation Functions
function calculateOpenAICost(inputTokens: number, outputTokens: number): number {
  // GPT-4 Turbo pricing (as of 2024)
  const inputCostPerToken = 0.00001; // $0.01 per 1K tokens
  const outputCostPerToken = 0.00003; // $0.03 per 1K tokens

  return (inputTokens * inputCostPerToken) + (outputTokens * outputCostPerToken);
}

function calculateClaudeCost(inputTokens: number, outputTokens: number): number {
  // Claude 3 Sonnet pricing (as of 2024)
  const inputCostPerToken = 0.000003; // $0.003 per 1K tokens
  const outputCostPerToken = 0.000015; // $0.015 per 1K tokens

  return (inputTokens * inputCostPerToken) + (outputTokens * outputCostPerToken);
}

// Stream Response Function (for real-time chat)
export async function generateStreamingResponse(
  message: string,
  context: any = {},
  provider: 'openai' | 'claude' = 'openai',
  onChunk: (chunk: string) => void
): Promise<AIResponse> {
  const startTime = Date.now();

  if (provider === 'openai') {
    const systemPrompt = buildDealershipSystemPrompt(context);

    const stream = await openaiClient.chat.completions.create({
      model: AI_PROVIDERS.openai.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      max_tokens: AI_PROVIDERS.openai.maxTokens,
      temperature: AI_PROVIDERS.openai.temperature,
      stream: true
    });

    let fullContent = '';
    let inputTokens = 0;
    let outputTokens = 0;

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullContent += content;
        outputTokens += 1; // Approximation
        onChunk(content);
      }

      if (chunk.usage) {
        inputTokens = chunk.usage.prompt_tokens || 0;
        outputTokens = chunk.usage.completion_tokens || 0;
      }
    }

    return {
      content: fullContent,
      provider: 'openai',
      model: AI_PROVIDERS.openai.model,
      tokensUsed: {
        input: inputTokens,
        output: outputTokens,
        total: inputTokens + outputTokens
      },
      cost: calculateOpenAICost(inputTokens, outputTokens),
      latency: Date.now() - startTime,
      timestamp: new Date().toISOString()
    };
  }

  // Claude doesn't support streaming in the same way, fall back to regular response
  return generateAIResponse(message, context, provider);
}

// AI Model Selection Based on Task
export function selectOptimalModel(taskType: string, complexity: 'low' | 'medium' | 'high' = 'medium'): 'openai' | 'claude' {
  // Task-based model selection
  const taskPreferences: Record<string, 'openai' | 'claude'> = {
    'seo-analysis': 'openai',
    'competitive-analysis': 'claude',
    'content-generation': 'claude',
    'data-analysis': 'openai',
    'customer-service': 'claude',
    'technical-recommendations': 'openai'
  };

  // Complexity-based fallback
  if (complexity === 'high') {
    return 'claude'; // Claude excels at complex reasoning
  }

  return taskPreferences[taskType] || 'openai';
}