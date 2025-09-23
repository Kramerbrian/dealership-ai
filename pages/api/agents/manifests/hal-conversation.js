export default {
  id: 'hal-conversation',
  name: 'Hal AI Assistant',
  description: 'AI-powered dealership assistant for customer service, sales, and operations',

  inputs: {
    message: {
      type: 'string',
      required: true,
      description: 'User message to process'
    },
    conversation: {
      type: 'array',
      required: false,
      description: 'Previous conversation context (last 10 messages)'
    },
    business: {
      type: 'object',
      required: false,
      description: 'Dealership business information'
    },
    personality: {
      type: 'string',
      required: false,
      default: 'helpful, knowledgeable automotive assistant',
      description: 'AI personality and behavior guidelines'
    }
  },

  outputs: {
    response: {
      type: 'string',
      description: 'Hal\'s conversational response'
    },
    functions: {
      type: 'array',
      description: 'Functions or tools called during processing'
    },
    tokens: {
      type: 'number',
      description: 'Total tokens consumed'
    },
    cost: {
      type: 'number',
      description: 'Estimated cost of the request'
    },
    confidence: {
      type: 'number',
      description: 'Confidence score of the response (0-1)'
    }
  },

  settings: {
    timeout: 30000,
    retries: 2,
    maxTokens: 1000,
    temperature: 0.7,
    model: 'gpt-4'
  },

  // Function definitions available to Hal
  functions: [
    {
      name: 'search_inventory',
      description: 'Search dealership inventory by make, model, year, or other criteria',
      parameters: {
        make: { type: 'string' },
        model: { type: 'string' },
        year: { type: 'number' },
        price_range: { type: 'object', properties: { min: { type: 'number' }, max: { type: 'number' } } },
        body_type: { type: 'string' }
      }
    },
    {
      name: 'get_vehicle_details',
      description: 'Get detailed information about a specific vehicle',
      parameters: {
        vin: { type: 'string', required: true },
        include_images: { type: 'boolean', default: true }
      }
    },
    {
      name: 'calculate_financing',
      description: 'Calculate financing options for a vehicle purchase',
      parameters: {
        vehicle_price: { type: 'number', required: true },
        down_payment: { type: 'number', default: 0 },
        term_months: { type: 'number', default: 60 },
        credit_score_range: { type: 'string', enum: ['excellent', 'good', 'fair', 'poor'] }
      }
    },
    {
      name: 'schedule_service',
      description: 'Help schedule service appointments',
      parameters: {
        service_type: { type: 'string', required: true },
        vehicle_info: { type: 'object' },
        preferred_date: { type: 'string' },
        customer_info: { type: 'object' }
      }
    },
    {
      name: 'get_dealership_info',
      description: 'Retrieve dealership hours, location, contact info',
      parameters: {
        info_type: { type: 'string', enum: ['hours', 'location', 'contact', 'services', 'all'] }
      }
    },
    {
      name: 'check_incentives',
      description: 'Check current manufacturer incentives and promotions',
      parameters: {
        make: { type: 'string' },
        model: { type: 'string' },
        customer_type: { type: 'string', enum: ['first_time_buyer', 'military', 'student', 'loyalty', 'general'] }
      }
    },
    {
      name: 'generate_trade_estimate',
      description: 'Estimate trade-in value for customer vehicle',
      parameters: {
        year: { type: 'number', required: true },
        make: { type: 'string', required: true },
        model: { type: 'string', required: true },
        mileage: { type: 'number', required: true },
        condition: { type: 'string', enum: ['excellent', 'good', 'fair', 'poor'] }
      }
    },
    {
      name: 'get_competitive_analysis',
      description: 'Compare pricing and features with competitors',
      parameters: {
        vehicle_info: { type: 'object', required: true },
        competitors: { type: 'array' },
        radius_miles: { type: 'number', default: 25 }
      }
    }
  ],

  // System prompts for different contexts
  systemPrompts: {
    sales: `You are Hal, a knowledgeable and friendly automotive sales assistant. You help customers find the perfect vehicle, understand financing options, and make informed decisions. You're enthusiastic about cars but never pushy. Always ask clarifying questions to better understand customer needs.`,

    service: `You are Hal, a helpful service advisor assistant. You understand automotive maintenance, common issues, and service procedures. You help customers schedule appointments, understand recommended services, and explain repair needs in simple terms.`,

    general: `You are Hal, an intelligent dealership assistant. You have comprehensive knowledge of automotive sales, service, inventory, and dealership operations. You're helpful, professional, and always aim to provide accurate information while delivering excellent customer service.`,

    management: `You are Hal, a strategic business intelligence assistant for dealership management. You can analyze sales data, identify trends, suggest operational improvements, and provide insights for decision-making. You understand automotive retail business metrics and KPIs.`
  },

  // Context-aware response templates
  responseTemplates: {
    inventory_found: "Great! I found {count} vehicles matching your criteria. Here are the top options:",
    no_inventory: "I don't currently see any vehicles matching those exact specifications, but let me suggest some similar options:",
    appointment_scheduled: "Perfect! I've got you scheduled for {service_type} on {date} at {time}. You'll receive a confirmation shortly.",
    financing_calculated: "Based on those numbers, here are your financing options:",
    error_retry: "I apologize, but I'm having trouble accessing that information right now. Let me try a different approach."
  }
};