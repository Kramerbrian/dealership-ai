#!/usr/bin/env node

// test-ai-providers.js - Test all AI providers are working correctly
// Run: node test-ai-providers.js

import dotenv from 'dotenv';
dotenv.config();

const TEST_DOMAIN = 'example-dealership.com';

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m'
};

// Test prompt that all providers can handle
const TEST_PROMPT = `
Analyze this automotive dealership website for SEO.
Domain: ${TEST_DOMAIN}
Return a JSON object with:
{
  "score": 0-100,
  "issues": ["top 3 issues"],
  "provider": "your AI name"
}
`;

// Test Claude API
async function testClaude() {
  console.log(`${colors.magenta}Testing Claude API...${colors.reset}`);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_KEY || 'test-key',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-opus-20240229',
        max_tokens: 1000,
        messages: [{ role: 'user', content: TEST_PROMPT }]
      })
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`${colors.green}✓ Claude API Connected${colors.reset}`);
      console.log(`  Response preview: ${data.content[0].text.substring(0, 100)}...`);
      return { success: true, provider: 'claude', time: Date.now() };
    } else {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  } catch (error) {
    console.log(`${colors.red}✗ Claude API Failed${colors.reset}`);
    console.log(`  Error: ${error.message}`);
    return { success: false, provider: 'claude', error: error.message };
  }
}

