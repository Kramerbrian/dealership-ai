// Demo data seeding script for DealershipAI
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

const DEMO_DEALERS = [
  {
    id: 'toyota-naples',
    name: 'Toyota of Naples',
    email: 'manager@toyotaofnaples.com',
    location: 'Naples, FL',
    website: 'https://www.toyotaofnaples.com',
    tier: 2
  },
  {
    id: 'honda-orlando',
    name: 'Honda of Orlando',
    email: 'admin@hondaoforlando.com',
    location: 'Orlando, FL',
    website: 'https://www.hondaoforlando.com',
    tier: 1
  },
  {
    id: 'bmw-miami',
    name: 'BMW of Miami',
    email: 'manager@bmwofmiami.com',
    location: 'Miami, FL',
    website: 'https://www.bmwofmiami.com',
    tier: 3
  },
  {
    id: 'ford-tampa',
    name: 'Ford of Tampa',
    email: 'admin@fordoftampa.com',
    location: 'Tampa, FL',
    website: 'https://www.fordoftampa.com',
    tier: 1
  },
  {
    id: 'lexus-jacksonville',
    name: 'Lexus of Jacksonville',
    email: 'manager@lexusofjaksonville.com',
    location: 'Jacksonville, FL',
    website: 'https://www.lexusofjaksonville.com',
    tier: 2
  }
]

const DEMO_USERS = [
  {
    email: 'admin@dealershipai.com',
    name: 'System Administrator',
    role: 'admin',
    password: 'admin123',
    dealerId: null
  },
  {
    email: 'manager@toyotaofnaples.com',
    name: 'Sarah Johnson',
    role: 'dealer',
    password: 'dealer123',
    dealerId: 'toyota-naples'
  },
  {
    email: 'user@toyotaofnaples.com',
    name: 'Mike Rodriguez',
    role: 'user',
    password: 'user123',
    dealerId: 'toyota-naples'
  },
  {
    email: 'admin@hondaoforlando.com',
    name: 'Jennifer Chen',
    role: 'dealer',
    password: 'dealer123',
    dealerId: 'honda-orlando'
  },
  {
    email: 'sales@hondaoforlando.com',
    name: 'David Park',
    role: 'user',
    password: 'user123',
    dealerId: 'honda-orlando'
  },
  {
    email: 'manager@bmwofmiami.com',
    name: 'Carlos Martinez',
    role: 'dealer',
    password: 'dealer123',
    dealerId: 'bmw-miami'
  },
  {
    email: 'marketing@bmwofmiami.com',
    name: 'Lisa Thompson',
    role: 'user',
    password: 'user123',
    dealerId: 'bmw-miami'
  }
]

const DEMO_PROMPT_TEMPLATES = [
  {
    id: 'quick_seo_audit',
    name: 'Quick SEO Audit',
    description: 'Basic SEO analysis for dealership websites',
    category: 'visibility_audit',
    template: 'Analyze the SEO performance of {{website}} focusing on {{focus_area}}. Provide actionable recommendations for a {{brand}} dealership in {{location}}.',
    variables: '["website", "focus_area", "brand", "location"]',
    isActive: true
  },
  {
    id: 'competitor_analysis',
    name: 'Competitor Analysis',
    description: 'Compare dealership against local competitors',
    category: 'competitive',
    template: 'Analyze {{dealership_name}} against competitors in {{location}}. Focus on {{analysis_type}} and provide strategic insights for the {{brand}} market.',
    variables: '["dealership_name", "location", "analysis_type", "brand"]',
    isActive: true
  },
  {
    id: 'review_response',
    name: 'Review Response Generator',
    description: 'Generate professional responses to customer reviews',
    category: 'reputation',
    template: 'Generate a professional response to this {{review_type}} review for {{dealership_name}}: "{{review_text}}". Keep the tone {{tone}} and address {{key_points}}.',
    variables: '["review_type", "dealership_name", "review_text", "tone", "key_points"]',
    isActive: true
  }
]

