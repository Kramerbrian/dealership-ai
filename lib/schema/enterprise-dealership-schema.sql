-- Enterprise DealershipAI Database Schema for 5000+ Rooftops
-- Optimized for high-throughput analysis and competitive intelligence

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Dealership Groups/Organizations (OEMs, Dealer Groups)
CREATE TABLE dealership_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'oem', 'dealer_group', 'independent'
    parent_group_id UUID REFERENCES dealership_groups(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Geographic Markets (DMA, Metropolitan Areas)
CREATE TABLE geographic_markets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    market_code VARCHAR(20) UNIQUE NOT NULL, -- DMA code
    state_code CHAR(2) NOT NULL,
    region VARCHAR(50) NOT NULL, -- Northeast, Southeast, Midwest, etc.
    population INTEGER,
    median_income INTEGER,
    auto_intenders_pct DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT NOW(),
    geom GEOMETRY(POLYGON, 4326), -- Geographic boundaries

    INDEX idx_geographic_markets_region (region),
    INDEX idx_geographic_markets_state (state_code)
);

-- Core Dealerships table
CREATE TABLE dealerships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Identity
    name VARCHAR(255) NOT NULL,
    legal_name VARCHAR(255),
    dba_name VARCHAR(255),
    dealer_code VARCHAR(50), -- OEM dealer code
    dealership_group_id UUID REFERENCES dealership_groups(id),

    -- Location
    street_address VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state_code CHAR(2) NOT NULL,
    zip_code VARCHAR(10),
    geographic_market_id UUID REFERENCES geographic_markets(id),
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),

    -- Digital Presence
    primary_domain VARCHAR(255) NOT NULL,
    additional_domains TEXT[], -- Multiple domains/subdomains
    phone_number VARCHAR(20),

    -- Business Info
    brands TEXT[] NOT NULL, -- ['Toyota', 'Lexus'] for multi-brand stores
    dealership_type VARCHAR(20) NOT NULL, -- 'new', 'used', 'both'
    franchise_type VARCHAR(20) NOT NULL, -- 'franchise', 'independent', 'luxury'
    monthly_unit_sales INTEGER,
    employee_count INTEGER,

    -- Status
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'inactive', 'pending'
    last_analysis_at TIMESTAMP,
    analysis_frequency_hours INTEGER DEFAULT 24,

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Constraints
    UNIQUE(primary_domain),
    CHECK (status IN ('active', 'inactive', 'pending')),
    CHECK (franchise_type IN ('franchise', 'independent', 'luxury')),
    CHECK (dealership_type IN ('new', 'used', 'both'))
);

-- AI Analysis Results (Time-series data)
CREATE TABLE ai_analysis_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dealership_id UUID NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
    analysis_date TIMESTAMP NOT NULL DEFAULT NOW(),

    -- Core Scores
    ai_visibility_score INTEGER NOT NULL CHECK (ai_visibility_score >= 0 AND ai_visibility_score <= 100),
    seo_performance_score INTEGER NOT NULL CHECK (seo_performance_score >= 0 AND seo_performance_score <= 100),
    aeo_readiness_score INTEGER NOT NULL CHECK (aeo_readiness_score >= 0 AND aeo_readiness_score <= 100),
    geo_optimization_score INTEGER NOT NULL CHECK (geo_optimization_score >= 0 AND geo_optimization_score <= 100),
    schema_integrity_score INTEGER NOT NULL CHECK (schema_integrity_score >= 0 AND schema_integrity_score <= 100),
    review_strength_score INTEGER NOT NULL CHECK (review_strength_score >= 0 AND review_strength_score <= 100),

    -- Competitive Intelligence
    market_rank INTEGER,
    market_rank_change INTEGER, -- +/- from previous analysis
    competitive_visibility_ratio DECIMAL(5,2), -- vs market average
    top_competitor_id UUID REFERENCES dealerships(id),

    -- ROI Projections
    monthly_revenue_at_risk INTEGER,
    potential_monthly_recovery INTEGER,
    implementation_cost INTEGER,
    projected_payback_days INTEGER,

    -- Analysis Metadata
    analysis_type VARCHAR(20) DEFAULT 'full', -- 'full', 'quick', 'cached'
    data_freshness_score INTEGER, -- 0-100, how fresh the underlying data was
    confidence_score INTEGER, -- 0-100, confidence in the analysis

    -- Issues and Opportunities (JSON for flexibility)
    critical_issues JSONB DEFAULT '[]'::jsonb,
    opportunities JSONB DEFAULT '[]'::jsonb,

    created_at TIMESTAMP DEFAULT NOW()
);

