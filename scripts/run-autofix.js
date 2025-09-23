#!/usr/bin/env node

// Auto-Fix Engine - Production Runner
// Usage: npm run autofix [dealership-id]

const { AutoFixEngine } = require('../lib/autofix/engine');
const { AIProviderManager } = require('../lib/ai/provider-manager');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Sample dealership data (in production, this would come from database)
const SAMPLE_DEALERSHIPS = {
  'premium-honda': {
    name: 'Premium Honda',
    url: 'https://premiumhondacapecoral.com',
    city: 'Cape Coral',
    state: 'FL',
    address: '2301 Del Prado Blvd, Cape Coral, FL 33990',
    phone: '(239) 574-4701',
    makes: ['Honda'],
    hours: 'Mon-Fri 8AM-8PM, Sat 8AM-6PM, Sun 12PM-6PM'
  },
  'automax-tampa': {
    name: 'AutoMax Used Cars',
    url: 'https://automaxusedcars.com',
    city: 'Tampa',
    state: 'FL',
    address: '123 Main St, Tampa, FL 33601',
    phone: '(813) 555-0123',
    makes: ['Multi-Brand'],
    hours: 'Mon-Fri 9AM-7PM, Sat 9AM-6PM'
  }
};

class AutoFixRunner {
  constructor() {
    this.engine = new AutoFixEngine();
    this.aiManager = new AIProviderManager();
  }

  async run(dealershipId = null) {
    console.log('🚀 Auto-Fix Engine Starting...\n');

    // Check environment variables
    if (!this.checkEnvironment()) {
      console.log('❌ Environment check failed. Run: npm run test:ai');
      process.exit(1);
    }

    const dealerships = dealershipId
      ? [SAMPLE_DEALERSHIPS[dealershipId]]
      : Object.values(SAMPLE_DEALERSHIPS);

    if (!dealerships[0]) {
      console.log(`❌ Dealership "${dealershipId}" not found`);
      console.log('Available dealerships:', Object.keys(SAMPLE_DEALERSHIPS).join(', '));
      process.exit(1);
    }

    let totalFixed = 0;
    let totalValue = 0;

    for (const dealership of dealerships) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🏢 Processing: ${dealership.name}`);
      console.log(`${'='.repeat(60)}\n`);

      try {
        // Step 1: Get AI consensus on current state
        console.log('🧠 Getting AI consensus...');
        const consensus = await this.aiManager.getConsensusScore(dealership);

        console.log(`📊 Consensus Score: ${consensus.consensus_score}%`);
        console.log(`🎯 Confidence: ${consensus.confidence}`);
        console.log(`🤖 Providers: ${consensus.provider_count}/4`);

        if (consensus.unanimous_issues.length > 0) {
          console.log(`🔍 Unanimous Issues (${consensus.unanimous_issues.length}):`);
          consensus.unanimous_issues.forEach(issue => {
            console.log(`   • ${issue}`);
          });
        }

        // Step 2: Run Auto-Fix Engine
        console.log('\n🔧 Running Auto-Fix Engine...');
        const fixResults = await this.engine.detectAndFix(dealership);

        console.log(`\n📈 Fix Results for ${dealership.name}:`);
        console.log(`   Total Issues Detected: ${fixResults.totalIssues}`);
        console.log(`   Issues Auto-Fixed: ${fixResults.fixedCount}`);
        console.log(`   Estimated Value Added: $${fixResults.estimatedValue.toLocaleString()}`);

        if (fixResults.results.length > 0) {
          console.log('\n🎯 Detailed Results:');
          fixResults.results.forEach(result => {
            const status = result.status === 'FIXED' ? '✅' : '❌';
            console.log(`   ${status} ${result.issue}: ${result.details}`);
            if (result.value) {
              console.log(`      💰 Value: $${result.value.toLocaleString()}`);
            }
          });
        }

        totalFixed += fixResults.fixedCount;
        totalValue += fixResults.estimatedValue;

        // Step 3: Generate deployment instructions
        if (fixResults.fixedCount > 0) {
          await this.generateDeploymentReport(dealership, fixResults);
        }

      } catch (error) {
        console.error(`❌ Error processing ${dealership.name}:`, error.message);
      }
    }

    // Final summary
    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 AUTO-FIX ENGINE SUMMARY');
    console.log(`${'='.repeat(60)}`);
    console.log(`Total Issues Fixed: ${totalFixed}`);
    console.log(`Total Value Added: $${totalValue.toLocaleString()}`);
    console.log(`Cost of Fixes: ~$${(dealerships.length * 0.05).toFixed(2)} (AI API costs)`);
    console.log(`ROI: ${totalValue > 0 ? Math.round(totalValue / (dealerships.length * 0.05)) : 0}x`);

    if (totalFixed > 0) {
      console.log('\n🚀 Next Steps:');
      console.log('1. Review generated files in ./autofix-reports/');
      console.log('2. Deploy fixes to client websites');
      console.log('3. Verify fixes in 24-48 hours');
      console.log('4. Invoice clients for value delivered');
    }

    console.log('\n✨ Auto-Fix Engine Complete!');
  }

  checkEnvironment() {
    const required = [
      'PERPLEXITY_API_KEY',
      'OPENAI_KEY',
      'GEMINI_KEY'
    ];

    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
      console.log('❌ Missing environment variables:');
      missing.forEach(key => console.log(`   • ${key}`));
      return false;
    }

    return true;
  }

  async generateDeploymentReport(dealership, fixResults) {
    const reportDir = './autofix-reports';
    const fs = require('fs');

    // Create reports directory if it doesn't exist
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const report = {
      dealership: dealership.name,
      timestamp: new Date().toISOString(),
      fixes_applied: fixResults.results.filter(r => r.status === 'FIXED'),
      estimated_value: fixResults.estimatedValue,
      deployment_instructions: [],
      next_verification: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };

    // Add specific deployment instructions based on fixes
    fixResults.results.forEach(result => {
      if (result.status === 'FIXED') {
        switch (result.issue) {
          case 'MISSING_SCHEMA':
            report.deployment_instructions.push(
              'Upload generated schema markup to website head section'
            );
            break;
          case 'MISSING_FAQ':
            report.deployment_instructions.push(
              'Deploy FAQ page to /faq and update sitemap'
            );
            break;
        }
      }
    });

    const filename = `${reportDir}/${dealership.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.json`;
    fs.writeFileSync(filename, JSON.stringify(report, null, 2));

    console.log(`📄 Deployment report saved: ${filename}`);
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const dealershipId = args[0];

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Auto-Fix Engine Usage:

npm run autofix                    # Process all dealerships
npm run autofix premium-honda      # Process specific dealership
npm run autofix --help            # Show this help

Available dealerships:
${Object.keys(SAMPLE_DEALERSHIPS).map(id => `• ${id}`).join('\n')}

Environment variables required:
• PERPLEXITY_API_KEY
• OPENAI_KEY
• GEMINI_KEY
• ANTHROPIC_KEY (optional)
`);
    process.exit(0);
  }

  const runner = new AutoFixRunner();
  await runner.run(dealershipId);
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { AutoFixRunner };