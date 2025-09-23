# DealershipAI Web Application

A comprehensive AI-powered platform for automotive dealership digital marketing optimization, featuring SEO analysis, competitor intelligence, and automated content generation.

## 🚀 Features

### Core Functionality
- **AI-Powered Analysis**: SEO, AEO (Answer Engine Optimization), and GEO (Generative Engine Optimization) scoring
- **Batch Processing**: Queue-based system for handling large-scale AI operations
- **Cost Management**: Real-time tracking and budget controls for AI API usage
- **Multi-Provider Support**: OpenAI and Anthropic AI integration
- **Role-Based Access**: Admin, dealer, and user permission levels
- **Real-Time Monitoring**: Live queue metrics and job status tracking

### Dashboard Components
- **Overview Panel**: Key metrics and performance indicators
- **AI Health Monitoring**: Platform rankings and visibility tracking
- **Zero-Click Analysis**: Intent-based search optimization
- **UGC Management**: User-generated content insights
- **Schema Markup**: Structured data optimization
- **Premium Analytics**: Advanced reporting and insights

### Admin Features
- **Queue Management**: Monitor, control, and optimize job processing
- **Cost Dashboard**: Budget tracking, alerts, and utilization monitoring
- **Batch Processor**: Streamlined prompt testing and execution
- **User Management**: Account and permission administration
- **System Analytics**: Performance metrics and usage statistics

## 📁 Project Structure

```
apps/web/
├── app/                    # Next.js 14 App Router
│   ├── api/               # API routes
│   │   ├── batch/         # Batch processing endpoints
│   │   └── queue/         # Queue management endpoints
│   ├── admin/             # Admin interface pages
│   └── globals.css        # Global styles
├── components/            # React components
│   ├── admin/             # Admin-specific components
│   ├── batch/             # Batch processing UI
│   └── layout/            # Layout components
├── hooks/                 # Custom React hooks
├── lib/                   # Utility libraries
│   ├── ai-cost.ts         # Cost tracking system
│   ├── cache.ts           # Cache abstraction
│   ├── logger.ts          # Logging system
│   ├── promptPack.ts      # Prompt management
│   ├── rbac.ts            # Role-based access control
│   └── scoring.ts         # AI scoring algorithms
├── queue/                 # Job queue system
│   ├── index.ts           # Core queue implementation
│   └── processors/        # Job processors
├── data/                  # Static data and configurations
├── scripts/               # Setup and maintenance scripts
└── styles/                # CSS and styling
```

## 🛠️ Installation & Setup

### Prerequisites
- Node.js 18.x or later
- npm or pnpm package manager
- Redis (optional, falls back to in-memory cache)
- PostgreSQL (optional, can use file-based storage)

### Environment Variables

Create a `.env.local` file with the following variables:

```bash
# Application
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000

# AI Providers (at least one required)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Database (optional)
DATABASE_URL=postgresql://user:password@localhost:5432/dealershipai

# Cache (optional)
REDIS_URL=redis://localhost:6379

# Authentication (optional)
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=http://localhost:3000

# Cost Management
DEFAULT_DAILY_BUDGET=50.00
DEFAULT_MONTHLY_BUDGET=1000.00
```

### Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   # or
   pnpm install
   ```

2. **Run Setup Script**
   ```bash
   npm run setup
   ```
   This validates your configuration and initializes the system.

3. **Seed Database (Optional)**
   ```bash
   npm run seed
   ```
   Creates sample data including users, dealers, and prompt templates.

4. **Start Development Server**
   ```bash
   npm run dev
   ```
   Application will be available at `http://localhost:3000`

### Default Login Credentials (after seeding)
- **Admin**: `admin@dealershipai.com` / `admin123`
- **Dealer**: `manager@toyotaofnaples.com` / `dealer123`
- **User**: `user@toyotaofnaples.com` / `user123`

## 📚 API Documentation

### Batch Processing Endpoints

#### POST `/api/batch/preview`
Generate a preview of an AI prompt with cost estimation.

```typescript
{
  "templateId": "seo_audit_comprehensive",
  "variables": {
    "dealer_name": "Toyota Naples",
    "website_url": "https://toyotaofnaples.com"
  }
}
```

#### POST `/api/batch/expand`
Expand a prompt template with variables and validation.

#### POST `/api/batch/run`
Queue a batch job for AI processing.

### Queue Management Endpoints

#### GET `/api/queue/metrics`
Real-time queue statistics and health information.

#### GET `/api/queue/jobs`
List and filter queue jobs with pagination.

#### POST `/api/queue/control`
Administrative queue controls (pause, resume, clear).

### Cost Tracking Endpoints

#### GET `/api/cost/usage`
Current usage statistics and spending data.

#### POST `/api/cost/budget`
Update budget limits and spending controls.

## 🧩 Core Libraries

### Cache System (`lib/cache.ts`)
Abstracted caching with Redis fallback to in-memory storage.

```typescript
import { cache } from '@/lib/cache';

// Store data with TTL
await cache.set('key', data, 3600); // 1 hour

// Retrieve data
const data = await cache.get('key');

// Remember pattern for expensive operations
const result = await cache.remember('expensive-op', async () => {
  return await expensiveOperation();
}, 1800); // 30 minutes
```

### AI Cost Tracking (`lib/ai-cost.ts`)
Comprehensive cost management and budget controls.

```typescript
import { aiCost } from '@/lib/ai-cost';

// Check if operation is within budget
const canProceed = await aiCost.canProceed(
  'openai',
  'gpt-4',
  1000,    // input tokens
  500,     // output tokens
  userId,
  dealerId
);

// Track actual usage
await aiCost.track({
  provider: 'openai',
  model: 'gpt-4',
  inputTokens: 1000,
  outputTokens: 500,
  totalCost: 0.045,
  userId,
  dealerId
});
```

