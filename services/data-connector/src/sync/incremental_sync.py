import time
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy import text
from src.db.session import AsyncSessionLocal
from src.utils.logger import logger
from src.config import settings

class IncrementalSyncManager:
    """增量同步管理器，基于上次同步时间戳和数据哈希实现增量更新"""

    def __init__(self, table_name: str, data_source: str = "unknown"):
        """
        初始化增量同步管理器
        :param table_name: 要同步的数据库表名
        :param data_source: 数据源名称
        """
        self.table_name = table_name
        self.data_source = data_source
        self.sync_history_table = "sync_history"
        self._init_sync_history_table()

    async def _init_sync_history_table(self) -> None:
        """初始化同步历史记录表"""
        async with AsyncSessionLocal() as db:
            try:
                await db.execute(text("""
                    CREATE TABLE IF NOT EXISTS sync_history (
                        id SERIAL PRIMARY KEY,
                        table_name VARCHAR(100) NOT NULL,
                        data_source VARCHAR(100) NOT NULL,
                        last_sync_timestamp TIMESTAMP NOT NULL,
                        last_sync_hash VARCHAR(64),
                        records_processed INTEGER DEFAULT 0,
                        records_added INTEGER DEFAULT 0,
                        records_updated INTEGER DEFAULT 0,
                        records_deleted INTEGER DEFAULT 0,
                        status VARCHAR(20) NOT NULL,
                        error_message TEXT,
                        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(table_name, data_source)
                    )
                """))
                await db.commit()
            except Exception as e:
                logger.error(f"Failed to initialize sync_history table: {str(e)}")
                await db.rollback()
                raise

    async def get_last_sync_info(self) -> Optional[Dict[str, Any]]:
        """
        获取上次同步信息
        :return: 上次同步信息字典，如果不存在则返回None
        """
        async with AsyncSessionLocal() as db:
            try:
                result = await db.execute(text("""
                    SELECT last_sync_timestamp, last_sync_hash, records_processed,
                           records_added, records_updated, records_deleted,
                           status, created_at
                    FROM sync_history
                    WHERE table_name = :table_name AND data_source = :data_source
                """), {
                    "table_name": self.table_name,
                    "data_source": self.data_source
                })

                row = result.mappings().first()
                if row:
                    return dict(row)
                return None
            except Exception as e:
                logger.error(f"Failed to get last sync info: {str(e)}")
                return None

    async def update_sync_history(
        self,
        sync_timestamp: datetime,
        sync_hash: Optional[str] = None,
        records_processed: int = 0,
        records_added: int = 0,
        records_updated: int = 0,
        records_deleted: int = 0,
        status: str = "success",
        error_message: Optional[str] = None
    ) -> None:
        """
        更新同步历史记录
        :param sync_timestamp: 同步时间戳
        :param sync_hash: 同步数据的哈希值
        :param records_processed: 处理的记录总数
        :param records_added: 新增的记录数
        :param records_updated: 更新的记录数
        :param records_deleted: 删除的记录数
        :param status: 同步状态
        :param error_message: 错误信息（如果失败）
        """
        async with AsyncSessionLocal() as db:
            try:
                # 尝试更新现有记录
                result = await db.execute(text("""
                    UPDATE sync_history
                    SET last_sync_timestamp = :last_sync_timestamp,
                        last_sync_hash = :last_sync_hash,
                        records_processed = :records_processed,
                        records_added = :records_added,
                        records_updated = :records_updated,
                        records_deleted = :records_deleted,
                        status = :status,
                        error_message = :error_message,
                        created_at = CURRENT_TIMESTAMP
                    WHERE table_name = :table_name AND data_source = :data_source
                """), {
                    "table_name": self.table_name,
                    "data_source": self.data_source,
                    "last_sync_timestamp": sync_timestamp,
                    "last_sync_hash": sync_hash,
                    "records_processed": records_processed,
                    "records_added": records_added,
                    "records_updated": records_updated,
                    "records_deleted": records_deleted,
                    "status": status,
                    "error_message": error_message
                })

                # 如果没有更新到记录，则插入新记录
                if result.rowcount == 0:
                    await db.execute(text("""
                        INSERT INTO sync_history (
                            table_name, data_source, last_sync_timestamp, last_sync_hash,
                            records_processed, records_added, records_updated, records_deleted,
                            status, error_message
                        ) VALUES (
                            :table_name, :data_source, :last_sync_timestamp, :last_sync_hash,
                            :records_processed, :records_added, :records_updated, :records_deleted,
                            :status, :error_message
                        )
                    """), {
                        "table_name": self.table_name,
                        "data_source": self.data_source,
                        "last_sync_timestamp": sync_timestamp,
                        "last_sync_hash": sync_hash,
                        "records_processed": records_processed,
                        "records_added": records_added,
                        "records_updated": records_updated,
                        "records_deleted": records_deleted,
                        "status": status,
                        "error_message": error_message
                    })

                await db.commit()
                logger.info(
                    f"Sync history updated for {self.table_name} ({self.data_source}): "
                    f"processed={records_processed}, added={records_added}, updated={records_updated}, deleted={records_deleted}"
                )
            except Exception as e:
                logger.error(f"Failed to update sync history: {str(e)}")
                await db.rollback()
                raise

    async def get_incremental_data(
        self,
        all_data: List[Dict[str, Any]],
        primary_key: str = "ts_code",
        hash_fields: Optional[List[str]] = None
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]]]:
        """
        计算增量数据，对比现有数据和新数据，返回需要新增、更新和删除的记录
        :param all_data: 最新的全量数据
        :param primary_key: 主键字段名
        :param hash_fields: 用于计算哈希的字段列表，如果为None则使用所有字段
        :return: (需要新增的记录, 需要更新的记录, 需要删除的记录)
        """
        if not all_data:
            return [], [], []

        # 获取数据库中现有数据
        async with AsyncSessionLocal() as db:
            try:
                result = await db.execute(text(f"""
                    SELECT {primary_key}, {', '.join(hash_fields) if hash_fields else '*'}
                    FROM {self.table_name}
                """))
                existing_records = result.mappings().all()
            except Exception as e:
                logger.error(f"Failed to fetch existing records from {self.table_name}: {str(e)}")
                raise

        # 转换为字典，主键为key
        existing_map = {
            record[primary_key]: dict(record)
            for record in existing_records
        }

        # 计算需要新增和更新的记录
        to_add = []
        to_update = []
        new_keys = set()

        for record in all_data:
            key = record[primary_key]
            new_keys.add(key)

            if key not in existing_map:
                to_add.append(record)
            else:
                # 计算哈希对比是否有变化
                existing_record = existing_map[key]
                if hash_fields:
                    existing_hash = self._calculate_record_hash(existing_record, hash_fields)
                    new_hash = self._calculate_record_hash(record, hash_fields)
                    if existing_hash != new_hash:
                        to_update.append(record)
                else:
                    # 如果没有指定hash字段，直接对比整个记录
                    if existing_record != record:
                        to_update.append(record)

        # 计算需要删除的记录
        to_delete = [
            existing_map[key]
            for key in existing_map
            if key not in new_keys
        ]

        logger.info(
            f"Incremental sync analysis for {self.table_name}: "
            f"add={len(to_add)}, update={len(to_update)}, delete={len(to_delete)}"
        )

        return to_add, to_update, to_delete

    def _calculate_record_hash(self, record: Dict[str, Any], fields: List[str]) -> str:
        """
        计算记录的哈希值
        :param record: 记录字典
        :param fields: 用于计算哈希的字段列表
        :return: 哈希字符串
        """
        import hashlib
        import json

        # 提取指定字段并排序，确保哈希计算的稳定性
        hash_data = {
            field: record[field]
            for field in sorted(fields)
            if field in record
        }

        # 转换为JSON字符串并计算MD5哈希
        json_str = json.dumps(hash_data, sort_keys=True, default=str)
        return hashlib.md5(json_str.encode('utf-8')).hexdigest()

    async def perform_incremental_sync(
        self,
        new_data: List[Dict[str, Any]],
        primary_key: str = "ts_code",
        hash_fields: Optional[List[str]] = None,
        delete_orphans: bool = True
    ) -> Dict[str, int]:
        """
        执行增量同步
        :param new_data: 最新的全量数据
        :param primary_key: 主键字段名
        :param hash_fields: 用于计算哈希的字段列表
        :param delete_orphans: 是否删除不存在于新数据中的旧记录
        :return: 同步统计信息
        """
        sync_start_time = datetime.utcnow()

        try:
            # 计算增量数据
            to_add, to_update, to_delete = await self.get_incremental_data(
                new_data, primary_key, hash_fields
            )

            async with AsyncSessionLocal() as db:
                # 执行插入
                if to_add:
                    columns = list(to_add[0].keys())
                    placeholders = [f":{col}" for col in columns]
                    insert_query = text(f"""
                        INSERT INTO {self.table_name} ({', '.join(columns)})
                        VALUES ({', '.join(placeholders)})
                    """)
                    await db.execute(insert_query, to_add)

                # 执行更新
                if to_update:
                    for record in to_update:
                        update_fields = [
                            f"{col} = :{col}"
                            for col in record.keys()
                            if col != primary_key
                        ]
                        if update_fields:
                            update_query = text(f"""
                                UPDATE {self.table_name}
                                SET {', '.join(update_fields)}
                                WHERE {primary_key} = :{primary_key}
                            """)
                            await db.execute(update_query, record)

                # 执行删除
                if delete_orphans and to_delete:
                    delete_keys = [record[primary_key] for record in to_delete]
                    delete_query = text(f"""
                        DELETE FROM {self.table_name}
                        WHERE {primary_key} IN :keys
                    """)
                    await db.execute(delete_query, {"keys": tuple(delete_keys)})

                await db.commit()

            # 更新同步历史
            stats = {
                "processed": len(new_data),
                "added": len(to_add),
                "updated": len(to_update),
                "deleted": len(to_delete) if delete_orphans else 0
            }

            await self.update_sync_history(
                sync_timestamp=sync_start_time,
                records_processed=stats["processed"],
                records_added=stats["added"],
                records_updated=stats["updated"],
                records_deleted=stats["deleted"],
                status="success"
            )

            return stats

        except Exception as e:
            logger.error(f"Incremental sync failed for {self.table_name}: {str(e)}")
            await self.update_sync_history(
                sync_timestamp=sync_start_time,
                status="failed",
                error_message=str(e)
            )
            raise

    async def should_perform_full_sync(self, max_age_hours: int = 24) -> bool:
        """
        判断是否应该执行全量同步
        :param max_age_hours: 最大允许的增量同步间隔小时数，超过则执行全量同步
        :return: 是否应该执行全量同步
        """
        last_sync_info = await self.get_last_sync_info()

        # 如果没有同步历史，执行全量同步
        if not last_sync_info:
            logger.info(f"No sync history found for {self.table_name}, performing full sync")
            return True

        # 如果上次同步失败，执行全量同步
        if last_sync_info["status"] != "success":
            logger.info(f"Last sync for {self.table_name} failed, performing full sync")
            return True

        # 如果上次同步时间超过最大允许间隔，执行全量同步
        last_sync_time = last_sync_info["last_sync_timestamp"]
        time_since_last_sync = datetime.utcnow() - last_sync_time
        if time_since_last_sync > timedelta(hours=max_age_hours):
            logger.info(
                f"Last sync for {self.table_name} was {time_since_last_sync.total_seconds()/3600:.1f} hours ago, "
                f"exceeding max age of {max_age_hours} hours, performing full sync"
            )
            return True

        return False


async def incremental_sync(
    table_name: str,
    new_data: List[Dict[str, Any]],
    primary_key: str = "ts_code",
    hash_fields: Optional[List[str]] = None,
    data_source: str = "unknown",
    delete_orphans: bool = True
) -> Dict[str, int]:
    """
    便捷的增量同步函数，与control-plane接口兼容
    :param table_name: 要同步的数据库表名
    :param new_data: 最新的全量数据
    :param primary_key: 主键字段名
    :param hash_fields: 用于计算哈希的字段列表
    :param data_source: 数据源名称
    :param delete_orphans: 是否删除不存在于新数据中的旧记录
    :return: 同步统计信息
    """
    sync_manager = IncrementalSyncManager(table_name, data_source)
    return await sync_manager.perform_incremental_sync(
        new_data=new_data,
        primary_key=primary_key,
        hash_fields=hash_fields,
        delete_orphans=delete_orphans
    )