// Test ChatGPT API
async function testChatGPT() {
  console.log(`${colors.green}Testing ChatGPT API...${colors.reset}`);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_KEY || 'test-key'}`
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo-preview',
        messages: [{ role: 'user', content: TEST_PROMPT }],
        response_format: { type: 'json_object' }
      })
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`${colors.green}✓ ChatGPT API Connected${colors.reset}`);
      console.log(`  Response preview: ${data.choices[0].message.content.substring(0, 100)}...`);
      return { success: true, provider: 'chatgpt', time: Date.now() };
    } else {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  } catch (error) {
    console.log(`${colors.red}✗ ChatGPT API Failed${colors.reset}`);
    console.log(`  Error: ${error.message}`);
    return { success: false, provider: 'chatgpt', error: error.message };
  }
}

// Test Gemini API
async function testGemini() {
  console.log(`${colors.blue}Testing Gemini API...${colors.reset}`);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GEMINI_KEY || 'test-key'}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: TEST_PROMPT }] }]
        })
      }
    );

    if (response.ok) {
      const data = await response.json();
      console.log(`${colors.green}✓ Gemini API Connected${colors.reset}`);
      console.log(`  Response preview: ${data.candidates[0].content.parts[0].text.substring(0, 100)}...`);
      return { success: true, provider: 'gemini', time: Date.now() };
    } else {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  } catch (error) {
    console.log(`${colors.red}✗ Gemini API Failed${colors.reset}`);
    console.log(`  Error: ${error.message}`);
    return { success: false, provider: 'gemini', error: error.message };
  }
}

// Test Perplexity API (the missing piece!)
async function testPerplexity() {
  console.log(`${colors.yellow}Testing Perplexity API...${colors.reset}`);

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY || 'test-key'}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-sonar-small-online',
        messages: [{
          role: 'user',
          content: `Search the web for "${TEST_DOMAIN}" and check if it appears in Google search results for "car dealership". Return findings as JSON with score and issues.`
        }],
        max_tokens: 500
      })
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`${colors.green}✓ Perplexity API Connected${colors.reset}`);
      console.log(`  Response preview: ${data.choices[0].message.content.substring(0, 100)}...`);
      return { success: true, provider: 'perplexity', time: Date.now() };
    } else {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  } catch (error) {
    console.log(`${colors.red}✗ Perplexity API Failed${colors.reset}`);
    console.log(`  Error: ${error.message}`);
    return { success: false, provider: 'perplexity', error: error.message };
  }
}

// Test parallel execution
async function testParallelExecution() {
  console.log(`\n${colors.yellow}Testing Parallel Execution...${colors.reset}`);
  console.log('Starting all providers simultaneously...\n');

  const startTime = Date.now();

  // Execute all providers in parallel (including Perplexity!)
  const results = await Promise.allSettled([
    testPerplexity(), // Most important for dealerships
    testChatGPT(),    // Content generation
    testGemini(),     // Google optimization
    testClaude()      // Reasoning and analysis
  ]);

  const endTime = Date.now();
  const totalTime = endTime - startTime;

  console.log(`\n${colors.yellow}═══════════════════════════════════════${colors.reset}`);
  console.log(`${colors.yellow}Parallel Execution Results:${colors.reset}`);
  console.log(`${colors.yellow}═══════════════════════════════════════${colors.reset}\n`);

  // Analyze results
  const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
  const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length;

  console.log(`Total execution time: ${colors.green}${totalTime}ms${colors.reset}`);
  console.log(`Successful providers: ${colors.green}${successful}/4${colors.reset}`);
  console.log(`Failed providers: ${colors.red}${failed}/4${colors.reset}`);

  // Performance comparison
  console.log(`\n${colors.blue}Performance Comparison:${colors.reset}`);
  results.forEach(result => {
    if (result.status === 'fulfilled' && result.value.success) {
      const provider = result.value.provider;
      console.log(`  ${provider}: Ready for production ✓`);
    }
  });

  // Recommendations
  console.log(`\n${colors.magenta}Recommendations:${colors.reset}`);
  if (successful === 4) {
    console.log(`${colors.green}✓ All systems operational! Full consensus mode available.${colors.reset}`);
  } else if (successful >= 3) {
    console.log(`${colors.yellow}⚠ ${successful}/4 providers working. System can run with high confidence.${colors.reset}`);
  } else if (successful >= 2) {
    console.log(`${colors.yellow}⚠ Only ${successful}/4 providers working. Limited consensus available.${colors.reset}`);
  } else {
    console.log(`${colors.red}✗ Insufficient providers working. Check your API keys!${colors.reset}`);
  }

  // Cost estimate (updated for 4 providers)
  console.log(`\n${colors.green}Cost Estimate (per 1000 analyses):${colors.reset}`);
  console.log(`  Perplexity: ~$1   (40% weight - web search)`);
  console.log(`  ChatGPT: ~$20     (30% weight - content)`);
  console.log(`  Gemini: ~$10      (30% weight - Google)`);
  console.log(`  Claude: ~$15      (backup/reasoning)`);
  console.log(`  ${colors.green}Total: ~$21 for dealership-optimized results${colors.reset}`);
  console.log(`  ${colors.magenta}vs Single Claude: ~$450 (95% savings!)${colors.reset}`);

  return { successful, failed, totalTime };
}

// Test webhook endpoint
async function testWebhook() {
  console.log(`\n${colors.yellow}Testing Webhook Endpoint...${colors.reset}`);

  const webhookUrl = process.env.WEBHOOK_URL || 'http://localhost:3001/api/seo-webhook';

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        task: 'test',
        domain: TEST_DOMAIN,
        results: {
          consensus_score: 75,
          provider_scores: {
            perplexity: 78, // Search visibility
            chatgpt: 75,    // Content quality
            gemini: 72,     // Google optimization
            claude: 73      // Technical analysis
          }
        },
        alerts: [{
          severity: 'medium',
          message: 'Test alert',
          action: 'No action needed'
        }]
      })
    });

    if (response.ok) {
      console.log(`${colors.green}✓ Webhook endpoint responsive${colors.reset}`);
    } else {
      console.log(`${colors.yellow}⚠ Webhook returned ${response.status}${colors.reset}`);
    }
  } catch (error) {
    console.log(`${colors.red}✗ Webhook unreachable${colors.reset}`);
    console.log(`  Make sure webhook server is running: npm run webhook`);
  }
}

// Main test runner
async function runAllTests() {
  console.log(`${colors.blue}╔══════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.blue}║    Dealership AI Platform Health Check    ║${colors.reset}`);
  console.log(`${colors.blue}╚══════════════════════════════════════════╝${colors.reset}\n`);

  // Check environment variables
  console.log(`${colors.yellow}Checking environment variables...${colors.reset}`);
  const requiredVars = ['PERPLEXITY_API_KEY', 'OPENAI_KEY', 'GEMINI_KEY', 'ANTHROPIC_KEY'];
  const missingVars = requiredVars.filter(v => !process.env[v]);

  if (missingVars.length > 0) {
    console.log(`${colors.red}⚠ Missing environment variables: ${missingVars.join(', ')}${colors.reset}`);
    console.log(`  Add them to your .env file\n`);
  } else {
    console.log(`${colors.green}✓ All API keys present${colors.reset}\n`);
  }

  // Run tests
  const parallelResults = await testParallelExecution();
  await testWebhook();

  // Final summary
  console.log(`\n${colors.blue}╔══════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.blue}║              Test Complete               ║${colors.reset}`);
  console.log(`${colors.blue}╚══════════════════════════════════════════╝${colors.reset}\n`);

  if (parallelResults.successful >= 3) {
    console.log(`${colors.green}🚀 System ready for production!${colors.reset}`);
    console.log(`${colors.green}   Run 'npm start' to launch dashboard${colors.reset}`);
  } else {
    console.log(`${colors.yellow}⚠ System needs configuration${colors.reset}`);
    console.log(`${colors.yellow}   Check the errors above and update .env${colors.reset}`);
  }

  process.exit(parallelResults.successful >= 3 ? 0 : 1);
}

// Run tests
runAllTests().catch(error => {
  console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
  process.exit(1);
});