-- Hal Assistant Rate Limiting Tables
-- Run this in your Supabase SQL Editor

-- Rate limit tracking
CREATE TABLE IF NOT EXISTS rate_limit_usage (
  id SERIAL PRIMARY KEY,
  dealer_id TEXT NOT NULL,
  action TEXT NOT NULL,
  window TEXT NOT NULL, -- 'hour', 'day', 'month'
  window_start TIMESTAMPTZ NOT NULL,
  count INTEGER DEFAULT 1,
  cost DECIMAL(10,6) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(dealer_id, action, window, window_start)
);

-- Usage logging for billing
CREATE TABLE IF NOT EXISTS usage_log (
  id SERIAL PRIMARY KEY,
  dealer_id TEXT NOT NULL,
  action TEXT NOT NULL,
  cost DECIMAL(10,6) DEFAULT 0,
  tier INTEGER NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dealer tier assignments
CREATE TABLE IF NOT EXISTS dealer_tiers (
  dealer_id TEXT PRIMARY KEY,
  tier INTEGER NOT NULL CHECK (tier >= 1 AND tier <= 4),
  subscription_start TIMESTAMPTZ DEFAULT NOW(),
  subscription_end TIMESTAMPTZ,
  auto_renew BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_rate_limit_dealer_action ON rate_limit_usage(dealer_id, action);
CREATE INDEX IF NOT EXISTS idx_rate_limit_window ON rate_limit_usage(window_start);
CREATE INDEX IF NOT EXISTS idx_usage_log_dealer_date ON usage_log(dealer_id, created_at);
CREATE INDEX IF NOT EXISTS idx_dealer_tiers_tier ON dealer_tiers(tier);

-- Insert demo dealer tiers
INSERT INTO dealer_tiers (dealer_id, tier) VALUES
('demo-dealer', 1),
('toyota-naples', 2),
('enterprise-demo', 3)
ON CONFLICT (dealer_id) DO NOTHING;

-- Create RLS policies (optional - for security)
ALTER TABLE rate_limit_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE dealer_tiers ENABLE ROW LEVEL SECURITY;

-- Allow service role to access all data
CREATE POLICY "Service role can access all data" ON rate_limit_usage
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can access all data" ON usage_log
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can access all data" ON dealer_tiers
  FOR ALL USING (auth.role() = 'service_role');

-- Success message
SELECT 'Hal Assistant database setup complete!' as message;