-- Competitive Analysis (Market-level insights)
CREATE TABLE competitive_analyses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    geographic_market_id UUID NOT NULL REFERENCES geographic_markets(id),
    analysis_date TIMESTAMP NOT NULL DEFAULT NOW(),

    -- Market Stats
    total_dealerships INTEGER NOT NULL,
    active_dealerships INTEGER NOT NULL,
    average_ai_visibility DECIMAL(5,2),
    market_leader_id UUID REFERENCES dealerships(id),
    market_laggard_id UUID REFERENCES dealerships(id),

    -- Brand Analysis
    brand_performance JSONB DEFAULT '{}'::jsonb, -- {"Toyota": {"avg_score": 75, "count": 12}}

    -- Opportunity Analysis
    total_market_opportunity INTEGER, -- Monthly $ opportunity for market
    untapped_opportunity_pct DECIMAL(5,2),

    created_at TIMESTAMP DEFAULT NOW()
);

-- Bulk Analysis Jobs (Queue management for large-scale processing)
CREATE TABLE bulk_analysis_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_name VARCHAR(255) NOT NULL,
    job_type VARCHAR(50) NOT NULL, -- 'full_analysis', 'quick_refresh', 'competitive_scan'

    -- Scope
    dealership_group_id UUID REFERENCES dealership_groups(id),
    geographic_market_id UUID REFERENCES geographic_markets(id),
    dealership_ids UUID[], -- Specific dealerships if not group/market-wide

    -- Execution
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed', 'cancelled'
    priority INTEGER DEFAULT 1000, -- Lower number = higher priority
    scheduled_for TIMESTAMP DEFAULT NOW(),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,

    -- Progress Tracking
    total_dealerships INTEGER,
    completed_dealerships INTEGER DEFAULT 0,
    failed_dealerships INTEGER DEFAULT 0,
    progress_pct DECIMAL(5,2) GENERATED ALWAYS AS (
        CASE
            WHEN total_dealerships > 0 THEN (completed_dealerships * 100.0 / total_dealerships)
            ELSE 0
        END
    ) STORED,

    -- Results
    results_summary JSONB DEFAULT '{}'::jsonb,
    error_log TEXT[],

    -- Metadata
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled'))
);

-- Cache Management for Geographic Data Pooling
CREATE TABLE analysis_cache (
    cache_key VARCHAR(255) PRIMARY KEY,
    cache_tier VARCHAR(10) NOT NULL, -- 'L1', 'L2', 'L3', 'L4'
    geographic_pool VARCHAR(50) NOT NULL,
    data JSONB NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    access_count INTEGER DEFAULT 0,
    last_accessed TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),

    INDEX idx_analysis_cache_expires (expires_at),
    INDEX idx_analysis_cache_pool (geographic_pool),
    INDEX idx_analysis_cache_tier (cache_tier)
);

-- Performance tracking and rate limiting
CREATE TABLE api_usage_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date_hour TIMESTAMP NOT NULL, -- Truncated to hour
    api_endpoint VARCHAR(100) NOT NULL,
    dealership_count INTEGER DEFAULT 0,
    request_count INTEGER DEFAULT 0,
    cache_hit_rate DECIMAL(5,2),
    avg_response_time_ms INTEGER,
    error_count INTEGER DEFAULT 0,

    UNIQUE(date_hour, api_endpoint)
);

-- Indexes for Performance (5000+ dealerships require serious indexing)

-- Dealerships indexes
CREATE INDEX idx_dealerships_group ON dealerships(dealership_group_id);
CREATE INDEX idx_dealerships_market ON dealerships(geographic_market_id);
CREATE INDEX idx_dealerships_status ON dealerships(status) WHERE status = 'active';
CREATE INDEX idx_dealerships_brands ON dealerships USING GIN(brands);
CREATE INDEX idx_dealerships_location ON dealerships(state_code, city);
CREATE INDEX idx_dealerships_last_analysis ON dealerships(last_analysis_at) WHERE status = 'active';
CREATE INDEX idx_dealerships_domain_search ON dealerships USING GIN(primary_domain gin_trgm_ops);

-- Analysis results indexes (time-series optimization)
CREATE INDEX idx_analysis_results_dealership_date ON ai_analysis_results(dealership_id, analysis_date DESC);
CREATE INDEX idx_analysis_results_date ON ai_analysis_results(analysis_date DESC);
CREATE INDEX idx_analysis_results_scores ON ai_analysis_results(ai_visibility_score, seo_performance_score);
CREATE INDEX idx_analysis_results_market_rank ON ai_analysis_results(market_rank) WHERE market_rank IS NOT NULL;

