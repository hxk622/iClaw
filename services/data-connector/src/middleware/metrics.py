import time
from typing import Callable
from prometheus_client import Counter, Gauge, Histogram, generate_latest, CONTENT_TYPE_LATEST
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.status import HTTP_500_INTERNAL_SERVER_ERROR
from src.utils.logger import logger

# HTTP请求指标
HTTP_REQUESTS_TOTAL = Counter(
    "http_requests_total",
    "Total number of HTTP requests",
    ["method", "endpoint", "status_code"]
)

HTTP_REQUEST_DURATION = Histogram(
    "http_request_duration_seconds",
    "Duration of HTTP requests in seconds",
    ["method", "endpoint", "status_code"],
    buckets=[0.01, 0.05, 0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0, 60.0]
)

HTTP_REQUESTS_IN_PROGRESS = Gauge(
    "http_requests_in_progress",
    "Number of HTTP requests currently in progress",
    ["method", "endpoint"]
)

# 同步任务指标
SYNC_TASKS_TOTAL = Counter(
    "sync_tasks_total",
    "Total number of sync tasks executed",
    ["task_name", "status", "data_source"]
)

SYNC_TASK_DURATION = Histogram(
    "sync_task_duration_seconds",
    "Duration of sync tasks in seconds",
    ["task_name", "data_source"],
    buckets=[1.0, 5.0, 10.0, 30.0, 60.0, 120.0, 300.0, 600.0, 1800.0]
)

SYNC_TASK_RECORDS_PROCESSED = Counter(
    "sync_task_records_processed_total",
    "Total number of records processed by sync tasks",
    ["task_name", "record_type"]
)

SYNC_TASK_ERRORS_TOTAL = Counter(
    "sync_task_errors_total",
    "Total number of errors in sync tasks",
    ["task_name", "error_type", "data_source"]
)

# 新增同步任务指标
SYNC_TASK_DATA_COUNT = Gauge(
    "sync_task_data_count",
    "Number of records synced in the last successful task execution",
    ["task_name", "data_source"]
)

SYNC_TASK_SOURCE_USED = Gauge(
    "sync_task_source_used",
    "Data source used for the last successful task execution (1 = used, 0 = not used)",
    ["task_name", "data_source"]
)

SYNC_TASK_SOURCE_CIRCUIT_BREAK = Counter(
    "sync_task_source_circuit_break_total",
    "Total number of times a data source circuit breaker was triggered",
    ["task_name", "data_source", "reason"]
)

SYNC_TASK_VALIDATION_FAILURE = Counter(
    "sync_task_validation_failure_total",
    "Total number of data validation failures during sync tasks",
    ["task_name", "validation_type", "reason"]
)

# 数据源指标
DATA_SOURCE_REQUESTS_TOTAL = Counter(
    "data_source_requests_total",
    "Total number of requests to data sources",
    ["data_source", "endpoint", "status"]
)

DATA_SOURCE_REQUEST_DURATION = Histogram(
    "data_source_request_duration_seconds",
    "Duration of requests to data sources in seconds",
    ["data_source", "endpoint"],
    buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0]
)

DATA_SOURCE_ERRORS_TOTAL = Counter(
    "data_source_errors_total",
    "Total number of errors from data sources",
    ["data_source", "error_type"]
)

# 数据库连接池指标
DB_CONNECTIONS_ACTIVE = Gauge(
    "db_connections_active",
    "Number of active database connections"
)

DB_CONNECTIONS_IDLE = Gauge(
    "db_connections_idle",
    "Number of idle database connections"
)

DB_CONNECTIONS_WAITING = Gauge(
    "db_connections_waiting",
    "Number of requests waiting for a database connection"
)

# 分布式锁指标
LOCK_ACQUIRE_TOTAL = Counter(
    "lock_acquire_total",
    "Total number of lock acquire attempts",
    ["lock_name", "result"]
)

LOCK_HOLD_DURATION = Histogram(
    "lock_hold_duration_seconds",
    "Duration locks are held for",
    ["lock_name"],
    buckets=[1.0, 5.0, 10.0, 30.0, 60.0, 120.0, 300.0, 600.0, 1800.0]
)

class PrometheusMiddleware(BaseHTTPMiddleware):
    """Prometheus监控中间件"""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        method = request.method
        endpoint = request.url.path

        # 跳过metrics端点自身的监控
        if endpoint == "/metrics":
            return await call_next(request)

        start_time = time.time()
        HTTP_REQUESTS_IN_PROGRESS.labels(method=method, endpoint=endpoint).inc()

        try:
            response = await call_next(request)
            status_code = response.status_code
            return response
        except Exception as e:
            status_code = HTTP_500_INTERNAL_SERVER_ERROR
            logger.error(f"Request failed: {str(e)}")
            raise
        finally:
            duration = time.time() - start_time
            HTTP_REQUESTS_IN_PROGRESS.labels(method=method, endpoint=endpoint).dec()
            HTTP_REQUESTS_TOTAL.labels(
                method=method,
                endpoint=endpoint,
                status_code=str(status_code)
            ).inc()
            HTTP_REQUEST_DURATION.labels(
                method=method,
                endpoint=endpoint,
                status_code=str(status_code)
            ).observe(duration)

