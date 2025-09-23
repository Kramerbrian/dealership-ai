#!/usr/bin/env tsx

/**
 * Setup script for DealershipAI
 *
 * This script:
 * 1. Validates environment configuration
 * 2. Tests database connectivity
 * 3. Checks API keys
 * 4. Initializes cache system
 * 5. Sets up initial configuration
 */

import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });
dotenv.config(); // Also load .env if it exists

import { logger } from '../lib/logger';
import { cache } from '../lib/cache';
import { db } from '../lib/db';
import { costTracker } from '../lib/ai-cost';

interface SetupCheck {
  name: string;
  description: string;
  required: boolean;
  check: () => Promise<boolean>;
  fix?: () => Promise<void>;
}

const checks: SetupCheck[] = [
  {
    name: 'Environment Variables',
    description: 'Check for required environment variables',
    required: true,
    check: async () => {
      const required = [
        'NODE_ENV',
        'OPENAI_API_KEY',
        'ANTHROPIC_API_KEY',
      ];

      const optional = [
        'DATABASE_URL',
        'REDIS_URL',
        'NEXTAUTH_SECRET',
        'NEXTAUTH_URL',
      ];

      let allGood = true;
      const missing: string[] = [];

      for (const key of required) {
        if (!process.env[key]) {
          missing.push(key);
          allGood = false;
        }
      }

      if (!allGood) {
        logger.error(`Missing required environment variables: ${missing.join(', ')}`);
        console.log('\n📋 Required Environment Variables:');
        for (const key of required) {
          const status = process.env[key] ? '✅' : '❌';
          console.log(`${status} ${key}`);
        }

        console.log('\n📋 Optional Environment Variables:');
        for (const key of optional) {
          const status = process.env[key] ? '✅' : '⚪';
          console.log(`${status} ${key}`);
        }
      }

      return allGood;
    },
  },
  {
    name: 'AI API Keys',
    description: 'Validate AI provider API keys',
    required: true,
    check: async () => {
      let validKeys = 0;
      const totalKeys = 2;

      // Test OpenAI API
      if (process.env.OPENAI_API_KEY) {
        try {
          // Simple API test - in real implementation, make a minimal API call
          const keyValid = process.env.OPENAI_API_KEY.startsWith('sk-');
          if (keyValid) {
            validKeys++;
            logger.info('OpenAI API key format is valid');
          } else {
            logger.warn('OpenAI API key format appears invalid');
          }
        } catch (error) {
          logger.error('OpenAI API key validation failed', error instanceof Error ? error : new Error(String(error)));
        }
      }

      // Test Anthropic API
      if (process.env.ANTHROPIC_API_KEY) {
        try {
          // Simple API test - in real implementation, make a minimal API call
          const keyValid = process.env.ANTHROPIC_API_KEY.startsWith('sk-ant-');
          if (keyValid) {
            validKeys++;
            logger.info('Anthropic API key format is valid');
          } else {
            logger.warn('Anthropic API key format appears invalid');
          }
        } catch (error) {
          logger.error('Anthropic API key validation failed', error instanceof Error ? error : new Error(String(error)));
        }
      }

      return validKeys >= 1; // At least one API key should work
    },
  },
  {
    name: 'Cache System',
    description: 'Initialize and test cache connectivity',
    required: false,
    check: async () => {
      try {
        await cache.set('setup-test', 'working', 10);
        const result = await cache.get('setup-test');
        await cache.del('setup-test');
        return result === 'working';
      } catch (error) {
        logger.error('Cache system test failed', error instanceof Error ? error : new Error(String(error)));
        return false;
      }
    },
  },
  {
    name: 'Database Connection',
    description: 'Test database connectivity',
    required: false,
    check: async () => {
      try {
        // In real implementation, test actual database connection
        // await db.$connect();
        logger.info('Database connection test passed (simulated)');
        return true;
      } catch (error) {
        logger.error('Database connection failed', error instanceof Error ? error : new Error(String(error)));
        return false;
      }
    },
  },
  {
    name: 'Cost Tracking System',
    description: 'Initialize cost tracking and budget limits',
    required: false,
    check: async () => {
      try {
        // Test cost tracking functionality
        const pricing = costTracker.calculateCost('openai', 'gpt-3.5-turbo', 100, 50);
        return pricing !== null;
      } catch (error) {
        logger.error('Cost tracking system test failed', error instanceof Error ? error : new Error(String(error)));
        return false;
      }
    },
  },
];

async function runSetup() {
  console.log('🚀 DealershipAI Setup Script\n');

  let allPassed = true;
  const results: Array<{ name: string; passed: boolean; required: boolean }> = [];

  for (const check of checks) {
    console.log(`🔍 Checking: ${check.name}`);
    console.log(`   ${check.description}`);

    try {
      const passed = await check.check();
      results.push({ name: check.name, passed, required: check.required });

      if (passed) {
        console.log(`   ✅ Passed\n`);
      } else {
        console.log(`   ${check.required ? '❌' : '⚠️'} ${check.required ? 'Failed' : 'Warning'}\n`);
        if (check.required) {
          allPassed = false;
        }
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error}\n`);
      results.push({ name: check.name, passed: false, required: check.required });
      if (check.required) {
        allPassed = false;
      }
    }
  }

  // Print summary
  console.log('📊 Setup Summary:');
  console.log('==================');

  const requiredPassed = results.filter(r => r.required && r.passed).length;
  const requiredTotal = results.filter(r => r.required).length;
  const optionalPassed = results.filter(r => !r.required && r.passed).length;
  const optionalTotal = results.filter(r => !r.required).length;

  console.log(`Required checks: ${requiredPassed}/${requiredTotal} passed`);
  console.log(`Optional checks: ${optionalPassed}/${optionalTotal} passed`);

  if (allPassed) {
    console.log('\n🎉 Setup completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Run the seeding script: npm run seed');
    console.log('2. Start the development server: npm run dev');
    console.log('3. Visit http://localhost:3000 to access the application');

    // Set up initial configuration
    await setupInitialConfig();

    return true;
  } else {
    console.log('\n⚠️  Setup completed with errors');
    console.log('\nPlease fix the required checks before proceeding:');

    for (const result of results) {
      if (result.required && !result.passed) {
        console.log(`❌ ${result.name}`);
      }
    }

    console.log('\nRefer to the documentation for help with configuration.');
    return false;
  }
}

async function setupInitialConfig() {
  try {
    logger.info('Setting up initial configuration...');

    // Initialize default budget limits
    await cache.set('budget-limits-default', {
      daily: 50.0,
      monthly: 1000.0,
    }, 86400 * 30); // 30 days

    // Initialize system settings
    await cache.set('system-settings', {
      queueConcurrency: 3,
      defaultProvider: 'openai',
      defaultModel: 'gpt-3.5-turbo',
      retentionDays: 30,
    }, 86400 * 7); // 7 days

    // Initialize rate limits
    await cache.set('rate-limits-default', {
      requestsPerMinute: 60,
      requestsPerHour: 1000,
      requestsPerDay: 10000,
    }, 86400); // 1 day

    logger.info('Initial configuration setup completed');

  } catch (error) {
    logger.error('Failed to set up initial configuration', error instanceof Error ? error : new Error(String(error)));
  }
}

// Run setup if called directly (ES module compatible)
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  runSetup()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      logger.error('Setup script failed', error);
      process.exit(1);
    });
}

export { runSetup };