from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from typing import AsyncGenerator
import logging

from src.config import settings

logger = logging.getLogger(__name__)

# Convert postgres:// URL to postgresql+asyncpg:// for async SQLAlchemy
def get_async_db_url(db_url: str) -> str:
    """Convert sync postgres URL to async postgresql+asyncpg URL."""
    if db_url.startswith("postgres://"):
        return db_url.replace("postgres://", "postgresql+asyncpg://", 1)
    elif db_url.startswith("postgresql://"):
        return db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return db_url


# Create async engine with connection pooling
async_db_url = get_async_db_url(settings.DB_URL)
engine = create_async_engine(
    async_db_url,
    echo=settings.LOG_LEVEL == "DEBUG",
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_recycle=settings.DB_POOL_RECYCLE,
    pool_pre_ping=settings.DB_POOL_PRE_PING,
)

# Create async session factory
AsyncSessionLocal = sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency to get database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception as e:
            logger.error(f"Database session error: {str(e)}")
            await session.rollback()
            raise
        finally:
            await session.close()


async def check_db_connection() -> bool:
    """Check if database connection is working."""
    try:
        async with engine.connect():
            return True
    except Exception as e:
        logger.error(f"Database connection failed: {str(e)}")
        return False
