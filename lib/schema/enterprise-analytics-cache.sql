-- Enterprise Analytics Cache Table
-- For storing pre-computed analytics and cron job results

CREATE TABLE IF NOT EXISTS enterprise_analytics_cache (
    cache_key VARCHAR(255) PRIMARY KEY,
    cache_data JSONB NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    access_count INTEGER DEFAULT 0,
    last_accessed TIMESTAMP DEFAULT NOW()
);

-- Index for efficient expiration cleanup
CREATE INDEX IF NOT EXISTS idx_enterprise_analytics_cache_expires
ON enterprise_analytics_cache(expires_at);

-- Index for access patterns
CREATE INDEX IF NOT EXISTS idx_enterprise_analytics_cache_accessed
ON enterprise_analytics_cache(last_accessed, access_count);

-- Function to update access tracking
CREATE OR REPLACE FUNCTION update_analytics_cache_access()
RETURNS TRIGGER AS $$
BEGIN
    NEW.access_count = OLD.access_count + 1;
    NEW.last_accessed = NOW();
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to track cache access
DROP TRIGGER IF EXISTS trigger_analytics_cache_access ON enterprise_analytics_cache;
CREATE TRIGGER trigger_analytics_cache_access
    BEFORE UPDATE ON enterprise_analytics_cache
    FOR EACH ROW
    EXECUTE FUNCTION update_analytics_cache_access();

-- Cleanup function for expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_analytics_cache()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM enterprise_analytics_cache WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;