### Queue System (`queue/index.ts`)
Enterprise-grade job processing with priorities and retry logic.

```typescript
import { queue } from '@/queue';

// Add job to queue
const jobId = await queue.add('seo-analysis', {
  dealerId: 'toyota-naples',
  websiteUrl: 'https://example.com'
}, {
  priority: 'high',
  maxAttempts: 3
});

// Monitor job status
const job = await queue.get(jobId);
console.log(job.status); // 'pending', 'processing', 'completed', 'failed'
```

### Scoring Algorithms (`lib/scoring.ts`)
Research-based algorithms for SEO, AEO, and GEO analysis.

```typescript
import { scoring } from '@/lib/scoring';

const seoScore = await scoring.analyzeSEO(content, {
  targetKeywords: ['toyota', 'naples', 'dealership'],
  location: 'Naples, FL'
});

// Returns detailed breakdown:
// {
//   overall: 78,
//   breakdown: {
//     keywords: 85,
//     structure: 72,
//     content: 80,
//     technical: 75
//   },
//   recommendations: [...]
// }
```

## 🎨 Frontend Hooks

### Queue Monitoring
```typescript
import { useQueueMetrics, useQueueJobs } from '@/hooks';

function QueueDashboard() {
  const { metrics, health } = useQueueMetrics(true, 5000); // auto-refresh every 5s
  const { jobs, fetchJobs, retryJob, cancelJob } = useQueueJobs();

  // Component implementation...
}
```

### Batch Processing
```typescript
import { usePromptPreview, useBatchRun } from '@/hooks';

function BatchProcessor() {
  const { preview, loading } = usePromptPreview();
  const { run, data: jobData } = useBatchRun();

  const handlePreview = async () => {
    const result = await preview({
      templateId: 'seo_audit',
      variables: { dealer_name: 'Toyota Naples' }
    });
  };
}
```

### Cost Management
```typescript
import { useCostTracking } from '@/hooks';

function CostDashboard() {
  const {
    usage,
    budgetLimits,
    budgetUtilization,
    updateBudgetLimits
  } = useCostTracking();

  // Real-time cost monitoring and budget management
}
```

## 🎯 Prompt Templates

The system includes a comprehensive prompt pack system with variables and categories:

### SEO Analysis Templates
- **Basic SEO Audit**: Fundamental SEO health check
- **Advanced SEO Analysis**: Deep technical SEO review
- **Local SEO Optimization**: Geographic and local search focus

### Content Optimization
- **Content Enhancement**: Improve existing content for search
- **Meta Tag Optimization**: Title tags and descriptions
- **Schema Markup Generation**: Structured data implementation

### Competitive Intelligence
- **Competitor Analysis**: Market positioning and strategies
- **SERP Analysis**: Search result landscape review
- **Gap Analysis**: Opportunity identification

## 🔒 Security & Permissions

### Role-Based Access Control (RBAC)
- **Admin**: Full system access, user management, global settings
- **Dealer**: Dealership-specific data access, team management
- **User**: Basic functionality access, personal job management

### API Security
- Request authentication and authorization
- Rate limiting and abuse prevention
- Input validation and sanitization
- PII detection and redaction

### Cost Protection
- Budget limits and alerts
- Usage monitoring and caps
- Per-user and per-dealer controls

## 📊 Monitoring & Analytics

### Queue Health Monitoring
- Real-time job processing metrics
- Queue utilization and performance
- Error rates and retry statistics
- Processing time analytics

### Cost Analytics
- Daily, monthly, and total spending
- Provider and model breakdown
- Budget utilization tracking
- Cost trend analysis

### Usage Patterns
- User activity monitoring
- Popular template tracking
- Performance optimization insights

## 🚀 Deployment

### Production Environment Variables
```bash
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://your-domain.com
DATABASE_URL=your-production-db-url
REDIS_URL=your-production-redis-url
# ... other production settings
```

### Build Process
```bash
npm run build
npm run start
```

### Docker Deployment (Optional)
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## 📈 Performance Optimization

### Caching Strategy
- Redis-based caching for frequently accessed data
- In-memory fallback for high-availability
- Intelligent cache invalidation
- TTL-based expiration policies

### Queue Optimization
- Configurable concurrency limits
- Priority-based job scheduling
- Automatic retry with exponential backoff
- Dead letter queue for failed jobs

### Database Optimization
- Connection pooling
- Query optimization and indexing
- Data archival strategies
- Read replica support

## 🔧 Troubleshooting

### Common Issues

**Queue not processing jobs**
```bash
# Check queue metrics
curl http://localhost:3000/api/queue/metrics

# Resume queue if paused
curl -X POST http://localhost:3000/api/queue/control \
  -H "Content-Type: application/json" \
  -d '{"action": "resume"}'
```

**High AI costs**
```bash
# Check current usage
curl http://localhost:3000/api/cost/usage

# Update budget limits
curl -X POST http://localhost:3000/api/cost/budget \
  -H "Content-Type: application/json" \
  -d '{"daily": 25.00, "monthly": 500.00}'
```

**API key issues**
```bash
# Run setup validation
npm run setup
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Make your changes and add tests
4. Run the test suite: `npm run test`
5. Run linting: `npm run lint`
6. Commit changes: `git commit -am 'Add new feature'`
7. Push to branch: `git push origin feature/new-feature`
8. Create a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For technical support or questions:
- Create an issue on GitHub
- Contact the development team
- Check the troubleshooting guide above

---

**DealershipAI** - Revolutionizing automotive digital marketing with AI-powered insights and automation.