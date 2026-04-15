from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Database configuration
    DB_URL: str = "postgres://iclaw_app:change_me_now@127.0.0.1:5432/iclaw_control"

    # Service configuration
    PORT: int = 2131
    HOST: str = "0.0.0.0"
    WORKERS: int = 1

    # Logging configuration
    LOG_LEVEL: str = "INFO"
    LOG_DIR: str = "./logs"

    # Environment
    ENV: str = "dev"

    # Sync task configuration
    SYNC_MODE: str = "local"  # local or microservice
    SYNC_AKSHARE_ENABLED: bool = True
    SYNC_EFINANCE_ENABLED: bool = True
    SYNC_DATA_VALIDATION_THRESHOLD: int = 4000  # Minimum number of stocks to validate

    # Scheduler configuration
    SCHEDULER_ENABLED: bool = True  # Whether to enable built-in scheduler
    SCHEDULER_TIMEZONE: str = "Asia/Shanghai"  # Timezone for scheduler

    class Config:
        env_file = ".env"
        case_sensitive = True


# Global settings instance
settings = Settings()

def get_settings() -> Settings:
    """Get application settings instance."""
    return settings
