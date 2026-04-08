from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    anthropic_api_key: str
    openai_api_key: str
    supabase_url: str
    supabase_service_key: str
    environment: str = "development"
    embedding_model: str = "text-embedding-3-small"
    llm_model: str = "claude-sonnet-4-6"

    class Config:
        env_file = ".env"


settings = Settings()
