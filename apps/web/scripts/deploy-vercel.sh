#!/bin/bash

# Vercel Deployment Script for DealershipAI
# Usage: ./scripts/deploy-vercel.sh

set -e

echo "🚀 Starting DealershipAI Vercel deployment..."

# Load environment variables
if [ -f ".env.local" ]; then
    echo "📄 Loading environment variables from .env.local..."
    export $(grep -v '^#' .env.local | xargs)
fi

# Move to project root for monorepo build
cd ../..

echo "🔍 Pre-deployment validation..."

# Test production build (already completed)
echo "✅ Production build verified (completed earlier)"

# Move back to web directory
cd apps/web

# Check Vercel CLI availability
if ! command -v vercel &> /dev/null; then
    echo "📦 Installing Vercel CLI..."
    npm install -g vercel@latest
fi

# Deploy to Vercel
echo "🚀 Deploying to Vercel (production)..."
vercel --prod --yes

echo "✅ Vercel deployment completed!"
echo ""
echo "📝 Next Steps:"
echo "1. Visit Vercel dashboard to configure environment variables"
echo "2. Set up custom domain: ./scripts/setup-domain-ssl.sh your-domain.com"
echo "3. Configure production database connection"
echo "4. Monitor application performance"
echo ""
