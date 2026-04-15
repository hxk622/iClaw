from typing import Any, Dict, List, Optional
import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.session import get_db
from src.utils.logger import logger


class TempTableManager:
    """临时表管理器，实现原子写入功能"""

    def __init__(self, db: Optional[AsyncSession] = None):
        self.db = db or next(get_db())
        self.temp_table_suffix = "_temp"

    async def _create_temp_table(self, base_table_name: str, temp_table_name: str) -> None:
        """创建临时表，结构与基础表一致"""
        try:
            # 检查基础表是否存在
            check_table_sql = f"""
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = :table_name
                )
            """
            result = await self.db.execute(text(check_table_sql), {"table_name": base_table_name})
            if not result.scalar():
                raise Exception(f"基础表 {base_table_name} 不存在")

            # 创建临时表，结构与基础表相同
            create_temp_sql = f"CREATE TABLE {temp_table_name} (LIKE {base_table_name} INCLUDING ALL)"
            await self.db.execute(text(create_temp_sql))
            await self.db.commit()
            logger.info(f"创建临时表 {temp_table_name} 成功")

        except Exception as e:
            await self.db.rollback()
            logger.error(f"创建临时表 {temp_table_name} 失败: {e}")
            raise

    async def _insert_data_to_temp(self, temp_table_name: str, data: List[Dict[str, Any]], batch_size: int = 1000) -> None:
        """批量插入数据到临时表"""
        if not data:
            logger.warning(f"没有数据需要插入到临时表 {temp_table_name}")
            return

        try:
            # 获取字段列表
            fields = list(data[0].keys())
            fields_str = ", ".join(fields)
            placeholders = ", ".join([f":{field}" for field in fields])

            # 批量插入
            total_inserted = 0
            for i in range(0, len(data), batch_size):
                batch = data[i:i + batch_size]
                insert_sql = f"INSERT INTO {temp_table_name} ({fields_str}) VALUES ({placeholders})"
                result = await self.db.execute(text(insert_sql), batch)
                total_inserted += result.rowcount

            await self.db.commit()
            logger.info(f"插入数据到临时表 {temp_table_name} 成功，共 {total_inserted} 条")

        except Exception as e:
            await self.db.rollback()
            logger.error(f"插入数据到临时表 {temp_table_name} 失败: {e}")
            raise

    async def _swap_tables(self, base_table_name: str, temp_table_name: str) -> None:
        """原子交换临时表和基础表"""
        try:
            # 开启事务
            async with self.db.begin():
                # 重命名原表为备份
                backup_table_name = f"{base_table_name}_backup"
                await self.db.execute(text(f"DROP TABLE IF EXISTS {backup_table_name}"))
                await self.db.execute(text(f"ALTER TABLE {base_table_name} RENAME TO {backup_table_name}"))

                # 重命名临时表为正式表
                await self.db.execute(text(f"ALTER TABLE {temp_table_name} RENAME TO {base_table_name}"))

            logger.info(f"原子交换表成功，{base_table_name} 已更新")

        except Exception as e:
            await self.db.rollback()
            # 尝试回滚操作
            try:
                backup_table_name = f"{base_table_name}_backup"
                check_backup_sql = f"""
                    SELECT EXISTS (
                        SELECT 1 FROM information_schema.tables
                        WHERE table_schema = 'public' AND table_name = :table_name
                    )
                """
                result = await self.db.execute(text(check_backup_sql), {"table_name": backup_table_name})
                if result.scalar():
                    # 恢复原表
                    await self.db.execute(text(f"DROP TABLE IF EXISTS {base_table_name}"))
                    await self.db.execute(text(f"ALTER TABLE {backup_table_name} RENAME TO {base_table_name}"))
                    logger.info(f"回滚成功，{base_table_name} 已恢复")
            except Exception as rollback_e:
                logger.error(f"回滚失败: {rollback_e}")

            logger.error(f"交换表失败: {e}")
            raise

    async def atomic_write(self, base_table_name: str, data: List[Dict[str, Any]]) -> None:
        """
        原子写入数据到指定表
        使用临时表 + 表重命名的方式实现原子性，避免脏数据
        """
        temp_table_name = f"{base_table_name}{self.temp_table_suffix}"

        try:
            # 1. 创建临时表
            await self._create_temp_table(base_table_name, temp_table_name)

            # 2. 插入数据到临时表
            await self._insert_data_to_temp(temp_table_name, data)

            # 3. 原子交换表
            await self._swap_tables(base_table_name, temp_table_name)

            logger.info(f"原子写入 {base_table_name} 成功，共 {len(data)} 条记录")

        except Exception as e:
            # 清理临时表
            try:
                await self.db.execute(text(f"DROP TABLE IF EXISTS {temp_table_name}"))
                await self.db.commit()
            except Exception as cleanup_e:
                logger.error(f"清理临时表失败: {cleanup_e}")

            logger.error(f"原子写入 {base_table_name} 失败: {e}")
            raise

    async def atomic_write_industry_concept(self, data: Dict[str, List[Dict[str, Any]]]) -> None:
        """原子写入行业和概念关联数据"""
        try:
            # 写入行业关联
            industry_data = data.get('industry_relations', [])
            if industry_data:
                await self.atomic_write('stock_industry_relation', industry_data)

            # 写入概念关联
            concept_data = data.get('concept_relations', [])
            if concept_data:
                await self.atomic_write('stock_concept_relation', concept_data)

            logger.info("行业概念关联数据原子写入完成")

        except Exception as e:
            logger.error(f"行业概念关联数据原子写入失败: {e}")
            raise
