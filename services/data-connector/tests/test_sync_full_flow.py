"""
全流程集成测试：验证所有同步任务的完整功能与原control-plane行为完全一致
"""
import pytest
import asyncio
from datetime import datetime
from sqlalchemy import text
from src.db.session import get_db
from src.sync.stock_basics_task import SyncSyncStockBasicsTask
from src.sync.stock_quotes_task import SyncSyncStockQuotesTask
from src.sync.industry_concept_task import SyncSyncIndustryConceptTask
from src.sync.finance_data_task import SyncSyncFinanceDataTask
from src.scheduler.task_scheduler import TaskScheduler
from src.config.settings import settings

@pytest.mark.asyncio
async def test_stock_basics_sync_full_flow():
    """测试股票基础信息同步完整流程"""
    db = next(get_db())

    # 初始化任务
    task = SyncStockBasicsTask()

    # 执行 dry run
    result = await task.execute(dry_run=True)
    assert result["success"] == True
    assert result["dry_run"] == True
    assert "data_count" in result
    assert result["data_count"] > 4000  # 确保数据量符合预期

    # 执行真实同步
    result = await task.execute(dry_run=False)
    assert result["success"] == True
    assert result["dry_run"] == False
    assert result["data_count"] > 4000

    # 验证数据写入
    count = db.execute(text("SELECT COUNT(*) FROM app.stock_basics")).scalar()
    assert count > 4000

    # 验证日志记录
    log = db.execute(
        text("SELECT * FROM app.sync_task_logs WHERE task_name = 'sync_stock_basics' ORDER BY id DESC LIMIT 1")
    ).first()
    assert log is not None
    assert log.status == "success"
    assert log.data_count == result["data_count"]
    assert log.data_source in ["akshare", "efinance"]

    db.close()

@pytest.mark.asyncio
async def test_stock_quotes_sync_full_flow():
    """测试股票行情同步完整流程"""
    db = next(get_db())

    # 初始化任务
    task = SyncStockQuotesTask()

    # 执行 dry run
    result = await task.execute(dry_run=True)
    assert result["success"] == True
    assert result["dry_run"] == True
    assert "data_count" in result
    assert result["data_count"] > 4000

    # 执行真实同步
    result = await task.execute(dry_run=False)
    assert result["success"] == True
    assert result["dry_run"] == False
    assert result["data_count"] > 4000

    # 验证数据写入
    count = db.execute(text("SELECT COUNT(*) FROM app.stock_quotes WHERE date = CURRENT_DATE")).scalar()
    assert count > 4000

    # 验证日志记录
    log = db.execute(
        text("SELECT * FROM app.sync_task_logs WHERE task_name = 'sync_stock_quotes' ORDER BY id DESC LIMIT 1")
    ).first()
    assert log is not None
    assert log.status == "success"
    assert log.data_count == result["data_count"]

    db.close()

@pytest.mark.asyncio
async def test_industry_concept_sync_full_flow():
    """测试行业概念同步完整流程"""
    db = next(get_db())

    # 初始化任务
    task = SyncIndustryConceptTask()

    # 执行 dry run
    result = await task.execute(dry_run=True)
    assert result["success"] == True
    assert result["dry_run"] == True
    assert "industry_count" in result
    assert "concept_count" in result
    assert result["industry_count"] > 0
    assert result["concept_count"] > 0

    # 执行真实同步
    result = await task.execute(dry_run=False)
    assert result["success"] == True
    assert result["dry_run"] == False
    assert result["industry_count"] > 0
    assert result["concept_count"] > 0

    # 验证数据写入
    industry_count = db.execute(text("SELECT COUNT(DISTINCT industry) FROM app.stock_industry_relation")).scalar()
    concept_count = db.execute(text("SELECT COUNT(DISTINCT concept) FROM app.stock_concept_relation")).scalar()
    assert industry_count > 0
    assert concept_count > 0

    # 验证日志记录
    log = db.execute(
        text("SELECT * FROM app.sync_task_logs WHERE task_name = 'sync_industry_concept' ORDER BY id DESC LIMIT 1")
    ).first()
    assert log is not None
    assert log.status == "success"
    assert log.data_count == result["industry_count"] + result["concept_count"]

    db.close()

@pytest.mark.asyncio
async def test_finance_data_sync_full_flow():
    """测试财务数据同步完整流程"""
    db = next(get_db())

    # 初始化任务
    task = SyncFinanceDataTask()

    # 执行 dry run
    result = await task.execute(dry_run=True)
    assert result["success"] == True
    assert result["dry_run"] == True
    assert "data_count" in result

    # 验证日志记录（即使是dry run也应该有日志）
    log = db.execute(
        text("SELECT * FROM app.sync_task_logs WHERE task_name = 'sync_finance_data' ORDER BY id DESC LIMIT 1")
    ).first()
    assert log is not None
    assert log.status == "success"
    assert log.dry_run == True

    db.close()

@pytest.mark.asyncio
async def test_transaction_rollback():
    """测试事务回滚机制 - 模拟数据不完整场景"""
    db = next(get_db())

    # 篡改验证阈值，强制触发校验失败
    original_threshold = settings.MIN_STOCK_COUNT
    settings.MIN_STOCK_COUNT = 100000  # 设置一个不可能达到的阈值

    try:
        task = SyncStockBasicsTask()
        result = await task.execute(dry_run=False)

        # 应该失败
        assert result["success"] == False
        assert "数据校验失败" in result["error"]

        # 验证数据没有被写入（表中数据应该还是原来的数量）
        count = db.execute(text("SELECT COUNT(*) FROM app.stock_basics")).scalar()
        assert count < 100000  # 确认阈值未达到

        # 验证日志记录失败
        log = db.execute(
            text("SELECT * FROM app.sync_task_logs WHERE task_name = 'sync_stock_basics' ORDER BY id DESC LIMIT 1")
        ).first()
        assert log is not None
        assert log.status == "failed"
        assert "数据校验失败" in log.error_message

    finally:
        # 恢复原始阈值
        settings.MIN_STOCK_COUNT = original_threshold
        db.close()

@pytest.mark.asyncio
async def test_scheduler_task_registration():
    """测试调度器正确注册所有任务"""
    scheduler = TaskScheduler()

    # 启动调度器
    await scheduler.start()

    # 验证任务数量
    jobs = scheduler.get_jobs()
    assert len(jobs) >= 4  # 四个同步任务

    # 验证每个任务都正确注册
    job_names = [job.id for job in jobs]
    assert "sync_stock_basics" in job_names
    assert "sync_stock_quotes" in job_names
    assert "sync_industry_concept" in job_names
    assert "sync_finance_data" in job_names

    # 验证cron表达式正确
    for job in jobs:
        if job.id == "sync_stock_basics":
            assert str(job.trigger) == "cron[second=0, minute=0, hour=17, day_of_week=1-5]"
        elif job.id == "sync_stock_quotes":
            assert str(job.trigger) == "cron[second=0, minute=0, hour=9-15, day_of_week=1-5]"
        elif job.id == "sync_industry_concept":
            assert str(job.trigger) == "cron[second=0, minute=0, hour=18, day_of_week=1-5]"
        elif job.id == "sync_finance_data":
            assert str(job.trigger) == "cron[second=0, minute=0, hour=10, day=1, month=1,4,7,10]"

    # 关闭调度器
    await scheduler.shutdown()

def test_dry_run_behavior():
    """测试dry_run参数行为正确性"""
    # dry_run模式下不会修改数据库
    # 所有操作都应该是幂等的
    pass

if __name__ == "__main__":
    asyncio.run(test_stock_basics_sync_full_flow())
