"""
性能测试和稳定性验证
"""
import pytest
import asyncio
import time
import psutil
from datetime import datetime
from src.sync.stock_basics_task import SyncSyncStockBasicsTask
from src.sync.stock_quotes_task import SyncSyncStockQuotesTask
from src.sync.industry_concept_task import SyncSyncIndustryConceptTask
from src.scheduler.task_scheduler import TaskScheduler
from src.config.settings import settings

@pytest.mark.performance
@pytest.mark.asyncio
async def test_sync_task_performance():
    """测试同步任务执行时长，与原control-plane对比"""
    # 原control-plane的基准性能：
    # - 股票基础信息同步：< 5分钟
    # - 股票行情同步：< 2分钟
    # - 行业概念同步：< 10分钟

    # 测试股票基础信息
    start_time = time.time()
    task = SyncStockBasicsTask()
    result = await task.execute(dry_run=True)
    duration = time.time() - start_time

    assert result["success"] == True
    assert duration < 300  # 小于5分钟
    print(f"股票基础信息同步耗时: {duration:.2f}秒")

    # 测试股票行情
    start_time = time.time()
    task = SyncStockQuotesTask()
    result = await task.execute(dry_run=True)
    duration = time.time() - start_time

    assert result["success"] == True
    assert duration < 120  # 小于2分钟
    print(f"股票行情同步耗时: {duration:.2f}秒")

    # 测试行业概念
    start_time = time.time()
    task = SyncIndustryConceptTask()
    result = await task.execute(dry_run=True)
    duration = time.time() - start_time

    assert result["success"] == True
    assert duration < 600  # 小于10分钟
    print(f"行业概念同步耗时: {duration:.2f}秒")

@pytest.mark.performance
@pytest.mark.asyncio
async def test_concurrent_task_execution():
    """测试并发执行多个任务的资源占用情况"""
    process = psutil.Process()

    # 记录初始资源占用
    initial_cpu = process.cpu_percent()
    initial_memory = process.memory_info().rss / 1024 / 1024  # MB

    # 并发执行多个任务
    tasks = [
        SyncStockBasicsTask().execute(dry_run=True),
        SyncStockQuotesTask().execute(dry_run=True),
        SyncIndustryConceptTask().execute(dry_run=True)
    ]

    start_time = time.time()
    results = await asyncio.gather(*tasks)
    duration = time.time() - start_time

    # 验证所有任务成功
    for result in results:
        assert result["success"] == True

    # 记录峰值资源占用
    peak_cpu = process.cpu_percent()
    peak_memory = process.memory_info().rss / 1024 / 1024  # MB

    # 资源占用阈值
    assert peak_cpu < 200  # CPU使用率小于200%（2核）
    assert peak_memory < 512  # 内存占用小于512MB

    print(f"并发执行耗时: {duration:.2f}秒")
    print(f"初始CPU: {initial_cpu}%, 峰值CPU: {peak_cpu}%")
    print(f"初始内存: {initial_memory:.2f}MB, 峰值内存: {peak_memory:.2f}MB")

@pytest.mark.stability
@pytest.mark.asyncio
async def test_scheduler_long_running():
    """测试调度器长时间运行的稳定性"""
    scheduler = TaskScheduler()
    await scheduler.start()

    # 运行5分钟，观察调度器是否稳定
    run_duration = 300  # 5分钟
    check_interval = 60  # 每分钟检查一次
    start_time = time.time()

    while time.time() - start_time < run_duration:
        # 检查调度器是否在运行
        assert scheduler.running == True

        # 检查任务数量
        jobs = scheduler.get_jobs()
        assert len(jobs) >= 4

        # 检查内存占用
        process = psutil.Process()
        memory = process.memory_info().rss / 1024 / 1024
        assert memory < 512  # 内存不超过512MB

        await asyncio.sleep(check_interval)

    await scheduler.shutdown()
    print(f"调度器稳定运行{run_duration}秒")

@pytest.mark.stability
@pytest.mark.asyncio
async def test_database_connection_recovery():
    """验证异常恢复能力，模拟数据库中断后自动恢复"""
    from src.db.session import get_db
    from sqlalchemy.exc import OperationalError

    task = SyncStockBasicsTask()

    # 1. 正常执行一次
    result = await task.execute(dry_run=True)
    assert result["success"] == True

    # 2. 模拟数据库连接中断（暂时不实际中断，测试错误处理逻辑）
    # 这里我们测试任务的重试机制
    original_retry_count = settings.MAX_RETRIES
    settings.MAX_RETRIES = 3

    try:
        # 故意使用错误的数据库连接
        original_db_url = settings.DATABASE_URL
        settings.DATABASE_URL = "postgresql://wrong:wrong@localhost:5432/wrong"

        # 执行任务应该失败并重试
        result = await task.execute(dry_run=True)
        assert result["success"] == False
        assert "数据库连接失败" in result["error"]

    finally:
        # 恢复配置
        settings.DATABASE_URL = original_db_url
        settings.MAX_RETRIES = original_retry_count

    # 3. 恢复后应该能正常执行
    result = await task.execute(dry_run=True)
    assert result["success"] == True

    print("数据库连接恢复测试通过")

@pytest.mark.performance
def test_memory_leak():
    """测试内存泄漏情况"""
    process = psutil.Process()

    # 多次执行任务，观察内存增长情况
    memory_usage = []

    for i in range(5):
        # 执行同步任务
        asyncio.run(SyncStockBasicsTask().execute(dry_run=True))

        # 记录内存使用
        memory = process.memory_info().rss / 1024 / 1024
        memory_usage.append(memory)

        print(f"第{i+1}次执行后内存: {memory:.2f}MB")

    # 内存增长不超过10%
    initial_memory = memory_usage[0]
    final_memory = memory_usage[-1]
    memory_growth = (final_memory - initial_memory) / initial_memory * 100

    assert memory_growth < 10, f"内存增长过快: {memory_growth:.2f}%"
    print(f"内存增长控制在{memory_growth:.2f}%，无明显内存泄漏")

if __name__ == "__main__":
    asyncio.run(test_sync_task_performance())
