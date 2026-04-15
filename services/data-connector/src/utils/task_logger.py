from datetime import datetime
from typing import Optional
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.session import get_db
from src.models.sync_task_log import SyncTaskLog
from src.utils.logger import logger


class TaskLogger:
    """任务日志记录器，与control-plane格式完全兼容"""

    def __init__(self, db: Optional[AsyncSession] = None):
        self.db = db or next(get_db())

    async def log_task_start(self, task_name: str) -> int:
        """
        记录任务开始
        :param task_name: 任务名称
        :return: 任务日志ID
        """
        try:
            task_log = SyncTaskLog(
                task_name=task_name,
                status='running',
                start_time=datetime.utcnow()
            )
            self.db.add(task_log)
            await self.db.commit()
            await self.db.refresh(task_log)

            logger.info(f"[sync-task] {task_name} started, log id: {task_log.id}")
            return task_log.id

        except Exception as e:
            await self.db.rollback()
            logger.error(f"记录任务开始日志失败: {e}")
            raise

    async def log_task_success(self, task_id: int, sync_count: int = 0, data_source: str = '') -> None:
        """
        记录任务成功
        :param task_id: 任务日志ID
        :param sync_count: 同步记录数量
        :param data_source: 数据源名称
        """
        try:
            stmt = (
                update(SyncTaskLog)
                .where(SyncTaskLog.id == task_id)
                .values(
                    status='success',
                    end_time=datetime.utcnow(),
                    sync_count=sync_count,
                    data_source=data_source
                )
            )
            await self.db.execute(stmt)
            await self.db.commit()

            logger.info(f"[sync-task] task {task_id} succeeded, sync count: {sync_count}, data source: {data_source}")

        except Exception as e:
            await self.db.rollback()
            logger.error(f"记录任务成功日志失败: {e}")
            raise

    async def log_task_failed(self, task_id: int, error_message: str, sync_count: int = 0) -> None:
        """
        记录任务失败
        :param task_id: 任务日志ID
        :param error_message: 错误信息
        :param sync_count: 同步记录数量
        """
        try:
            stmt = (
                update(SyncTaskLog)
                .where(SyncTaskLog.id == task_id)
                .values(
                    status='failed',
                    end_time=datetime.utcnow(),
                    sync_count=sync_count,
                    error_message=error_message
                )
            )
            await self.db.execute(stmt)
            await self.db.commit()

            logger.error(f"[sync-task] task {task_id} failed: {error_message}")

        except Exception as e:
            await self.db.rollback()
            logger.error(f"记录任务失败日志失败: {e}")
            raise


# 全局单例实例
_task_logger_instance: Optional[TaskLogger] = None


def get_task_logger() -> TaskLogger:
    """获取任务日志记录器单例"""
    global _task_logger_instance
    if _task_logger_instance is None:
        _task_logger_instance = TaskLogger()
    return _task_logger_instance


# 导出便捷函数
async def log_task_start(task_name: str) -> int:
    return await get_task_logger().log_task_start(task_name)


async def log_task_success(task_id: int, sync_count: int = 0, data_source: str = '') -> None:
    await get_task_logger().log_task_success(task_id, sync_count, data_source)


async def log_task_failed(task_id: int, error_message: str, sync_count: int = 0) -> None:
    await get_task_logger().log_task_failed(task_id, error_message, sync_count)
