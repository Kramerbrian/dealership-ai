-- Cost Tracking Tables for Authentic Data Collection
-- Track costs to maintain 97% profit margin ($3 cost, $99 revenue per dealer)

CREATE TABLE IF NOT EXISTS cost_tracking (
    id SERIAL PRIMARY KEY,
    dealership_id UUID,
    dealership_domain VARCHAR(255) NOT NULL,
    cost_category VARCHAR(50) NOT NULL CHECK (cost_category IN (
        'gmb_api', 'review_aggregation', 'serp_tracking',
        'competitor_intel', 'pagespeed_api', 'schema_validation'
    )),
    cost_amount DECIMAL(10,4) NOT NULL,
    api_calls INTEGER DEFAULT 0,
    data_volume INTEGER DEFAULT 0, -- Bytes processed
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    job_type VARCHAR(50) NOT NULL,
    analysis_date TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),

    FOREIGN KEY (dealership_id) REFERENCES dealerships(id) ON DELETE SET NULL
);

-- Partition by month for better performance with large datasets
CREATE INDEX IF NOT EXISTS idx_cost_tracking_date_category
ON cost_tracking(analysis_date, cost_category);

CREATE INDEX IF NOT EXISTS idx_cost_tracking_dealership
ON cost_tracking(dealership_domain, analysis_date);

CREATE INDEX IF NOT EXISTS idx_cost_tracking_job_type
ON cost_tracking(job_type, analysis_date);

-- Cost Alerts Table
CREATE TABLE IF NOT EXISTS cost_alerts (
    id SERIAL PRIMARY KEY,
    alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN (
        'budget_exceeded', 'cost_spike', 'low_margin', 'api_limit_reached'
    )),
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    description TEXT NOT NULL,
    cost_impact DECIMAL(10,2),
    recommended_action TEXT,
    triggered_at TIMESTAMP NOT NULL,
    resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cost_alerts_severity_date
ON cost_alerts(severity, triggered_at DESC)
WHERE resolved = false;