async def metrics_endpoint() -> Response:
    """Metrics端点，返回Prometheus格式的指标数据"""
    # 更新数据库连接池指标
    from src.db.session import engine
    try:
        pool = engine.pool
        DB_CONNECTIONS_ACTIVE.set(pool.checkedout())
        DB_CONNECTIONS_IDLE.set(pool.checkedin())
        DB_CONNECTIONS_WAITING.set(pool.waiting())
    except Exception as e:
        logger.warning(f"Failed to get DB pool metrics: {str(e)}")

    return Response(
        content=generate_latest(),
        media_type=CONTENT_TYPE_LATEST
    )

# 同步任务指标装饰器
def track_sync_task(task_name: str):
    """
    同步任务指标装饰器
    :param task_name: 任务名称
    """
    def decorator(func: Callable) -> Callable:
        async def wrapper(*args, **kwargs):
            start_time = time.time()
            data_source = kwargs.get('data_source', 'unknown')

            try:
                result = await func(*args, **kwargs)
                SYNC_TASKS_TOTAL.labels(
                    task_name=task_name,
                    status="success",
                    data_source=data_source
                ).inc()
                return result
            except Exception as e:
                SYNC_TASKS_TOTAL.labels(
                    task_name=task_name,
                    status="failed",
                    data_source=data_source
                ).inc()
                SYNC_TASK_ERRORS_TOTAL.labels(
                    task_name=task_name,
                    error_type=type(e).__name__,
                    data_source=data_source
                ).inc()
                raise
            finally:
                duration = time.time() - start_time
                SYNC_TASK_DURATION.labels(
                    task_name=task_name,
                    data_source=data_source
                ).observe(duration)

        return wrapper
    return decorator

# 数据源请求指标装饰器
def track_data_source_request(data_source: str, endpoint: str):
    """
    数据源请求指标装饰器
    :param data_source: 数据源名称
    :param endpoint: 请求端点
    """
    def decorator(func: Callable) -> Callable:
        async def wrapper(*args, **kwargs):
            start_time = time.time()

            try:
                result = await func(*args, **kwargs)
                DATA_SOURCE_REQUESTS_TOTAL.labels(
                    data_source=data_source,
                    endpoint=endpoint,
                    status="success"
                ).inc()
                return result
            except Exception as e:
                DATA_SOURCE_REQUESTS_TOTAL.labels(
                    data_source=data_source,
                    endpoint=endpoint,
                    status="failed"
                ).inc()
                DATA_SOURCE_ERRORS_TOTAL.labels(
                    data_source=data_source,
                    error_type=type(e).__name__
                ).inc()
                raise
            finally:
                duration = time.time() - start_time
                DATA_SOURCE_REQUEST_DURATION.labels(
                    data_source=data_source,
                    endpoint=endpoint
                ).observe(duration)

        return wrapper
    return decorator

# 分布式锁指标装饰器
def track_lock_usage(lock_name: str):
    """
    分布式锁使用指标装饰器
    :param lock_name: 锁名称
    """
    def decorator(func: Callable) -> Callable:
        async def wrapper(*args, **kwargs):
            start_time = time.time()
            acquired = False

            try:
                result = await func(*args, **kwargs)
                acquired = True
                LOCK_ACQUIRE_TOTAL.labels(
                    lock_name=lock_name,
                    result="success"
                ).inc()
                return result
            except Exception as e:
                if not acquired:
                    LOCK_ACQUIRE_TOTAL.labels(
                        lock_name=lock_name,
                        result="failed"
                    ).inc()
                raise
            finally:
                if acquired:
                    duration = time.time() - start_time
                    LOCK_HOLD_DURATION.labels(
                        lock_name=lock_name
                    ).observe(duration)

        return wrapper
    return decorator

# 指标更新辅助函数
def update_sync_task_data_count(task_name: str, data_source: str, count: int):
    """
    更新同步任务数据量指标
    :param task_name: 任务名称
    :param data_source: 数据源名称
    :param count: 同步的记录数
    """
    SYNC_TASK_DATA_COUNT.labels(
        task_name=task_name,
        data_source=data_source
    ).set(count)

def update_sync_task_source_used(task_name: str, data_source: str, used: bool = True):
    """
    更新数据源使用情况指标
    :param task_name: 任务名称
    :param data_source: 数据源名称
    :param used: 是否使用了该数据源
    """
    SYNC_TASK_SOURCE_USED.labels(
        task_name=task_name,
        data_source=data_source
    ).set(1 if used else 0)

def increment_sync_task_source_circuit_break(task_name: str, data_source: str, reason: str):
    """
    增加数据源熔断次数指标
    :param task_name: 任务名称
    :param data_source: 数据源名称
    :param reason: 熔断原因
    """
    SYNC_TASK_SOURCE_CIRCUIT_BREAK.labels(
        task_name=task_name,
        data_source=data_source,
        reason=reason
    ).inc()

def increment_sync_task_validation_failure(task_name: str, validation_type: str, reason: str):
    """
    增加数据验证失败次数指标
    :param task_name: 任务名称
    :param validation_type: 验证类型
    :param reason: 失败原因
    """
    SYNC_TASK_VALIDATION_FAILURE.labels(
        task_name=task_name,
        validation_type=validation_type,
        reason=reason
    ).inc()
