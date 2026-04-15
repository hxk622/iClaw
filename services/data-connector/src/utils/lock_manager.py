import uuid
import time
import asyncio
from typing import Optional, Dict, Any, AsyncGenerator
from contextlib import asynccontextmanager
from sqlalchemy import text
from src.db.session import AsyncSessionLocal
from src.utils.logger import logger

# 生成唯一的实例ID
INSTANCE_ID = str(uuid.uuid4())
# 默认锁过期时间：30分钟
DEFAULT_LOCK_TTL = 30 * 60  # 秒

class LockManager:
    def __init__(self):
        # 初始化表在第一次使用时进行，避免导入时的数据库连接
        self._table_initialized = False

    async def _init_lock_table(self) -> None:
        """初始化任务锁表"""
        if self._table_initialized:
            return

        async with AsyncSessionLocal() as db:
            try:
                await db.execute(text("""
                    CREATE TABLE IF NOT EXISTS sync_task_locks (
                        id SERIAL PRIMARY KEY,
                        task_name VARCHAR(100) NOT NULL UNIQUE,
                        locked_by VARCHAR(100) NOT NULL,
                        locked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        expires_at TIMESTAMP NOT NULL
                    )
                """))
                await db.commit()
                logger.info("Sync task lock table initialized")
                self._table_initialized = True
            except Exception as e:
                logger.error(f"Failed to initialize lock table: {str(e)}")
                await db.rollback()
                raise

    async def acquire_lock(self, task_name: str, ttl: int = DEFAULT_LOCK_TTL) -> bool:
        """
        尝试获取任务锁
        :param task_name: 任务名称
        :param ttl: 锁过期时间（秒），默认30分钟
        :return: 是否获取成功
        """
        await self._init_lock_table()

        async with AsyncSessionLocal() as db:
            now = time.time()
            expires_at = now + ttl

            try:
                # 首先尝试删除已过期的锁
                await db.execute(text("""
                    DELETE FROM sync_task_locks
                    WHERE task_name = :task_name AND expires_at < to_timestamp(:now)
                """), {"task_name": task_name, "now": now})

                # 尝试插入新锁
                result = await db.execute(text("""
                    INSERT INTO sync_task_locks (task_name, locked_by, locked_at, expires_at)
                    VALUES (:task_name, :locked_by, to_timestamp(:locked_at), to_timestamp(:expires_at))
                    ON CONFLICT (task_name) DO NOTHING
                    RETURNING id
                """), {
                    "task_name": task_name,
                    "locked_by": INSTANCE_ID,
                    "locked_at": now,
                    "expires_at": expires_at
                })

                acquired = result.rowcount > 0
                if acquired:
                    logger.info(f"[lock-manager] Acquired lock for task {task_name}, instance: {INSTANCE_ID}")
                else:
                    logger.info(f"[lock-manager] Failed to acquire lock for task {task_name}, already held by another instance")

                await db.commit()
                return acquired
            except Exception as e:
                logger.error(f"[lock-manager] Error acquiring lock for task {task_name}: {str(e)}")
                await db.rollback()
                return False

    async def release_lock(self, task_name: str) -> bool:
        """
        释放任务锁
        :param task_name: 任务名称
        :return: 是否释放成功
        """
        await self._init_lock_table()

        async with AsyncSessionLocal() as db:
            try:
                result = await db.execute(text("""
                    DELETE FROM sync_task_locks
                    WHERE task_name = :task_name AND locked_by = :locked_by
                """), {"task_name": task_name, "locked_by": INSTANCE_ID})

                released = result.rowcount > 0
                if released:
                    logger.info(f"[lock-manager] Released lock for task {task_name}, instance: {INSTANCE_ID}")

                await db.commit()
                return released
            except Exception as e:
                logger.error(f"[lock-manager] Error releasing lock for task {task_name}: {str(e)}")
                await db.rollback()
                return False

    async def renew_lock(self, task_name: str, ttl: int = DEFAULT_LOCK_TTL) -> bool:
        """
        续约任务锁，延长过期时间
        :param task_name: 任务名称
        :param ttl: 新的过期时长（秒）
        :return: 是否续约成功
        """
        await self._init_lock_table()

        async with AsyncSessionLocal() as db:
            now = time.time()
            expires_at = now + ttl

            try:
                result = await db.execute(text("""
                    UPDATE sync_task_locks
                    SET expires_at = to_timestamp(:expires_at)
                    WHERE task_name = :task_name AND locked_by = :locked_by
                """), {
                    "expires_at": expires_at,
                    "task_name": task_name,
                    "locked_by": INSTANCE_ID
                })

                renewed = result.rowcount > 0
                if renewed:
                    logger.info(f"[lock-manager] Renewed lock for task {task_name}, instance: {INSTANCE_ID}")

                await db.commit()
                return renewed
            except Exception as e:
                logger.error(f"[lock-manager] Error renewing lock for task {task_name}: {str(e)}")
                await db.rollback()
                return False

    async def get_lock_info(self, task_name: str) -> Optional[Dict[str, Any]]:
        """
        检查任务是否已被锁定
        :param task_name: 任务名称
        :return: 锁信息，如果未锁定则返回None
        """
        await self._init_lock_table()

        async with AsyncSessionLocal() as db:
            now = time.time()

            try:
                result = await db.execute(text("""
                    SELECT id, task_name, locked_by, locked_at, expires_at
                    FROM sync_task_locks
                    WHERE task_name = :task_name AND expires_at > to_timestamp(:now)
                """), {"task_name": task_name, "now": now})

                row = result.mappings().first()
                if not row:
                    return None

                return dict(row)
            except Exception as e:
                logger.error(f"[lock-manager] Error getting lock for task {task_name}: {str(e)}")
                return None

    @asynccontextmanager
    async def lock(self, task_name: str, ttl: int = DEFAULT_LOCK_TTL, auto_renew: bool = True) -> AsyncGenerator[None, None]:
        """
        异步上下文管理器，自动获取和释放锁
        :param task_name: 任务名称
        :param ttl: 锁过期时间（秒）
        :param auto_renew: 是否自动续约锁
        """
        acquired = await self.acquire_lock(task_name, ttl)
        if not acquired:
            raise RuntimeError(f"Failed to acquire lock for task {task_name}")

        renew_task = None
        try:
            if auto_renew:
                # 启动后台协程自动续约
                async def renew_worker():
                    while True:
                        await asyncio.sleep(ttl // 2)
                        if not await self.renew_lock(task_name, ttl):
                            break

                renew_task = asyncio.create_task(renew_worker())

            yield
        finally:
            if renew_task:
                # 停止续约协程
                renew_task.cancel()
                try:
                    await renew_task
                except asyncio.CancelledError:
                    pass
            await self.release_lock(task_name)

# 全局实例
lock_manager = LockManager()

# 导出便捷函数，与control-plane接口兼容
async def acquire_task_lock(task_name: str, ttl: int = DEFAULT_LOCK_TTL) -> bool:
    return await lock_manager.acquire_lock(task_name, ttl)

async def release_task_lock(task_name: str) -> bool:
    return await lock_manager.release_lock(task_name)

async def renew_task_lock(task_name: str, ttl: int = DEFAULT_LOCK_TTL) -> bool:
    return await lock_manager.renew_lock(task_name, ttl)
