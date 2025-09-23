#!/usr/bin/env tsx

/**
 * Database seeding script for DealershipAI
 *
 * This script populates the database with initial data including:
 * - Sample dealer accounts
 * - User accounts with different roles
 * - Prompt templates
 * - Sample cost tracking data
 * - Queue job examples
 */

import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });
dotenv.config(); // Also load .env if it exists

import { db } from '../lib/db';
import { logger } from '../lib/logger';
import { hash } from 'bcrypt';

interface SeedUser {
  email: string;
  name: string;
  role: 'admin' | 'dealer' | 'user';
  dealerId?: string;
  password: string;
}

interface SeedDealer {
  id: string;
  name: string;
  website: string;
  location: string;
  tier: number;
}

const dealers: SeedDealer[] = [
  {
    id: 'toyota-naples',
    name: 'Toyota of Naples',
    email: 'contact@toyotaofnaples.com',
    website: 'https://toyotaofnaples.com',
    location: 'Naples, FL',
    tier: 2,
  },
  {
    id: 'honda-miami',
    name: 'Honda of Miami',
    email: 'contact@hondaofmiami.com',
    website: 'https://hondaofmiami.com',
    location: 'Miami, FL',
    tier: 3,
  },
  {
    id: 'ford-tampa',
    name: 'Ford of Tampa',
    email: 'contact@fordoftampa.com',
    website: 'https://fordoftampa.com',
    location: 'Tampa, FL',
    tier: 1,
  },
  {
    id: 'bmw-orlando',
    name: 'BMW of Orlando',
    email: 'contact@bmwoforlando.com',
    website: 'https://bmwoforlando.com',
    location: 'Orlando, FL',
    tier: 3,
  },
  {
    id: 'mercedes-sarasota',
    name: 'Mercedes-Benz of Sarasota',
    email: 'contact@mbsarasota.com',
    website: 'https://mbsarasota.com',
    location: 'Sarasota, FL',
    tier: 2,
  },
];

const users: SeedUser[] = [
  {
    email: 'admin@dealershipai.com',
    name: 'System Administrator',
    role: 'admin',
    password: 'admin123',
  },
  {
    email: 'manager@toyotaofnaples.com',
    name: 'John Smith',
    role: 'dealer',
    dealerId: 'toyota-naples',
    password: 'dealer123',
  },
  {
    email: 'user@toyotaofnaples.com',
    name: 'Jane Doe',
    role: 'user',
    dealerId: 'toyota-naples',
    password: 'user123',
  },
  {
    email: 'manager@hondaofmiami.com',
    name: 'Mike Johnson',
    role: 'dealer',
    dealerId: 'honda-miami',
    password: 'dealer123',
  },
  {
    email: 'manager@fordoftampa.com',
    name: 'Sarah Wilson',
    role: 'dealer',
    dealerId: 'ford-tampa',
    password: 'dealer123',
  },
];

const samplePromptTemplates = [
  {
    id: 'seo_audit_basic',
    name: 'Basic SEO Audit',
    description: 'Performs a basic SEO analysis of a dealership website',
    category: 'seo',
    template: `Analyze the SEO performance of {{dealer_name}}'s website at {{website_url}}.

Focus on:
1. Title tags and meta descriptions
2. Header structure (H1, H2, H3)
3. Content quality and keyword usage
4. Internal linking structure
5. Page loading speed indicators

Provide specific recommendations for improvement with priority levels (High, Medium, Low).

Dealer: {{dealer_name}}
Website: {{website_url}}
Location: {{location}}`,
    variables: ['dealer_name', 'website_url', 'location'],
  },
  {
    id: 'competitor_analysis',
    name: 'Competitor Analysis',
    description: 'Analyzes competitors in the local market',
    category: 'competitive',
    template: `Conduct a competitive analysis for {{dealer_name}} in the {{location}} market.

Research the top 3-5 competing dealerships and analyze:
1. Their digital marketing strategies
2. Website user experience and features
3. Social media presence
4. Local SEO performance
5. Customer review strategies

Provide actionable insights for {{dealer_name}} to gain competitive advantage.

Dealer: {{dealer_name}}
Location: {{location}}
Brand: {{brand}}
Website: {{website_url}}`,
    variables: ['dealer_name', 'location', 'brand', 'website_url'],
  },
  {
    id: 'content_optimization',
    name: 'Content Optimization',
    description: 'Optimizes content for better search performance',
    category: 'content',
    template: `Optimize the following content for {{dealer_name}} to improve search engine visibility:

Content to optimize: {{content}}

Requirements:
1. Target keyword: {{target_keyword}}
2. Geographic focus: {{location}}
3. Audience: {{target_audience}}
4. Content type: {{content_type}}

Provide:
- Optimized title suggestions (3 options)
- Enhanced meta description
- Header structure recommendations
- Keyword integration suggestions
- Call-to-action improvements`,
    variables: ['dealer_name', 'content', 'target_keyword', 'location', 'target_audience', 'content_type'],
  },
];

