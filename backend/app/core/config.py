import os
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # ---- Supabase ----
    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str
    SUPABASE_SERVICE_ROLE_KEY: str
    SUPABASE_JWT_SECRET: str

    # ---- LLM Provider ----
    OPENAI_API_KEY: str

    # ---- Debate Engine Tuning ----
    MAX_ROUNDS: int = 3
    AGENT_TIMEOUT_S: float = 15.0
    MAX_SESSIONS_PER_HOUR: int = 10

    # ---- CORS Configuration ----
    ALLOWED_ORIGINS: str = "*"

    @property
    def origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",")]

    model_config = SettingsConfigDict(
        env_file=os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env"
        ),
        extra="ignore",
    )


settings = Settings()