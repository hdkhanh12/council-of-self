-- ==============================================================================
-- 002_RLS_POLICIES.SQL - SECURITY GUARDRAILS & PERFORMANCE INDEXES
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- TỐI ƯU HIỆU NĂNG: INDEXES KHÓA NGOẠI
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_debate_turns_session_id ON debate_turns(session_id);
CREATE INDEX IF NOT EXISTS idx_council_verdicts_session_id ON council_verdicts(session_id);

-- ------------------------------------------------------------------------------
-- BẢO MẬT: ROW LEVEL SECURITY (RLS)
-- ------------------------------------------------------------------------------
-- Bật tính năng RLS trên tất cả các bảng
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE debate_turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE council_verdicts ENABLE ROW LEVEL SECURITY;

-- Người dùng chỉ được xem/sửa dữ liệu của chính mình
CREATE POLICY user_all_sessions_policy ON sessions
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Tạo Policy cho bảng Debate Turns: Dựa trên mối quan hệ với bảng Sessions công khai
CREATE POLICY user_all_debate_turns_policy ON debate_turns
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM sessions 
            WHERE sessions.id = debate_turns.session_id 
            AND sessions.user_id = auth.uid()
        )
    );

-- Tạo Policy cho bảng Council Verdicts: Chỉ chủ sở hữu session mới được xem kết luận
CREATE POLICY user_all_verdicts_policy ON council_verdicts
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM sessions 
            WHERE sessions.id = council_verdicts.session_id 
            AND sessions.user_id = auth.uid()
        )
    );