-- Cost Budget Limits Table
CREATE TABLE IF NOT EXISTS cost_budgets (
    id SERIAL PRIMARY KEY,
    budget_type VARCHAR(50) NOT NULL, -- 'daily', 'weekly', 'monthly', 'per_dealer'
    category VARCHAR(50), -- NULL for overall budget, specific for category budgets
    budget_limit DECIMAL(10,2) NOT NULL,
    warning_threshold DECIMAL(5,2) DEFAULT 0.8, -- 80% warning
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default budget limits
INSERT INTO cost_budgets (budget_type, category, budget_limit, warning_threshold)
VALUES
    ('per_dealer', NULL, 3.00, 0.8),           -- $3 per dealer max
    ('per_dealer', 'serp_tracking', 2.00, 0.9), -- SERP tracking is largest cost
    ('daily', NULL, 1500.00, 0.8),             -- Daily budget for 500 dealers
    ('weekly', NULL, 10000.00, 0.8),           -- Weekly budget
    ('monthly', NULL, 40000.00, 0.8)           -- Monthly budget
ON CONFLICT DO NOTHING;

-- Cost Efficiency Metrics View
CREATE OR REPLACE VIEW cost_efficiency_metrics AS
WITH daily_costs AS (
    SELECT
        DATE(analysis_date) as analysis_date,
        COUNT(DISTINCT dealership_domain) as dealerships_analyzed,
        SUM(cost_amount) as total_daily_cost,
        SUM(cost_amount) / COUNT(DISTINCT dealership_domain) as cost_per_dealer,
        COUNT(*) FILTER (WHERE success = true) / COUNT(*)::float as success_rate,
        SUM(api_calls) as total_api_calls
    FROM cost_tracking
    WHERE analysis_date >= NOW() - INTERVAL '90 days'
    GROUP BY DATE(analysis_date)
)
SELECT
    analysis_date,
    dealerships_analyzed,
    total_daily_cost,
    cost_per_dealer,
    success_rate,
    total_api_calls,
    -- Profit calculations
    (dealerships_analyzed * 99.00) as potential_revenue,
    ((dealerships_analyzed * 99.00) - total_daily_cost) as daily_profit,
    CASE
        WHEN dealerships_analyzed > 0 THEN
            ((dealerships_analyzed * 99.00) - total_daily_cost) / (dealerships_analyzed * 99.00)
        ELSE 0
    END as profit_margin,
    -- Efficiency scores
    CASE
        WHEN cost_per_dealer <= 3.00 AND success_rate >= 0.95 THEN 'Excellent'
        WHEN cost_per_dealer <= 4.00 AND success_rate >= 0.90 THEN 'Good'
        WHEN cost_per_dealer <= 5.00 AND success_rate >= 0.85 THEN 'Fair'
        ELSE 'Poor'
    END as efficiency_rating
FROM daily_costs
ORDER BY analysis_date DESC;

-- Function to calculate running cost totals
CREATE OR REPLACE FUNCTION get_running_cost_total(
    p_period TEXT DEFAULT 'day',
    p_category TEXT DEFAULT NULL
) RETURNS TABLE (
    period_start TIMESTAMP,
    period_end TIMESTAMP,
    total_cost DECIMAL,
    dealership_count INTEGER,
    cost_per_dealer DECIMAL,
    success_rate DECIMAL
) AS $$
DECLARE
    interval_text TEXT;
BEGIN
    interval_text := CASE
        WHEN p_period = 'hour' THEN '1 hour'
        WHEN p_period = 'day' THEN '1 day'
        WHEN p_period = 'week' THEN '7 days'
        WHEN p_period = 'month' THEN '30 days'
        ELSE '1 day'
    END;

    RETURN QUERY
    SELECT
        NOW() - interval_text::INTERVAL as period_start,
        NOW() as period_end,
        COALESCE(SUM(ct.cost_amount), 0)::DECIMAL as total_cost,
        COUNT(DISTINCT ct.dealership_domain)::INTEGER as dealership_count,
        CASE
            WHEN COUNT(DISTINCT ct.dealership_domain) > 0
            THEN (COALESCE(SUM(ct.cost_amount), 0) / COUNT(DISTINCT ct.dealership_domain))::DECIMAL
            ELSE 0::DECIMAL
        END as cost_per_dealer,
        CASE
            WHEN COUNT(*) > 0
            THEN (COUNT(*) FILTER (WHERE ct.success = true)::DECIMAL / COUNT(*)::DECIMAL)
            ELSE 0::DECIMAL
        END as success_rate
    FROM cost_tracking ct
    WHERE ct.analysis_date >= NOW() - interval_text::INTERVAL
        AND (p_category IS NULL OR ct.cost_category = p_category);
END;
$$ LANGUAGE plpgsql;

-- Trigger to check budget limits
CREATE OR REPLACE FUNCTION check_cost_budget() RETURNS TRIGGER AS $$
DECLARE
    current_cost DECIMAL;
    budget_limit DECIMAL;
    warning_threshold DECIMAL;
    alert_description TEXT;
BEGIN
    -- Check per-dealer budget
    SELECT
        SUM(cost_amount) / COUNT(DISTINCT dealership_domain),
        budget_limit,
        warning_threshold
    INTO current_cost, budget_limit, warning_threshold
    FROM cost_tracking ct
    CROSS JOIN cost_budgets cb
    WHERE ct.analysis_date >= DATE_TRUNC('day', NOW())
        AND cb.budget_type = 'per_dealer'
        AND cb.category IS NULL
        AND cb.active = true
    GROUP BY budget_limit, warning_threshold;

    -- Create alert if budget exceeded
    IF current_cost > budget_limit THEN
        INSERT INTO cost_alerts (
            alert_type, severity, description, cost_impact,
            recommended_action, triggered_at
        ) VALUES (
            'budget_exceeded',
            'critical',
            'Daily per-dealer cost (' || current_cost || ') exceeds budget limit (' || budget_limit || ')',
            current_cost - budget_limit,
            'Review data collection efficiency and reduce API usage',
            NOW()
        );
    ELSIF current_cost > (budget_limit * warning_threshold) THEN
        INSERT INTO cost_alerts (
            alert_type, severity, description, cost_impact,
            recommended_action, triggered_at
        ) VALUES (
            'cost_spike',
            'medium',
            'Daily per-dealer cost approaching budget limit',
            current_cost - (budget_limit * warning_threshold),
            'Monitor cost trends and optimize data collection',
            NOW()
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_cost_budget_check ON cost_tracking;
CREATE TRIGGER trigger_cost_budget_check
    AFTER INSERT ON cost_tracking
    FOR EACH ROW
    EXECUTE FUNCTION check_cost_budget();

-- Create summary table for quick access to daily metrics
CREATE TABLE IF NOT EXISTS daily_cost_summary (
    summary_date DATE PRIMARY KEY,
    total_cost DECIMAL(10,2) NOT NULL,
    total_dealerships INTEGER NOT NULL,
    cost_per_dealer DECIMAL(8,4) NOT NULL,
    total_api_calls INTEGER DEFAULT 0,
    success_rate DECIMAL(5,4) DEFAULT 1.0,
    profit_margin DECIMAL(5,4) NOT NULL,
    efficiency_rating VARCHAR(20),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Function to update daily summary
CREATE OR REPLACE FUNCTION update_daily_cost_summary() RETURNS void AS $$
BEGIN
    INSERT INTO daily_cost_summary (
        summary_date, total_cost, total_dealerships, cost_per_dealer,
        total_api_calls, success_rate, profit_margin, efficiency_rating
    )
    SELECT
        DATE(analysis_date),
        SUM(cost_amount),
        COUNT(DISTINCT dealership_domain),
        SUM(cost_amount) / COUNT(DISTINCT dealership_domain),
        SUM(api_calls),
        COUNT(*) FILTER (WHERE success = true) / COUNT(*)::float,
        1 - (SUM(cost_amount) / (COUNT(DISTINCT dealership_domain) * 99.00)),
        CASE
            WHEN (SUM(cost_amount) / COUNT(DISTINCT dealership_domain)) <= 3.00
                AND COUNT(*) FILTER (WHERE success = true) / COUNT(*)::float >= 0.95 THEN 'Excellent'
            WHEN (SUM(cost_amount) / COUNT(DISTINCT dealership_domain)) <= 4.00
                AND COUNT(*) FILTER (WHERE success = true) / COUNT(*)::float >= 0.90 THEN 'Good'
            WHEN (SUM(cost_amount) / COUNT(DISTINCT dealership_domain)) <= 5.00
                AND COUNT(*) FILTER (WHERE success = true) / COUNT(*)::float >= 0.85 THEN 'Fair'
            ELSE 'Poor'
        END
    FROM cost_tracking
    WHERE DATE(analysis_date) = CURRENT_DATE - INTERVAL '1 day'
    GROUP BY DATE(analysis_date)
    ON CONFLICT (summary_date) DO UPDATE SET
        total_cost = EXCLUDED.total_cost,
        total_dealerships = EXCLUDED.total_dealerships,
        cost_per_dealer = EXCLUDED.cost_per_dealer,
        total_api_calls = EXCLUDED.total_api_calls,
        success_rate = EXCLUDED.success_rate,
        profit_margin = EXCLUDED.profit_margin,
        efficiency_rating = EXCLUDED.efficiency_rating,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;