async function seedDatabase() {
  try {
    logger.info('Starting database seeding process...');

    // Clear existing data (in a real scenario, you'd want to be more careful)
    logger.info('Clearing existing seed data...');

    // Clear existing seed data
    await db.costEntries.deleteMany({ where: { userId: { startsWith: 'user' } } });
    await db.users.deleteMany({ where: { email: { endsWith: '@dealershipai.com' } } });
    await db.dealers.deleteMany({ where: { id: { in: dealers.map(d => d.id) } } });

    // Seed dealers
    logger.info('Seeding dealers...');
    for (const dealer of dealers) {
      logger.info(`Creating dealer: ${dealer.name}`);
      await db.dealers.create({ data: dealer });
    }

    // Seed users
    logger.info('Seeding users...');
    for (const user of users) {
      logger.info(`Creating user: ${user.email}`);
      const hashedPassword = await hash(user.password, 12);

      await db.users.create({
        data: {
          email: user.email,
          name: user.name,
          role: user.role,
          dealerId: user.dealerId || null,
          passwordHash: hashedPassword,
        },
      });
    }

    // Seed prompt templates
    logger.info('Seeding prompt templates...');
    for (const template of samplePromptTemplates) {
      logger.info(`Creating template: ${template.name}`);
      await db.promptTemplates.create({
        data: {
          id: template.id,
          name: template.name,
          description: template.description,
          category: template.category,
          template: template.template,
          variables: JSON.stringify(template.variables),
        },
      });
    }

    // Create sample cost tracking entries
    logger.info('Creating sample cost tracking data...');
    const today = new Date();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

    // await db.costTracking.createMany({
    //   data: [
    //     {
    //       userId: 'user1',
    //       dealerId: 'toyota-naples',
    //       provider: 'openai',
    //       model: 'gpt-3.5-turbo',
    //       inputTokens: 1500,
    //       outputTokens: 800,
    //       totalCost: 0.0032,
    //       createdAt: yesterday,
    //     },
    //     {
    //       userId: 'user1',
    //       dealerId: 'toyota-naples',
    //       provider: 'anthropic',
    //       model: 'claude-3-sonnet-20240229',
    //       inputTokens: 2000,
    //       outputTokens: 1200,
    //       totalCost: 0.0156,
    //       createdAt: today,
    //     },
    //   ],
    // });

    // Create sample queue jobs
    logger.info('Creating sample queue jobs...');
    // await db.queueJobs.createMany({
    //   data: [
    //     {
    //       id: 'job-1',
    //       type: 'seo_audit',
    //       status: 'completed',
    //       payload: { templateId: 'seo_audit_basic', dealerId: 'toyota-naples' },
    //       result: { score: 78, recommendations: ['Improve meta descriptions', 'Add schema markup'] },
    //       userId: 'user1',
    //       dealerId: 'toyota-naples',
    //       createdAt: yesterday,
    //       completedAt: yesterday,
    //       processingTime: 15000,
    //     },
    //     {
    //       id: 'job-2',
    //       type: 'competitor_analysis',
    //       status: 'processing',
    //       payload: { templateId: 'competitor_analysis', dealerId: 'honda-miami' },
    //       userId: 'user2',
    //       dealerId: 'honda-miami',
    //       createdAt: today,
    //       startedAt: today,
    //     },
    //     {
    //       id: 'job-3',
    //       type: 'content_optimization',
    //       status: 'pending',
    //       payload: { templateId: 'content_optimization', dealerId: 'ford-tampa' },
    //       userId: 'user3',
    //       dealerId: 'ford-tampa',
    //       createdAt: today,
    //     },
    //   ],
    // });

    logger.info('Database seeding completed successfully!');

    // Print summary
    console.log('\n📊 Seeding Summary:');
    console.log(`✅ Created ${dealers.length} dealers`);
    console.log(`✅ Created ${users.length} users`);
    console.log(`✅ Created ${samplePromptTemplates.length} prompt templates`);
    console.log(`✅ Created sample cost tracking entries`);
    console.log(`✅ Created sample queue jobs`);
    console.log('\n🔐 Default Login Credentials:');
    console.log('Admin: admin@dealershipai.com / admin123');
    console.log('Dealer: manager@toyotaofnaples.com / dealer123');
    console.log('User: user@toyotaofnaples.com / user123');

  } catch (error) {
    logger.error('Database seeding failed', error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

// Run the seeding if called directly (ES module compatible)
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  seedDatabase()
    .then(() => {
      logger.info('Seeding process completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Seeding process failed', error);
      process.exit(1);
    });
}

export { seedDatabase };