#!/bin/bash

# Hal Assistant Setup Script
# This script sets up the complete Hal AI Assistant with tiered rate limiting

echo "🤖 Setting up Hal AI Assistant..."

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
  echo "Creating .env.local file..."
  cat > .env.local << EOF
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# External API Configuration
EXTERNAL_GPT_API_KEY=your_external_api_key_here
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Development
NODE_ENV=development
EOF
  echo "✅ Created .env.local file - Please add your API keys"
else
  echo "✅ .env.local file already exists"
fi

# Check if required dependencies are installed
echo "📦 Checking dependencies..."

# Check if @supabase/supabase-js is installed
if ! npm list @supabase/supabase-js >/dev/null 2>&1; then
  echo "Installing @supabase/supabase-js..."
  npm install @supabase/supabase-js
else
  echo "✅ @supabase/supabase-js is installed"
fi

# Check if openai is installed
if ! npm list openai >/dev/null 2>&1; then
  echo "Installing openai..."
  npm install openai
else
  echo "✅ openai is installed"
fi

# Check if lucide-react is installed
if ! npm list lucide-react >/dev/null 2>&1; then
  echo "Installing lucide-react..."
  npm install lucide-react
else
  echo "✅ lucide-react is installed"
fi

echo ""
echo "🚀 Hal Assistant Setup Complete!"
echo ""
echo "Next steps:"
echo "1. Update your .env.local file with your actual API keys:"
echo "   - OPENAI_API_KEY: Get from https://platform.openai.com/api-keys"
echo "   - SUPABASE_URL & SERVICE_ROLE_KEY: Get from your Supabase project settings"
echo ""
echo "2. Run the Supabase setup script:"
echo "   chmod +x scripts/setup-supabase.sh"
echo "   ./scripts/setup-supabase.sh"
echo ""
echo "3. Start the development server:"
echo "   npm run dev"
echo ""
echo "4. Navigate to the 'Hal Assistant' tab in your dashboard"
echo ""
echo "📋 Features by tier:"
echo "   Tier 1 (Starter): 50 messages/hour, basic chat"
echo "   Tier 2 (Professional): 200 messages/hour, voice input"
echo "   Tier 3 (Enterprise): 500 messages/hour, advanced features"
echo "   Tier 4 (Enterprise Plus): 2000 messages/hour, unlimited features"

# Make the script executable
chmod +x scripts/setup-supabase.sh 2>/dev/null || true

echo ""
echo "💡 Tip: Test different tier levels using the tier selector in the dashboard header"
echo "🎯 Ready to start chatting with Hal!"