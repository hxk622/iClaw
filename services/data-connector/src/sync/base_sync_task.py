from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, Generic, TypeVar
import asyncio

from src.utils.task_logger import log_task_start, log_task_success, log_task_failed
from src.utils.lock_manager import acquire_task_lock, release_task_lock, renew_task_lock
from src.utils.data_validator import DataValidator
from src.utils.logger import logger
from src.utils.retry_decorator import retry_with_exponential_backoff
from src.utils.concurrency_limiter import global_concurrency_limiter

T = TypeVar('T')


class SyncTaskResult:
    """同步任务结果"""

    def __init__(
        self,
        success: bool,
        sync_count: int = 0,
        changed_count: Optional[int] = None,
        data_source: str = '',
        error: Optional[str] = None,
        duration_ms: int = 0,
        task_id: Optional[int] = None,
        data: Optional[List[Dict[str, Any]]] = None
    ):
        self.success = success
        self.sync_count = sync_count
        self.changed_count = changed_count
        self.data_source = data_source
        self.error = error
        self.duration_ms = duration_ms
        self.task_id = task_id
        self.data = data


class SyncTaskBase(ABC, Generic[T]):
    """
    同步任务基类，完全复用control-plane的逻辑
    包含：分布式锁、任务日志、重试机制、数据校验、事务写入
    """

    def __init__(
        self,
        task_name: str,
        data_source: str,
        min_record_threshold: int,
        max_retries: int = 3,
        initial_retry_delay: int = 1000,
        incremental_sync: bool = False,
        max_concurrency: int = 2,
        md5_fields: Optional[List[str]] = None
    ):
        self.task_name = task_name
        self.data_source = data_source
        self.min_record_threshold = min_record_threshold
        self.max_retries = max_retries
        self.initial_retry_delay = initial_retry_delay
        self.incremental_sync = incremental_sync
        self.max_concurrency = max_concurrency
        self.md5_fields = md5_fields or []

        self.lock_renewal_interval: Optional[asyncio.Task] = None
        self._task_logger = None

        if incremental_sync and not self.md5_fields:
            raise ValueError("md5_fields must be provided for incremental sync")

    async def execute(self, dry_run: bool = False) -> SyncTaskResult:
        """
        执行同步任务的主入口
        :param dry_run: 是否仅拉取数据不写入数据库
        """
        # 启动限流器如果未启动
        if not global_concurrency_limiter._processor_task or global_concurrency_limiter._processor_task.done():
            global_concurrency_limiter.start()

        return await global_concurrency_limiter.submit(
            lambda: self._execute_internal(dry_run=dry_run)
        )

    async def _execute_internal(self, dry_run: bool = False) -> SyncTaskResult:
        """内部执行逻辑"""
        start_time = asyncio.get_event_loop().time()
        task_id: Optional[int] = None
        lock_acquired = False

        try:
            # 1. 获取分布式锁
            lock_acquired = await acquire_task_lock(self.task_name)
            if not lock_acquired:
                logger.info(f"Task {self.task_name} is already running on another instance, skipping")
                return SyncTaskResult(
                    success=False,
                    error='Task is already running on another instance',
                    duration_ms=int((asyncio.get_event_loop().time() - start_time) * 1000)
                )

            # 启动锁自动续约
            self._start_lock_renewal()

            # 2. 记录任务开始
            if not dry_run:
                task_id = await log_task_start(self.task_name)

            # 3. 带重试执行同步逻辑
            result = await self._execute_with_retry(dry_run)

            # 4. 记录成功
            if not dry_run and task_id:
                await log_task_success(task_id, result.sync_count, result.data_source)

            duration_ms = int((asyncio.get_event_loop().time() - start_time) * 1000)
            logger.info(f"Task {self.task_name} completed successfully, duration: {duration_ms}ms, sync count: {result.sync_count}")

            return SyncTaskResult(
                success=True,
                sync_count=result.sync_count,
                changed_count=result.changed_count,
                data_source=result.data_source,
                duration_ms=duration_ms,
                task_id=task_id,
                data=result.data
            )

        except Exception as e:
            duration_ms = int((asyncio.get_event_loop().time() - start_time) * 1000)
            error_msg = str(e)

            logger.error(f"Sync task {self.task_name} failed: {error_msg}")

            if not dry_run and task_id:
                await log_task_failed(task_id, error_msg, 0)

            return SyncTaskResult(
                success=False,
                sync_count=0,
                data_source=self.data_source,
                error=error_msg,
                duration_ms=duration_ms,
                task_id=task_id
            )

        finally:
            # 停止锁续约
            self._stop_lock_renewal()

            # 释放锁
            if lock_acquired:
                await release_task_lock(self.task_name)

    @retry_with_exponential_backoff()
    async def _execute_with_retry(self, dry_run: bool = False) -> SyncTaskResult:
        """带指数退避重试执行"""
        return await self._execute_sync_logic(dry_run)

    async def _execute_sync_logic(self, dry_run: bool = False) -> SyncTaskResult:
        """执行具体的同步逻辑"""
        # 1. 从数据源拉取数据
        logger.info(f"Fetching {self.task_name} data from source: {self.data_source}")
        fetch_result = await self.fetch_data()
        records = fetch_result['data']
        data_source = fetch_result.get('source', self.data_source)
        execution_time = fetch_result.get('execution_time', 0)

        logger.info(f"Fetched {len(records)} {self.task_name} records from {data_source} in {execution_time}ms")

        # 2. 数据完整性校验
        if len(records) < self.min_record_threshold:
            raise ValueError(f"Fetched only {len(records)} records, below threshold {self.min_record_threshold}")

        # 3. 数据质量校验
        validation_result = self.validate_data(records)
        if validation_result.get('invalid_count', 0) > 0:
            invalid_count = validation_result['invalid_count']
            valid_records = validation_result['valid_records']
            logger.info(f"Found {invalid_count} invalid records, using {len(valid_records)} valid ones")
            records = valid_records

        # 4. 数据转换
        transformed_records = [self.transform_record(record) for record in records]

        # 5. 写入数据库（非 dry_run 模式）
        sync_count = len(transformed_records)
        changed_count = None

        if not dry_run:
            write_result = await self.write_to_database(transformed_records)
            sync_count = write_result.get('sync_count', sync_count)
            changed_count = write_result.get('changed_count')

        return SyncTaskResult(
            success=True,
            sync_count=sync_count,
            changed_count=changed_count,
            data_source=data_source,
            data=transformed_records
        )

    @abstractmethod
    async def fetch_data(self) -> Dict[str, Any]:
        """
        拉取数据，由子类实现
        :return: 包含data、source、execution_time的字典
        """
        pass

    def validate_data(self, records: List[T]) -> Dict[str, Any]:
        """
        数据验证，可被子类重写
        :param records: 待验证的记录列表
        :return: 验证结果，包含valid_records、invalid_count、issues
        """
        return DataValidator.validate_dataset(records, self.validate_record)

    def validate_record(self, record: T) -> bool:
        """
        单条记录验证，可被子类重写
        :param record: 待验证的记录
        :return: 是否有效
        """
        return True

    def transform_record(self, record: T) -> Dict[str, Any]:
        """
        数据转换，可被子类重写
        :param record: 原始记录
        :return: 转换后的记录
        """
        return record if isinstance(record, dict) else dict(record)

    @abstractmethod
    async def write_to_database(self, records: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        写入数据库，由子类实现
        :param records: 待写入的记录列表
        :return: 写入结果，包含sync_count、changed_count等
        """
        pass

    def _start_lock_renewal(self) -> None:
        """启动锁自动续约"""
        async def renew_lock_loop():
            while True:
                try:
                    await renew_task_lock(self.task_name)
                except Exception as e:
                    logger.error(f"Failed to renew lock for task {self.task_name}: {e}")
                await asyncio.sleep(10 * 60)  # 每10分钟续约一次，锁过期时间是30分钟

        self.lock_renewal_interval = asyncio.create_task(renew_lock_loop())

    def _stop_lock_renewal(self) -> None:
        """停止锁续约"""
        if self.lock_renewal_interval:
            self.lock_renewal_interval.cancel()
            self.lock_renewal_interval = None


class FullSyncTaskBase(SyncTaskBase[T]):
    """
    全量同步任务基类
    使用临时表 + 原子交换实现事务写入
    """

    def __init__(
        self,
        task_name: str,
        data_source: str,
        min_record_threshold: int,
        table_name: str,
        primary_key: str = 'id',
        **kwargs
    ):
        super().__init__(
            task_name=task_name,
            data_source=data_source,
            min_record_threshold=min_record_threshold,
            incremental_sync=False,
            **kwargs
        )
        self.table_name = table_name
        self.primary_key = primary_key

    async def write_to_database(self, records: List[Dict[str, Any]]) -> Dict[str, Any]:
        """全量写入数据库，使用临时表原子交换"""
        from src.utils.temp_table_manager import TempTableManager

        temp_table_manager = TempTableManager()
        await temp_table_manager.atomic_write(self.table_name, records)

        return {
            'sync_count': len(records),
            'changed_count': len(records)  # 全量同步所有记录都视为变更
        }


class IncrementalSyncTaskBase(SyncTaskBase[T]):
    """
    增量同步任务基类
    使用MD5校验实现增量更新
    """

    def __init__(
        self,
        task_name: str,
        data_source: str,
        min_record_threshold: int,
        table_name: str,
        primary_key: str = 'id',
        md5_fields: List[str] = None,
        **kwargs
    ):
        super().__init__(
            task_name=task_name,
            data_source=data_source,
            min_record_threshold=min_record_threshold,
            incremental_sync=True,
            md5_fields=md5_fields,
            **kwargs
        )
        self.table_name = table_name
        self.primary_key = primary_key

        if not md5_fields:
            raise ValueError("md5_fields must be provided for incremental sync")

    async def write_to_database(self, records: List[Dict[str, Any]]) -> Dict[str, Any]:
        """增量写入数据库，基于MD5校验"""
        from src.sync.incremental_sync import incremental_sync

        result = await incremental_sync(
            table_name=self.table_name,
            primary_key=self.primary_key,
            md5_fields=self.md5_fields,
            records=records
        )

        return {
            'sync_count': result['total_processed'],
            'changed_count': result['total_changed']
        }
