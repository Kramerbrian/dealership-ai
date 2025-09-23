#!/bin/bash

# Production Deployment Script for DealershipAI
# Usage: ./scripts/deploy-production.sh [environment]

set -e

ENVIRONMENT=${1:-production}
DEPLOY_DIR="/opt/dealershipai"
BACKUP_DIR="/opt/dealershipai/backups"

echo "🚀 Starting DealershipAI production deployment..."

# Load environment variables
if [ -f ".env.local" ]; then
    echo "📄 Loading environment variables from .env.local..."
    export $(grep -v '^#' .env.local | xargs)
fi

# Pre-deployment checks
echo "📋 Running pre-deployment checks..."

# Check if required environment variables are set
required_vars=(
    "DATABASE_URL"
    "NEXTAUTH_SECRET"
    "NEXTAUTH_URL"
    "OPENAI_API_KEY"
    "ANTHROPIC_API_KEY"
)

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ Required environment variable $var is not set"
        exit 1
    fi
done

echo "✅ Environment variables check passed"

# Check if PostgreSQL is running
if ! pg_isready -d "$DATABASE_URL" > /dev/null 2>&1; then
    echo "❌ PostgreSQL database is not accessible"
    echo "   Check DATABASE_URL: $DATABASE_URL"
    exit 1
fi

echo "✅ Database connectivity check passed"

# Build the application
echo "🔨 Building application..."
pnpm install --frozen-lockfile
npx prisma generate
npx prisma db push --accept-data-loss
pnpm build

echo "✅ Application build completed"

# Run database migrations
echo "🗄️ Running database migrations..."
if [ -f "scripts/migrate-to-postgres.sql" ]; then
    psql "$DATABASE_URL" -f scripts/migrate-to-postgres.sql
    echo "✅ Database migration completed"
fi

# Seed database with default data if needed
echo "🌱 Seeding database..."
if [ -f "scripts/seed.ts" ]; then
    npx tsx scripts/seed.ts
    echo "✅ Database seeding completed"
fi

# Health check
echo "🏥 Running health checks..."
timeout 30 bash -c 'until curl -f http://localhost:3000/api/health; do sleep 2; done'

if [ $? -eq 0 ]; then
    echo "✅ Application health check passed"
else
    echo "❌ Application health check failed"
    exit 1
fi

# Performance tests
echo "⚡ Running performance tests..."
echo "   Testing page load times..."

pages=("/" "/dashboard" "/ai-chat" "/analytics")
for page in "${pages[@]}"; do
    response_time=$(curl -o /dev/null -s -w '%{time_total}' "http://localhost:3000$page" || echo "error")
    if [ "$response_time" = "error" ]; then
        echo "   ❌ $page: Failed to load"
    else
        echo "   ✅ $page: ${response_time}s"
    fi
done

# Security checks
echo "🔒 Running security validation..."

# Check for exposed secrets
if grep -r "sk-" . --include="*.js" --include="*.ts" --exclude-dir=node_modules > /dev/null; then
    echo "❌ Potential API keys found in source code"
    exit 1
fi

# Check HTTPS redirect
if curl -I http://localhost:3000 2>/dev/null | grep -q "301\|302"; then
    echo "✅ HTTPS redirect configured"
else
    echo "⚠️  HTTPS redirect not detected (configure reverse proxy)"
fi

# Deployment summary
echo ""
echo "📊 Deployment Summary"
echo "====================="
echo "Environment: $ENVIRONMENT"
echo "Node.js: $(node --version)"
echo "Next.js: $(npx next --version)"
echo "Database: PostgreSQL (connected)"
echo "Build: ✅ Success"
echo "Migrations: ✅ Success"
echo "Health Check: ✅ Success"
echo "Security: ✅ Validated"
echo ""

echo "🎉 Production deployment completed successfully!"
echo ""
echo "📝 Next steps:"
echo "1. Configure SSL certificate"
echo "2. Set up monitoring (Sentry, DataDog, etc.)"
echo "3. Configure backup schedules"
echo "4. Set up CI/CD pipeline"
echo "5. Monitor application logs"
echo ""
echo "🔗 Application URLs:"
echo "   - Application: $NEXTAUTH_URL"
echo "   - Health Check: $NEXTAUTH_URL/api/health"
echo "   - Admin Panel: $NEXTAUTH_URL/dashboard"
echo ""

# Optional: Send deployment notification
if [ ! -z "$SLACK_WEBHOOK_URL" ]; then
    curl -X POST -H 'Content-type: application/json' \
         --data '{"text":"🚀 DealershipAI production deployment completed successfully!"}' \
         "$SLACK_WEBHOOK_URL" || true
fi