ALTER TABLE sessions ADD COLUMN IF NOT EXISTS question TEXT NOT NULL DEFAULT '';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'in_progress';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS total_tokens_used INT DEFAULT 0;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS total_latency_ms INT DEFAULT 0;
ALTER TABLE sessions ALTER COLUMN question DROP DEFAULT;

ALTER TABLE debate_turns ADD COLUMN IF NOT EXISTS is_fallback BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, role)
    VALUES (NEW.id, NEW.email, 'user');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_reads_own_profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "admin_reads_all_profiles" ON profiles
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO service_role;

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE debate_turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE council_verdicts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_owns_session" ON sessions;
CREATE POLICY "user_owns_session" ON sessions
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "admin_reads_all_sessions" ON sessions
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

DROP POLICY IF EXISTS "user_reads_own_turns" ON debate_turns;
CREATE POLICY "user_reads_own_turns" ON debate_turns
    FOR SELECT USING (
        session_id IN (SELECT id FROM sessions WHERE user_id = auth.uid())
    );

CREATE POLICY "admin_reads_all_turns" ON debate_turns
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "user_reads_own_verdicts" ON council_verdicts
    FOR SELECT USING (
        session_id IN (SELECT id FROM sessions WHERE user_id = auth.uid())
    );

CREATE POLICY "admin_reads_all_verdicts" ON council_verdicts
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessions TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.debate_turns TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.council_verdicts TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rate_limits TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;

ALTER TABLE rate_limits ADD CONSTRAINT fk_rate_limits_user
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
