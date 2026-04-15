# Use official Python image as base
FROM python:3.10-slim-bookworm

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Poetry
RUN pip install --no-cache-dir poetry==1.7.1

# Configure Poetry
RUN poetry config virtualenvs.create false

# Copy poetry configuration
COPY pyproject.toml poetry.lock ./

# Install dependencies
RUN poetry install --no-root --only main --no-interaction --no-ansi

# Copy application code
COPY . .

# Create log directory
RUN mkdir -p /var/log/data-connector

# Set environment variables
ENV PYTHONPATH=/app
ENV LOG_DIR=/var/log/data-connector
ENV ENV=prod

# Expose service port
EXPOSE 2131

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:2131/health || exit 1

# Run the service
CMD ["poetry", "run", "start"]
