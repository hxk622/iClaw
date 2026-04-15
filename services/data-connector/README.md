# Data Connector Service

Market data sync microservice for iClaw platform. This service handles all A-share market data synchronization tasks, including stock basics, quotes, industry/concept relations, and financial data.

## Features

- **Multi-data source fault tolerance**: Automatic failover between AKShare → efinance → Tushare
- **Atomic write guarantee**: Temporary table + transaction pattern prevents dirty data
- **Full audit logging**: All sync operations recorded with detailed metrics
- **Built-in data validation**: Integrity checks and minimum record thresholds
- **Distributed lock**: PostgreSQL-based pessimistic locks prevent duplicate execution in clusters
- **Circuit breaker & retry**: Exponential backoff retry with circuit breaking for fault tolerance
- **Incremental sync**: Hash-based change detection reduces database load
- **Concurrency control**: Priority-based task queuing with configurable concurrency limits
- **Prometheus monitoring**: Comprehensive metrics for sync performance, error rates, and resource usage
- **OpenAPI documentation**: Auto-generated API docs for easy integration

## Getting Started

### Prerequisites

- Python 3.10+
- Poetry
- PostgreSQL 14+

### Installation

```bash
poetry install
```

### Configuration

Copy `.env.example` to `.env` and adjust the configuration:

```bash
cp .env.example .env
```

### Run the service

```bash
poetry run start
```

Or with uvicorn directly:

```bash
poetry run uvicorn src.main:app --host 0.0.0.0 --port 2131
```

## API Endpoints

### Health & Monitoring
- `GET /health` - Health check endpoint
- `GET /metrics` - Prometheus metrics endpoint
- `GET /docs` - OpenAPI documentation (dev environment only)
- `GET /redoc` - ReDoc API documentation (dev environment only)

### Sync Operations
- `POST /api/v1/sync/stock-basics` - Sync stock basic information
- `POST /api/v1/sync/stock-quotes` - Sync stock real-time quotes
- `POST /api/v1/sync/industry-concept` - Sync stock industry and concept relations
- `POST /api/v1/sync/finance-data` - Sync stock financial data

All sync endpoints accept an optional `dry_run` parameter to fetch data without writing to the database.

## Development

### Project Structure

```
src/
├── config/               # Configuration management
├── db/                   # Database connection and utilities
├── sync/                 # Sync task implementations
│   ├── stock_basics.py
│   ├── stock_quotes.py
│   ├── industry_concept.py
│   ├── finance_data.py
│   └── incremental_sync.py   # Incremental sync manager
├── middleware/           # FastAPI middleware
│   └── metrics.py        # Prometheus metrics middleware
├── utils/                # Utility functions
│   ├── lock_manager.py       # Distributed lock implementation
│   ├── retry_decorator.py    # Retry and circuit breaker decorator
│   ├── concurrency_limiter.py # Concurrency control and task queuing
│   ├── data_validator.py     # Data validation utilities
│   ├── temp_table_manager.py # Temporary table for atomic writes
│   └── logger.py             # Structured logging
└── main.py               # FastAPI application entry point
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_URL` | PostgreSQL connection URL | `postgres://iclaw_app:change_me_now@127.0.0.1:5432/iclaw_control` |
| `PORT` | Service port | `2131` |
| `HOST` | Bind host address | `0.0.0.0` |
| `WORKERS` | Number of worker processes | `2` |
| `LOG_LEVEL` | Log level (DEBUG, INFO, WARNING, ERROR) | `INFO` |
| `LOG_DIR` | Log directory path | `./logs` |
| `ENV` | Environment (dev, test, prod) | `dev` |
| `SYNC_MODE` | Sync operation mode (local or microservice) | `microservice` |
| `ENABLE_INCREMENTAL_SYNC` | Enable incremental sync feature | `true` |
| `MAX_CONCURRENT_TASKS` | Maximum concurrent sync tasks | `2` |
| `MAX_RETRY_ATTEMPTS` | Maximum retry attempts for failed tasks | `3` |
| `DATA_SOURCE_PRIORITY` | Data source priority order | `akshare,efinance,tushare` |
| `DEFAULT_LOCK_TTL` | Default distributed lock TTL in seconds | `1800` |
| `MIN_RECORD_THRESHOLD` | Minimum records to accept sync result | `4000` |

## Deployment

### Docker
Build and run with Docker:
```bash
docker build -t iclaw/data-connector:latest .
docker run -p 2131:2131 --env-file .env iclaw/data-connector:latest
```

### Docker Compose
Run the full stack including PostgreSQL, Prometheus, and Grafana:
```bash
# Start core services
docker-compose up -d

# Start with monitoring stack
docker-compose --profile monitoring up -d
```

### Kubernetes
Deploy to Kubernetes:
```bash
kubectl apply -f deploy/k8s/
```

## Monitoring
The service exposes Prometheus metrics at `/metrics` endpoint. Key metrics include:

- `http_requests_total`: Total HTTP requests by endpoint and status
- `http_request_duration_seconds`: HTTP request latency distribution
- `sync_tasks_total`: Total sync tasks by type and status
- `sync_task_duration_seconds`: Sync task latency distribution
- `sync_task_records_processed_total`: Total records processed by sync tasks
- `data_source_requests_total`: Total data source requests by provider
- `db_connections_active`: Active database connections

## Troubleshooting

### Common Issues

1. **Database connection failed**: Check `DB_URL` in .env file and ensure PostgreSQL is running
2. **Sync task returns 0 records**: Verify data source accessibility and network connectivity
3. **Distributed lock acquisition failed**: Check sync_history table for existing locks
4. **High memory usage**: Adjust `MAX_CONCURRENT_TASKS` and `WORKERS` configuration

### Logs
Logs are written to `LOG_DIR` directory or stdout in container environments:
```bash
# View container logs
docker logs data-connector

# View Kubernetes pod logs
kubectl logs -n iclaw -l app=data-connector
```

## Performance Tuning

- **Increase workers**: Adjust `WORKERS` based on CPU cores (recommended: 2-4 per core)
- **Concurrency limits**: Adjust `MAX_CONCURRENT_TASKS` based on database capacity
- **Incremental sync**: Enable `ENABLE_INCREMENTAL_SYNC` to reduce database load
- **Data source timeouts**: Adjust `DATA_SOURCE_TIMEOUT` for slow network environments

## License
Proprietary and confidential. Copyright (c) 2024 iClaw Technology.

