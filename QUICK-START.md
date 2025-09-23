# DealershipAI Dashboard - Quick Start Guide
## Get Up and Running in 10 Minutes 🚀

*"The ones who are crazy enough to think they can change the world, are the ones who do."*

This quick start guide will get your DealershipAI dashboard running in under 10 minutes.

## Prerequisites ✅

- Node.js 18+ installed
- npm or yarn
- A Supabase account (free tier works)
- Basic knowledge of React/Next.js

## Step 1: Clone & Install (2 minutes)

```bash
# Clone the repository
git clone https://github.com/yourusername/dealership-ai
cd dealership-ai

# Install dependencies
npm install

# Create necessary directories
mkdir -p components/{auth,dashboard,settings,navigation,shared}
mkdir -p hooks lib types
```

## Step 2: Environment Setup (3 minutes)

Create `.env.local` file:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://vxrdvkhkombwlhjvtsmw.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# AI Agent API Keys (Optional for initial setup)
ANTHROPIC_API_KEY=your_claude_api_key
OPENAI_API_KEY=your_openai_api_key
PERPLEXITY_API_KEY=your_perplexity_api_key
GEMINI_API_KEY=your_gemini_api_key

# Rate Limiting (Optional)
UPSTASH_REDIS_REST_URL=your_redis_url
UPSTASH_REDIS_REST_TOKEN=your_redis_token
```

## Step 3: Database Setup (2 minutes)

1. Go to [Supabase](https://supabase.com) and create a new project
2. Copy your project URL and API keys to `.env.local`
3. Run this SQL in your Supabase SQL editor:

```sql
-- Create dealerships table
CREATE TABLE dealerships (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT,
  location TEXT,
  industry TEXT DEFAULT 'automotive',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create dashboard metrics table
CREATE TABLE dashboard_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dealership_id UUID REFERENCES dealerships(id) ON DELETE CASCADE,
  seo_score NUMERIC(5,2) DEFAULT 0,
  aeo_score NUMERIC(5,2) DEFAULT 0,
  geo_score NUMERIC(5,2) DEFAULT 0,
  ai_visibility_rate NUMERIC(5,2) DEFAULT 0,
  authority_score NUMERIC(5,2) DEFAULT 0,
  trust_score NUMERIC(5,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create agent tasks table
CREATE TABLE agent_tasks (
  id TEXT PRIMARY KEY,
  block_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  task_type TEXT NOT NULL,
  inputs JSONB,
  result JSONB,
  status TEXT CHECK (status IN ('pending', 'running', 'completed', 'failed', 'escalated')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable Row Level Security
ALTER TABLE dealerships ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_tasks ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (basic - everyone can read/write for now)
CREATE POLICY "Enable read access for all users" ON dealerships FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON dealerships FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON dealerships FOR UPDATE USING (true);

CREATE POLICY "Enable read access for all users" ON dashboard_metrics FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON dashboard_metrics FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON dashboard_metrics FOR UPDATE USING (true);

CREATE POLICY "Enable read access for all users" ON agent_tasks FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON agent_tasks FOR INSERT WITH CHECK (true);

-- Insert sample data
INSERT INTO dealerships (id, name, domain, location) VALUES
('550e8400-e29b-41d4-a716-446655440000', 'Premium Auto Dealership', 'premiumauto.com', 'Cape Coral, FL');

INSERT INTO dashboard_metrics (dealership_id, seo_score, aeo_score, geo_score, ai_visibility_rate, authority_score, trust_score) VALUES
('550e8400-e29b-41d4-a716-446655440000', 85.5, 78.2, 82.1, 67.3, 91.8, 88.4);
```

## Step 4: Run the Application (1 minute)

```bash
# Start the development server
npm run dev

# Open your browser to
# http://localhost:3000/dashboard/550e8400-e29b-41d4-a716-446655440000
```

## Step 5: Verify Everything Works (2 minutes)

You should see:
1. ✅ Dashboard loads with sample data
2. ✅ Navigation tabs work
3. ✅ AI Intelligence block shows metrics
4. ✅ No console errors

## Next Steps 🎯

Now that your dashboard is running, you can:

1. **Customize Your Data**: Replace sample data with your actual dealership information
2. **Add AI Keys**: Add your AI service API keys to enable real functionality
3. **Explore Features**: Click through all the dashboard blocks
4. **Read Full Guide**: Check out [DIY-GUIDE.md](./DIY-GUIDE.md) for comprehensive documentation

## Troubleshooting 🔧

**Dashboard won't load?**
- Check that your Supabase URL and keys are correct
- Verify the database tables were created
- Check the browser console for errors

**No data showing?**
- Make sure sample data was inserted
- Check that the dealership ID in the URL matches your database
- Verify RLS policies are set correctly

**Build errors?**
- Run `npm install` again
- Check that all required dependencies are installed
- Ensure you're using Node.js 18+

## Support 💬

- 📚 **Full Documentation**: [DIY-GUIDE.md](./DIY-GUIDE.md)
- 🐛 **Report Issues**: GitHub Issues tab
- 💡 **Feature Requests**: GitHub Discussions
- 💬 **Community**: Join our Discord server

---

**Congratulations! You're now part of the automotive revolution.** 🎉

*Remember: You're not just running a dashboard. You're pioneering the future of dealership management. Think different. Act different. Be the change.*

Ready to dive deeper? Open [DIY-GUIDE.md](./DIY-GUIDE.md) for the complete implementation guide.