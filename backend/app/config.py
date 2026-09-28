"""Runtime configuration. Secrets come from the environment, never from source."""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_ROOT.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(str(BACKEND_ROOT / ".env"), str(REPO_ROOT / ".env")),
        extra="ignore",
    )

    app_env: str = "development"
    database_url: str = "sqlite:///./agroweather.db"
    redis_url: str = "redis://localhost:6379/0"
    secret_key: str = "dev-only-change-me-before-production"
    access_token_expire_minutes: int = 720
    cors_origins: str = "http://localhost:3000"
    auto_bootstrap: bool = False
    enable_scheduler: bool = False
    model_dir: str = "./model_store"
    upload_dir: str = "./uploads"
    max_upload_mb: int = 10
    rate_limit_per_minute: int = 300
    spatial_smooth_weight: float = 0.08
    demo_history_days: int = 180
    demo_leads: str = "24,72,120"
    forecast_provider: str = "demo"

    @property
    def cors_origin_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]

    @property
    def lead_hours(self) -> list[int]:
        return [int(part) for part in self.demo_leads.split(",") if part.strip()]

    def resolve_sqlite(self) -> str:
        url = self.database_url
        prefix = "sqlite:///./"
        if url.startswith(prefix):
            path = (BACKEND_ROOT / url[len(prefix) :]).resolve()
            return "sqlite:///" + path.as_posix()
        return url

    def model_path(self) -> Path:
        path = Path(self.model_dir)
        if not path.is_absolute():
            path = BACKEND_ROOT / path
        path.mkdir(parents=True, exist_ok=True)
        return path

    def upload_path(self) -> Path:
        path = Path(self.upload_dir)
        if not path.is_absolute():
            path = BACKEND_ROOT / path
        path.mkdir(parents=True, exist_ok=True)
        return path


@lru_cache
def get_settings() -> Settings:
    return Settings()
