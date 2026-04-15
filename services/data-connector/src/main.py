from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Any, Dict, List, Optional
import time
import asyncio
import uvicorn

from src.config import settings, get_cors_allowed_origins
from src.db import check_db_connection
from src.utils.logger import logger
from src.middleware.metrics import PrometheusMiddleware, metrics_endpoint
from src.utils.concurrency_limiter import start_all_limiters
from src.scheduler import start_scheduler, shutdown_scheduler
from src.sync import (
    sync_stock_basics,
    sync_stock_quotes,
    sync_industry_concept,
    sync_finance_data
)

# Create FastAPI application
app = FastAPI(
    title="Data Connector Service",
    description="Market data sync microservice for iClaw platform",
    version="1.0.0",
    docs_url="/docs" if settings.ENV == "dev" else None,
    redoc_url="/redoc" if settings.ENV == "dev" else None,
)

# Add CORS middleware
allowed_origins = get_cors_allowed_origins()
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add Prometheus metrics middleware
app.add_middleware(PrometheusMiddleware)


# Request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all incoming requests and their response times."""
    start_time = time.time()
    response: Response = await call_next(request)
    process_time = time.time() - start_time

    logger.info(
        f"{request.method} {request.url.path} "
        f"status={response.status_code} "
        f"duration={process_time:.3f}s "
        f"client={request.client.host if request.client else 'unknown'}"
    )

    return response


# Startup event
@app.on_event("startup")
async def startup_event():
    """Run on application startup."""
    logger.info(f"Starting Data Connector Service in {settings.ENV} environment")
    logger.info(f"Listening on {settings.HOST}:{settings.PORT}")

    # Log CORS configuration
    allowed_origins = get_cors_allowed_origins()
    if allowed_origins == ["*"]:
        logger.warning("⚠️ CORS is configured to allow all origins. This is NOT recommended for production environments.")
    else:
        logger.info(f"CORS allowed origins: {', '.join(allowed_origins)}")

    # Start concurrency limiters
    start_all_limiters()

    # Check database connection
    db_connected = await check_db_connection()
    if db_connected:
        logger.info("Database connection established successfully")
    else:
        logger.warning("Database connection failed, service will retry on first request")

    # Start scheduler if enabled
    await start_scheduler()


# Shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    """Run on application shutdown."""
    logger.info("Shutting down Data Connector Service")

    # Shutdown scheduler gracefully
    await shutdown_scheduler()


# Metrics endpoint
app.add_route("/metrics", metrics_endpoint, methods=["GET"], include_in_schema=False)

# Health check endpoint
@app.get("/health", tags=["health"])
async def health_check():
    """Health check endpoint to verify service is running."""
    db_healthy = await check_db_connection()
    return {
        "status": "healthy" if db_healthy else "degraded",
        "service": "data-connector",
        "version": "1.0.0",
        "environment": settings.ENV,
        "database": "connected" if db_healthy else "disconnected",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }


# Request/Response Models
class SyncRequest(BaseModel):
    """同步任务请求模型"""
    dry_run: bool = False  # 是否仅拉取数据不写入数据库


class SyncResponse(BaseModel):
    """同步任务响应模型"""
    success: bool
    message: str
    data: Optional[Any] = None
    count: int = 0
    source: Optional[str] = None
    execution_time: float = 0.0


# Sync endpoints
@app.post("/api/v1/sync/stock-basics", tags=["sync"], response_model=SyncResponse)
async def api_sync_stock_basics(request: SyncRequest):
    """同步股票基础信息"""
    start_time = time.time()
    try:
        data = await sync_stock_basics(dry_run=request.dry_run)
        execution_time = time.time() - start_time

        if data is None:
            return SyncResponse(
                success=False,
                message="股票基础信息同步失败，数据验证未通过或无数据返回",
                execution_time=execution_time
            )

        return SyncResponse(
            success=True,
            message=f"股票基础信息同步成功，共 {len(data)} 条记录",
            data=data,
            count=len(data),
            execution_time=execution_time
        )
    except Exception as e:
        execution_time = time.time() - start_time
        return SyncResponse(
            success=False,
            message=f"股票基础信息同步失败: {str(e)}",
            execution_time=execution_time
        )


@app.post("/api/v1/sync/stock-quotes", tags=["sync"], response_model=SyncResponse)
async def api_sync_stock_quotes(request: SyncRequest):
    """同步股票行情数据"""
    start_time = time.time()
    try:
        data = await sync_stock_quotes(dry_run=request.dry_run)
        execution_time = time.time() - start_time

        if data is None:
            return SyncResponse(
                success=False,
                message="股票行情数据同步失败，数据验证未通过或无数据返回",
                execution_time=execution_time
            )

        return SyncResponse(
            success=True,
            message=f"股票行情数据同步成功，共 {len(data)} 条记录",
            data=data,
            count=len(data),
            execution_time=execution_time
        )
    except Exception as e:
        execution_time = time.time() - start_time
        return SyncResponse(
            success=False,
            message=f"股票行情数据同步失败: {str(e)}",
            execution_time=execution_time
        )


@app.post("/api/v1/sync/industry-concept", tags=["sync"], response_model=SyncResponse)
async def api_sync_industry_concept(request: SyncRequest):
    """同步行业概念关联数据"""
    start_time = time.time()
    try:
        data = await sync_industry_concept(dry_run=request.dry_run)
        execution_time = time.time() - start_time

        if data is None:
            return SyncResponse(
                success=False,
                message="行业概念关联数据同步失败，数据验证未通过或无数据返回",
                execution_time=execution_time
            )

        # 计算总记录数
        industry_count = len(data.get('industry', [])) if isinstance(data, dict) else 0
        concept_count = len(data.get('concept', [])) if isinstance(data, dict) else 0
        total_count = industry_count + concept_count

        return SyncResponse(
            success=True,
            message=f"行业概念关联数据同步成功，行业: {industry_count} 条，概念: {concept_count} 条",
            data=data,
            count=total_count,
            execution_time=execution_time
        )
    except Exception as e:
        execution_time = time.time() - start_time
        return SyncResponse(
            success=False,
            message=f"行业概念关联数据同步失败: {str(e)}",
            execution_time=execution_time
        )


@app.post("/api/v1/sync/finance-data", tags=["sync"], response_model=SyncResponse)
async def api_sync_finance_data(request: SyncRequest):
    """同步财务数据"""
    start_time = time.time()
    try:
        data = await sync_finance_data(dry_run=request.dry_run)
        execution_time = time.time() - start_time

        if data is None:
            return SyncResponse(
                success=False,
                message="财务数据同步失败，数据验证未通过或无数据返回",
                execution_time=execution_time
            )

        return SyncResponse(
            success=True,
            message=f"财务数据同步成功，共 {len(data)} 条记录",
            data=data,
            count=len(data),
            execution_time=execution_time
        )
    except Exception as e:
        execution_time = time.time() - start_time
        return SyncResponse(
            success=False,
            message=f"财务数据同步失败: {str(e)}",
            execution_time=execution_time
        )


def main():
    """Main entry point for the service."""
    uvicorn.run(
        "src.main:app",
        host=settings.HOST,
        port=settings.PORT,
        workers=settings.WORKERS,
        log_level=settings.LOG_LEVEL.lower(),
        reload=settings.ENV == "dev",
    )


if __name__ == "__main__":
    main()