-- Bulk jobs indexes
CREATE INDEX idx_bulk_jobs_status ON bulk_analysis_jobs(status, scheduled_for) WHERE status IN ('pending', 'running');
CREATE INDEX idx_bulk_jobs_priority ON bulk_analysis_jobs(priority, scheduled_for) WHERE status = 'pending';

-- Partitioning for time-series data (crucial for 5000+ dealerships)
-- Partition analysis results by month for better performance
CREATE TABLE ai_analysis_results_template (LIKE ai_analysis_results INCLUDING DEFAULTS INCLUDING CONSTRAINTS);

-- Create monthly partitions (example for current year)
DO $$
DECLARE
    start_date DATE := DATE_TRUNC('month', CURRENT_DATE);
    end_date DATE;
    partition_name TEXT;
BEGIN
    FOR i IN 0..23 LOOP -- 2 years of partitions
        end_date := start_date + INTERVAL '1 month';
        partition_name := 'ai_analysis_results_' || TO_CHAR(start_date, 'YYYY_MM');

        EXECUTE format('
            CREATE TABLE IF NOT EXISTS %I PARTITION OF ai_analysis_results
            FOR VALUES FROM (%L) TO (%L)',
            partition_name, start_date, end_date
        );

        start_date := end_date;
    END LOOP;
END $$;

-- Views for common enterprise queries

-- Current analysis view (latest analysis per dealership)
CREATE VIEW current_dealership_analysis AS
SELECT DISTINCT ON (d.id)
    d.id as dealership_id,
    d.name,
    d.primary_domain,
    d.city,
    d.state_code,
    d.brands,
    d.franchise_type,
    gm.name as market_name,
    dg.name as group_name,
    ar.analysis_date,
    ar.ai_visibility_score,
    ar.seo_performance_score,
    ar.aeo_readiness_score,
    ar.geo_optimization_score,
    ar.schema_integrity_score,
    ar.review_strength_score,
    ar.market_rank,
    ar.monthly_revenue_at_risk,
    ar.potential_monthly_recovery,
    ar.critical_issues,
    ar.opportunities
FROM dealerships d
LEFT JOIN ai_analysis_results ar ON d.id = ar.dealership_id
LEFT JOIN geographic_markets gm ON d.geographic_market_id = gm.id
LEFT JOIN dealership_groups dg ON d.dealership_group_id = dg.id
WHERE d.status = 'active'
ORDER BY d.id, ar.analysis_date DESC NULLS LAST;

-- Market leaderboard view
CREATE VIEW market_leaderboard AS
SELECT
    gm.name as market_name,
    gm.market_code,
    COUNT(DISTINCT d.id) as total_dealerships,
    AVG(ar.ai_visibility_score) as avg_ai_visibility,
    AVG(ar.seo_performance_score) as avg_seo_score,
    SUM(ar.monthly_revenue_at_risk) as total_revenue_at_risk,
    SUM(ar.potential_monthly_recovery) as total_recovery_potential
FROM geographic_markets gm
JOIN dealerships d ON gm.id = d.geographic_market_id
JOIN current_dealership_analysis ar ON d.id = ar.dealership_id
GROUP BY gm.id, gm.name, gm.market_code
ORDER BY avg_ai_visibility DESC;

-- Enterprise performance dashboard view
CREATE VIEW enterprise_dashboard AS
SELECT
    dg.name as group_name,
    dg.type as group_type,
    COUNT(DISTINCT d.id) as total_rooftops,
    COUNT(DISTINCT d.geographic_market_id) as markets_covered,
    AVG(ar.ai_visibility_score) as avg_ai_visibility,
    COUNT(CASE WHEN ar.ai_visibility_score >= 80 THEN 1 END) as high_performers,
    COUNT(CASE WHEN ar.ai_visibility_score < 50 THEN 1 END) as underperformers,
    SUM(ar.monthly_revenue_at_risk) as total_revenue_at_risk,
    SUM(ar.potential_monthly_recovery) as total_opportunity,
    AVG(ar.market_rank) as avg_market_rank
FROM dealership_groups dg
JOIN dealerships d ON dg.id = d.dealership_group_id
JOIN current_dealership_analysis ar ON d.id = ar.dealership_id
WHERE d.status = 'active'
GROUP BY dg.id, dg.name, dg.type
ORDER BY total_rooftops DESC;

-- Performance optimization functions
CREATE OR REPLACE FUNCTION update_dealership_last_analysis()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE dealerships
    SET last_analysis_at = NEW.analysis_date, updated_at = NOW()
    WHERE id = NEW.dealership_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_dealership_last_analysis
    AFTER INSERT ON ai_analysis_results
    FOR EACH ROW
    EXECUTE FUNCTION update_dealership_last_analysis();

-- Cleanup function for old cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM analysis_cache WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;