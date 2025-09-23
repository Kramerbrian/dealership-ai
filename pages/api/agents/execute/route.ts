import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { withRateLimit } from '../../../../lib/rateLimiting';

// Load manifest dynamically
async function loadManifest(manifestId: string) {
  try {
    const manifest = await import(`../manifests/${manifestId}.js`);
    return manifest.default;
  } catch (error) {
    throw new Error(`Manifest ${manifestId} not found`);
  }
}

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface AgentRequest {
  manifest: string;
  inputs: Record<string, any>;
  dealerId: string;
  tier: number;
}

interface AgentResponse {
  success: boolean;
  outputs?: Record<string, any>;
  error?: string;
  manifest: string;
  executionTime: number;
  timestamp: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<AgentResponse>> {
  const startTime = Date.now();

  try {
    const body: AgentRequest = await request.json();
    const { manifest: manifestId, inputs, dealerId, tier } = body;

    // Load manifest
    const manifest = await loadManifest(manifestId);

    // Rate limiting check
    const rateLimitCheck = await withRateLimit(
      request as any,
      null,
      dealerId,
      tier as 1 | 2 | 3 | 4,
      manifestId === 'hal-conversation' ? 'halMessages' : 'agentTasks'
    );

    if (!rateLimitCheck) {
      return NextResponse.json({
        success: false,
        error: 'Rate limit exceeded',
        manifest: manifestId,
        executionTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      }, { status: 429 });
    }

    // Validate inputs
    const validationError = validateInputs(inputs, manifest.inputs);
    if (validationError) {
      return NextResponse.json({
        success: false,
        error: validationError,
        manifest: manifestId,
        executionTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    // Execute based on manifest type
    let result;

    switch (manifestId) {
      case 'hal-conversation':
        result = await executeHalConversation(inputs, manifest);
        break;

      default:
        throw new Error(`Unknown manifest: ${manifestId}`);
    }

    return NextResponse.json({
      success: true,
      outputs: result,
      manifest: manifestId,
      executionTime: Date.now() - startTime,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Agent execution error:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      manifest: 'unknown',
      executionTime: Date.now() - startTime,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

async function executeHalConversation(inputs: any, manifest: any) {
  const { message, conversation = [], business = {}, personality } = inputs;

  // Build context from conversation history
  const conversationContext = conversation
    .slice(-10) // Last 10 messages
    .map((msg: any) => ({
      role: msg.type === 'user' ? 'user' : 'assistant',
      content: msg.content
    }));

  // Determine context type based on message content
  const messageContext = determineContext(message);
  const systemPrompt = manifest.systemPrompts[messageContext] || manifest.systemPrompts.general;

  // Build system message with business context
  const systemMessage = `${systemPrompt}

DEALERSHIP CONTEXT:
- Name: ${business.name || 'Our Dealership'}
- Location: ${business.location || 'Local Area'}
- Specialties: ${business.specialties || 'New and used vehicle sales, service, parts'}
- Current Time: ${new Date().toLocaleString()}

INSTRUCTIONS:
- Be conversational and helpful
- Use the available functions when appropriate
- Always prioritize customer satisfaction
- If you don't have specific information, offer to help find it
- Keep responses concise but informative (under 200 words)
- Personality: ${personality}

AVAILABLE FUNCTIONS:
${manifest.functions.map((f: any) => `- ${f.name}: ${f.description}`).join('\n')}`;

  const messages = [
    { role: 'system', content: systemMessage },
    ...conversationContext,
    { role: 'user', content: message }
  ];

  try {
    const response = await openai.chat.completions.create({
      model: manifest.settings.model,
      messages: messages as any,
      temperature: manifest.settings.temperature,
      max_tokens: manifest.settings.maxTokens,
      functions: manifest.functions,
      function_call: 'auto'
    });

    const choice = response.choices[0];
    const usage = response.usage;

    // Handle function calls
    const functionsUsed = [];
    let finalResponse = choice.message.content;

    if (choice.message.function_call) {
      const functionName = choice.message.function_call.name;
      const functionArgs = JSON.parse(choice.message.function_call.arguments);

      functionsUsed.push(functionName);

      // Execute function (mock implementation)
      const functionResult = await executeMockFunction(functionName, functionArgs, business);

      // Get final response incorporating function result
      const followUpMessages = [
        ...messages,
        choice.message,
        {
          role: 'function',
          name: functionName,
          content: JSON.stringify(functionResult)
        }
      ];

      const followUpResponse = await openai.chat.completions.create({
        model: manifest.settings.model,
        messages: followUpMessages as any,
        temperature: manifest.settings.temperature,
        max_tokens: manifest.settings.maxTokens
      });

      finalResponse = followUpResponse.choices[0].message.content;
    }

    // Calculate cost (estimated)
    const inputTokens = usage?.prompt_tokens || 0;
    const outputTokens = usage?.completion_tokens || 0;
    const estimatedCost = (inputTokens * 0.00003) + (outputTokens * 0.00006); // GPT-4 pricing

    return {
      response: finalResponse,
      functions: functionsUsed,
      tokens: usage?.total_tokens || 0,
      cost: estimatedCost,
      confidence: 0.85, // Mock confidence score
      context: messageContext
    };

  } catch (error) {
    console.error('OpenAI API error:', error);
    throw new Error('Failed to generate response');
  }
}

function determineContext(message: string): string {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('service') || lowerMessage.includes('maintenance') || lowerMessage.includes('repair')) {
    return 'service';
  }

  if (lowerMessage.includes('buy') || lowerMessage.includes('purchase') || lowerMessage.includes('financing') || lowerMessage.includes('lease')) {
    return 'sales';
  }

  if (lowerMessage.includes('analytics') || lowerMessage.includes('report') || lowerMessage.includes('performance') || lowerMessage.includes('sales data')) {
    return 'management';
  }

  return 'general';
}

async function executeMockFunction(functionName: string, args: any, business: any): Promise<any> {
  // Mock function implementations - replace with real data sources

  switch (functionName) {
    case 'search_inventory':
      return {
        vehicles: [
          {
            id: 'v1',
            year: 2024,
            make: args.make || 'Toyota',
            model: args.model || 'Camry',
            price: 32500,
            mileage: 0,
            condition: 'new'
          },
          {
            id: 'v2',
            year: 2023,
            make: args.make || 'Honda',
            model: args.model || 'Accord',
            price: 28900,
            mileage: 15000,
            condition: 'certified pre-owned'
          }
        ],
        total: 2
      };

    case 'get_dealership_info':
      return {
        name: business.name || 'Toyota of Naples',
        address: '2500 Pine Ridge Rd, Naples, FL 34109',
        phone: '(239) 555-0199',
        hours: {
          'monday-saturday': '8:00 AM - 9:00 PM',
          'sunday': '10:00 AM - 6:00 PM'
        },
        services: ['New Vehicle Sales', 'Used Vehicle Sales', 'Service & Maintenance', 'Parts', 'Financing']
      };

    case 'calculate_financing':
      const principal = args.vehicle_price - (args.down_payment || 0);
      const rate = getCreditRate(args.credit_score_range);
      const months = args.term_months || 60;
      const monthlyPayment = calculateMonthlyPayment(principal, rate, months);

      return {
        vehicle_price: args.vehicle_price,
        down_payment: args.down_payment || 0,
        financed_amount: principal,
        term_months: months,
        estimated_apr: rate,
        monthly_payment: Math.round(monthlyPayment * 100) / 100,
        total_cost: Math.round((monthlyPayment * months + (args.down_payment || 0)) * 100) / 100
      };

    case 'generate_trade_estimate':
      const baseValue = getBaseTradeValue(args.year, args.make, args.model);
      const mileageAdjustment = calculateMileageAdjustment(args.mileage, args.year);
      const conditionMultiplier = getConditionMultiplier(args.condition);
      const estimatedValue = Math.round(baseValue * mileageAdjustment * conditionMultiplier);

      return {
        estimated_value: estimatedValue,
        high_estimate: Math.round(estimatedValue * 1.15),
        low_estimate: Math.round(estimatedValue * 0.85),
        factors: {
          base_value: baseValue,
          mileage_adjustment: mileageAdjustment,
          condition_factor: conditionMultiplier
        }
      };

    case 'check_incentives':
      return {
        manufacturer_rebates: [
          { name: 'Holiday Sales Event', amount: 2000, expires: '2024-01-02' },
          { name: 'First-Time Buyer Bonus', amount: 500, expires: '2024-02-29' }
        ],
        financing_offers: [
          { apr: 2.9, term: 60, qualification: 'excellent credit' },
          { apr: 4.9, term: 72, qualification: 'good credit' }
        ],
        lease_specials: [
          { payment: 299, term: 36, due_at_signing: 2999 }
        ]
      };

    case 'schedule_service':
      return {
        appointment_id: 'SA' + Date.now(),
        service_type: args.service_type,
        scheduled_date: args.preferred_date || '2024-01-15',
        estimated_time: '2 hours',
        advisor: 'Mike Rodriguez',
        confirmation: 'sent_via_email'
      };

    default:
      return { result: 'Function executed successfully', function: functionName };
  }
}

function getCreditRate(creditRange: string): number {
  const rates = {
    'excellent': 3.9,
    'good': 5.9,
    'fair': 8.9,
    'poor': 12.9
  };
  return rates[creditRange as keyof typeof rates] || 6.9;
}

function calculateMonthlyPayment(principal: number, annualRate: number, months: number): number {
  const monthlyRate = annualRate / 100 / 12;
  const denominator = Math.pow(1 + monthlyRate, months) - 1;
  return principal * (monthlyRate * Math.pow(1 + monthlyRate, months)) / denominator;
}

function getBaseTradeValue(year: number, make: string, model: string): number {
  const currentYear = new Date().getFullYear();
  const age = currentYear - year;
  const baseValues: Record<string, number> = {
    'toyota': 25000,
    'honda': 24000,
    'ford': 22000,
    'chevrolet': 21000,
    'nissan': 20000
  };

  const baseValue = baseValues[make.toLowerCase()] || 20000;
  return Math.max(5000, baseValue - (age * 2000));
}

function calculateMileageAdjustment(mileage: number, year: number): number {
  const currentYear = new Date().getFullYear();
  const expectedMileage = (currentYear - year) * 12000;
  const mileageDiff = mileage - expectedMileage;

  if (mileageDiff > 10000) return 0.85;
  if (mileageDiff > 0) return 0.95;
  if (mileageDiff < -10000) return 1.1;
  return 1.0;
}

function getConditionMultiplier(condition: string): number {
  const multipliers = {
    'excellent': 1.1,
    'good': 1.0,
    'fair': 0.85,
    'poor': 0.7
  };
  return multipliers[condition as keyof typeof multipliers] || 1.0;
}

function validateInputs(inputs: any, schema: any): string | null {
  for (const [key, config] of Object.entries(schema)) {
    const spec = config as any;
    if (spec.required && !inputs[key]) {
      return `Missing required input: ${key}`;
    }
  }
  return null;
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    message: 'Agent Execution API is active',
    available_manifests: ['hal-conversation'],
    example_request: {
      manifest: 'hal-conversation',
      inputs: {
        message: 'What vehicles do you have in stock?',
        business: { name: 'Demo Dealership', location: 'Naples, FL' }
      },
      dealerId: 'demo-dealer',
      tier: 1
    }
  });
}