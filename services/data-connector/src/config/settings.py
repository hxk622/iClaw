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

    # CORS configuration
    CORS_ALLOWED_ORIGINS: str = ""  # Comma-separated list of allowed origins
    CORS_ALLOW_ALL_ORIGINS: bool = False  # Whether to allow all origins (not recommended for production)

    # Database connection pool configuration
    DB_POOL_SIZE: int = 10  # Number of persistent connections to keep open
    DB_MAX_OVERFLOW: int = 20  # Maximum number of extra connections beyond pool_size
    DB_POOL_RECYCLE: int = 3600  # Recycle connections after this many seconds (1 hour)
    DB_POOL_PRE_PING: bool = True  # Whether to ping connections before using them

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = 'allow'


# Global settings instance
settings = Settings()

def get_settings() -> Settings:
    """Get application settings instance."""
    return settings

def get_cors_allowed_origins() -> list[str]:
    """
    Get CORS allowed origins from settings, with environment-specific defaults.

    - Development environment: Allow localhost and 127.0.0.1 on any port
    - Production environment: Allow *.iclaw.com and internal.iclaw.com by default
    - Custom origins can be set via CORS_ALLOWED_ORIGINS environment variable
    """
    if settings.CORS_ALLOW_ALL_ORIGINS:
        return ["*"]

    if settings.CORS_ALLOWED_ORIGINS:
        return [origin.strip() for origin in settings.CORS_ALLOWED_ORIGINS.split(",") if origin.strip()]

    # Environment-specific defaults
    if settings.ENV == "dev":
        return [
            "http://localhost:*",
            "http://127.0.0.1:*",
        ]
    else:
        return [
            "https://*.iclaw.com",
            "https://internal.iclaw.com",
        ]
