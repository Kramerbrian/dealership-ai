# DealershipAI Enterprise - Deployment Guide

## Phase 1: Cloud Deployment

### Prerequisites
- Node.js 18+ and pnpm installed
- Vercel CLI: `npm i -g vercel`
- Git repository connected to Vercel

### 1. Database Setup (Supabase - Recommended)

1. **Create Supabase Project**
   ```bash
   # Visit https://supabase.com/dashboard
   # Create new project: dealershipai-prod
   ```

2. **Get Connection Details**
   ```bash
   # From Supabase Settings → Database
   DATABASE_URL="postgresql://postgres:[password]@[host]:5432/postgres"
   ```

3. **Run Migrations**
   ```bash
   cd apps/web
   npx prisma migrate deploy
   npx prisma generate
   ```

### 2. Redis Setup (Upstash - Recommended)

1. **Create Upstash Database**
   ```bash
   # Visit https://console.upstash.com/redis
   # Create database: dealershipai-queue
   ```

2. **Get Redis URL**
   ```bash
   UPSTASH_REDIS_URL="rediss://default:[password]@[host]:6380"
   ```

### 3. Environment Variables

Copy `.env.production.example` and set these required variables:

```bash
# Database
DATABASE_URL="your-supabase-postgres-url"

# Redis (Queue & Cache)
UPSTASH_REDIS_URL="your-upstash-redis-url"

# AI Providers (Optional for MVP)
OPENAI_API_KEY="sk-your-openai-key"
ANTHROPIC_API_KEY="sk-ant-your-claude-key"

# Security
NEXTAUTH_SECRET="generate-32-char-secret"
NEXTAUTH_URL="https://your-app.vercel.app"
```

### 4. Vercel Deployment

1. **Install Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **Deploy to Vercel**
   ```bash
   # From project root
   vercel --prod

   # Or link and deploy
   vercel link
   vercel env add DATABASE_URL
   vercel env add UPSTASH_REDIS_URL
   vercel --prod
   ```

3. **Verify Deployment**
   ```bash
   # Test endpoints
   curl https://your-app.vercel.app/api/test
   curl https://your-app.vercel.app/api/prompts
   ```

### 5. Post-Deployment Checklist

- [ ] Database migrations applied
- [ ] Environment variables set
- [ ] API endpoints responding
- [ ] Dashboard loads correctly
- [ ] Queue system functional
- [ ] Error monitoring active

### Troubleshooting

**Build Errors:**
```bash
# Clear cache and rebuild
rm -rf .next node_modules
pnpm install
pnpm build
```

**Database Connection Issues:**
```bash
# Test connection
npx prisma studio
npx prisma db push --preview-feature
```

**Redis Connection Issues:**
```bash
# Test Redis connection in API route
# Check UPSTASH_REDIS_URL format
```

### Next Steps
- Phase 2: Performance & Monitoring
- Phase 3: Real Data Testing
- Phase 4: Documentation & Growth

---

**Support:** Check logs in Vercel dashboard or contact support.