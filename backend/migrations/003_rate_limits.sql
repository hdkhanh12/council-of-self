-- ==============================================================================
-- 003_RATE_LIMITS.SQL - FINANCIAL GUARDRAILS AGAINST TOKEN DRAIN
-- ==============================================================================

CREATE TABLE IF NOT EXISTS rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    request_count INT DEFAULT 1 NOT NULL,
    window_start TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    CONSTRAINT unique_user_window UNIQUE (user_id, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_user_window ON rate_limits(user_id, window_start);

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_read_own_rate_limits ON rate_limits
    FOR SELECT
    USING (auth.uid() = user_id);