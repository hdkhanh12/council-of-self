-- ==============================================================================
-- CẤP QUYỀN CHO ADMIN BACKEND
-- ==============================================================================

GRANT ALL PRIVILEGES ON TABLE public.sessions TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.debate_turns TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.council_verdicts TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.rate_limits TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.debate_turns TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.council_verdicts TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;