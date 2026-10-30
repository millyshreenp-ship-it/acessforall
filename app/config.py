from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://afa:afa@db:5432/afa"
    redis_url: str = "redis://redis:6379/0"
    gemini_api_key: str = ""
    model: str = "gemini-2.5-flash"
    gemini_rpm: int = 9  # free tier allows ~10 requests/min for Flash models
    api_keys: str = "dev-key"
    axe_path: str = "/app/axe.min.js"
    media_dir: str = "/data/media"
    rate_limit_per_min: int = 60
    max_tabs: int = 80
    allow_private_hosts: bool = False
    # static frontend served by the API itself (same origin, so no CORS needed)
    web_dir: str = str(Path(__file__).resolve().parents[1] / "web")


settings = Settings()
