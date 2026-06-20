-- ==============================================================================
-- 001_INIT_SCHEMA.SQL - CORE TABLES FOR COUNCIL OF SELF
-- ==============================================================================

-- Lưu trữ phiên tranh luận của người dùng
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Lưu chi tiết phát biểu của từng Agent qua các vòng
CREATE TABLE IF NOT EXISTS debate_turns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    agent_role VARCHAR(50) NOT NULL,
    round INT NOT NULL,
    content TEXT NOT NULL,
    tokens_used INT NOT NULL,
    latency_ms INT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Ràng buộc tránh trùng lặp dữ liệu phát biểu trong cùng một vòng
    CONSTRAINT unique_agent_round_per_session UNIQUE (session_id, agent_role, round)
);

-- Lưu kết luận có cấu trúc của Chủ tọa
CREATE TABLE IF NOT EXISTS council_verdicts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID UNIQUE NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    verdict_json JSONB NOT NULL,     -- Lưu cấu trúc: Khuyến nghị, Độ tin cậy, Điều kiện đảo ngược
    total_tokens_used INT NOT NULL,  -- Tổng token tiêu thụ của toàn bộ phiên
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);