import logging
import os
from logging.handlers import TimedRotatingFileHandler
from datetime import datetime
from typing import Optional

from src.config import settings


def setup_logger(name: Optional[str] = None) -> logging.Logger:
    """Set up simple logger with file and console output."""
    logger = logging.getLogger(name or "data-connector")
    logger.setLevel(settings.LOG_LEVEL.upper())

    # Avoid duplicate handlers
    if logger.handlers:
        return logger

    # Create log directory if it doesn't exist
    os.makedirs(settings.LOG_DIR, exist_ok=True)

    # Simple text formatter
    formatter = logging.Formatter(
        fmt="%(asctime)s %(levelname)s %(module)s %(funcName)s %(lineno)d %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%SZ",
    )

    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

    # File handler (daily rotation, keep 30 days)
    log_file = os.path.join(settings.LOG_DIR, "data-connector.log")
    file_handler = TimedRotatingFileHandler(
        log_file,
        when="midnight",
        interval=1,
        backupCount=30,
        encoding="utf-8",
        utc=True,
    )
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)

    return logger


# Global logger instance
logger = setup_logger()