async function seedDemoData() {
  console.log('🌱 Starting demo data seeding...')

  try {
    // Clean existing data (optional - comment out if you want to preserve data)
    console.log('🧹 Cleaning existing data...')
    await prisma.costEntry.deleteMany()
    await prisma.promptRun.deleteMany()
    await prisma.batchTest.deleteMany()
    await prisma.schemaValidation.deleteMany()
    await prisma.queueJob.deleteMany()
    await prisma.user.deleteMany()
    await prisma.dealer.deleteMany()
    await prisma.promptTemplate.deleteMany()

    // Create dealers
    console.log('🏢 Creating demo dealerships...')
    for (const dealer of DEMO_DEALERS) {
      await prisma.dealer.create({
        data: dealer
      })
      console.log(`  ✅ Created ${dealer.name}`)
    }

    // Create users with hashed passwords
    console.log('👥 Creating demo users...')
    for (const user of DEMO_USERS) {
      const saltRounds = 12
      const passwordHash = await bcrypt.hash(user.password, saltRounds)

      await prisma.user.create({
        data: {
          email: user.email,
          name: user.name,
          role: user.role,
          passwordHash,
          dealerId: user.dealerId,
          isActive: true,
          emailVerified: new Date()
        }
      })
      console.log(`  ✅ Created ${user.name} (${user.email})`)
    }

    // Create prompt templates
    console.log('📝 Creating demo prompt templates...')
    for (const template of DEMO_PROMPT_TEMPLATES) {
      await prisma.promptTemplate.create({
        data: template
      })
      console.log(`  ✅ Created template: ${template.name}`)
    }

    // Create some sample prompt runs
    console.log('🚀 Creating sample prompt runs...')
    const users = await prisma.user.findMany({ where: { role: { not: 'admin' } } })

    for (const user of users.slice(0, 3)) {
      await prisma.promptRun.create({
        data: {
          promptId: 'quick_seo_audit',
          dealerId: user.dealerId!,
          variables: JSON.stringify({
            website: 'https://example-dealer.com',
            focus_area: 'local SEO',
            brand: 'Toyota',
            location: 'Naples, FL'
          }),
          response: 'Your website shows good technical SEO fundamentals. Here are 3 key recommendations: 1) Optimize local citations, 2) Improve page speed, 3) Add more location-specific content.',
          engine: 'openai',
          model: 'gpt-4',
          tokensUsed: 450,
          cost: 0.018,
          latencyMs: 2340,
          status: 'completed'
        }
      })
    }

    // Create a sample batch test
    console.log('📊 Creating sample batch test...')
    const firstDealer = await prisma.dealer.findFirst()
    if (firstDealer) {
      await prisma.batchTest.create({
        data: {
          dealerId: firstDealer.id,
          name: 'Q4 SEO Analysis',
          description: 'Comprehensive SEO audit for all dealership pages',
          status: 'completed',
          prompts: JSON.stringify({
            templates: ['quick_seo_audit', 'competitor_analysis'],
            variables: {
              website: firstDealer.website,
              location: firstDealer.location,
              brand: 'Toyota'
            }
          }),
          results: JSON.stringify({
            total_prompts: 2,
            completed: 2,
            average_score: 85,
            recommendations: 12
          }),
          progress: 100,
          startedAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
          completedAt: new Date(Date.now() - 23 * 60 * 60 * 1000) // 23 hours ago
        }
      })
    }

    // Create sample cost entries
    console.log('💰 Creating sample cost tracking...')
    for (const user of users.slice(0, 2)) {
      for (let i = 0; i < 5; i++) {
        await prisma.costEntry.create({
          data: {
            userId: user.id,
            dealerId: user.dealerId,
            provider: ['openai', 'anthropic'][i % 2],
            model: i % 2 === 0 ? 'gpt-4' : 'claude-3-sonnet',
            operation: 'completion',
            inputTokens: Math.floor(Math.random() * 1000) + 100,
            outputTokens: Math.floor(Math.random() * 500) + 50,
            totalCost: Math.random() * 0.1 + 0.01,
            metadata: JSON.stringify({
              promptId: DEMO_PROMPT_TEMPLATES[i % DEMO_PROMPT_TEMPLATES.length].id,
              sessionId: `session_${i}`
            }),
            createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000) // Random time in last week
          }
        })
      }
    }

    console.log('✅ Demo data seeding completed!')
    console.log('\n🔑 Demo login credentials:')
    console.log('  Admin: admin@dealershipai.com / admin123')
    console.log('  Dealer: manager@toyotaofnaples.com / dealer123')
    console.log('  User: user@toyotaofnaples.com / user123')

  } catch (error) {
    console.error('❌ Error seeding demo data:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the seeding
seedDemoData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })

export { seedDemoData }