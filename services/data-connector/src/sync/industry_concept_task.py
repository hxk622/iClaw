from typing import Any, Dict, List
from datetime import datetime

from src.sync.base_sync_task import SyncTaskBase, SyncTaskResult
from src.providers.provider_scheduler import schedule_industry_concept
from src.utils.data_validator import DataValidator
from src.utils.temp_table_manager import TempTableManager
from src.utils.logger import logger


class SyncIndustryConceptTask(SyncTaskBase):
    """行业概念关联同步任务，与control-plane逻辑100%兼容"""

    def __init__(self):
        super().__init__(
            task_name='sync_industry_concept',
            data_source='akshare+efinance',
            min_record_threshold=10000,  # 行业+概念关联记录总数
            incremental_sync=False
        )

    async def fetch_data(self) -> Dict[str, Any]:
        """从数据源调度器拉取数据"""
        return await schedule_industry_concept()

    def validate_record(self, record: Dict[str, Any]) -> bool:
        """单条记录验证"""
        # 行业关联记录验证
        if 'stock_code' in record and 'industry_code' in record:
            return DataValidator.validate_industry_relation_record(record)
        # 概念关联记录验证
        elif 'stock_code' in record and 'concept_code' in record:
            return DataValidator.validate_concept_relation_record(record)
        return False

    def transform_record(self, record: Dict[str, Any]) -> Dict[str, Any]:
        """数据转换，与control-plane逻辑完全一致"""
        transformed = record.copy()
        transformed['updated_at'] = datetime.utcnow()
        return transformed

    async def write_to_database(self, records: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        写入数据库，特殊处理：行业和概念是两个独立的表
        :param records: 数据结构为 {'industry_relations': [...], 'concept_relations': [...]}
        """
        # 特殊处理：fetch_data返回的data已经是包含两个表数据的字典
        temp_table_manager = TempTableManager()
        await temp_table_manager.atomic_write_industry_concept(records)

        industry_count = len(records.get('industry_relations', []))
        concept_count = len(records.get('concept_relations', []))
        total_count = industry_count + concept_count

        return {
            'sync_count': total_count,
            'changed_count': total_count,
            'industry_count': industry_count,
            'concept_count': concept_count
        }

    async def _execute_sync_logic(self, dry_run: bool = False) -> SyncTaskResult:
        """重写同步逻辑，处理特殊的返回数据结构"""
        # 1. 从数据源拉取数据
        logger.info(f"Fetching {self.task_name} data from source: {self.data_source}")
        fetch_result = await self.fetch_data()
        data = fetch_result['data']
        data_source = fetch_result.get('source', self.data_source)
        execution_time = fetch_result.get('execution_time', 0)

        # 计算总记录数
        industry_count = len(data.get('industry_relations', []))
        concept_count = len(data.get('concept_relations', []))
        total_records = industry_count + concept_count

        logger.info(f"Fetched {total_records} {self.task_name} records from {data_source} in {execution_time}ms")
        logger.info(f"  - 行业关联: {industry_count} 条")
        logger.info(f"  - 概念关联: {concept_count} 条")

        # 2. 数据完整性校验
        if total_records < self.min_record_threshold:
            raise ValueError(f"Fetched only {total_records} records, below threshold {self.min_record_threshold}")

        # 3. 数据质量校验
        # 验证行业关联
        industry_valid = []
        industry_invalid = 0
        for record in data.get('industry_relations', []):
            if self.validate_record(record):
                industry_valid.append(self.transform_record(record))
            else:
                industry_invalid += 1

        # 验证概念关联
        concept_valid = []
        concept_invalid = 0
        for record in data.get('concept_relations', []):
            if self.validate_record(record):
                concept_valid.append(self.transform_record(record))
            else:
                concept_invalid += 1

        total_invalid = industry_invalid + concept_invalid
        if total_invalid > 0:
            logger.info(f"Found {total_invalid} invalid records:")
            logger.info(f"  - 行业关联: {industry_invalid} 条无效")
            logger.info(f"  - 概念关联: {concept_invalid} 条无效")

        # 构造验证后的数据
        validated_data = {
            'industry_relations': industry_valid,
            'concept_relations': concept_valid
        }
        total_valid = len(industry_valid) + len(concept_valid)

        # 4. 写入数据库（非 dry_run 模式）
        sync_count = total_valid
        changed_count = total_valid

        if not dry_run:
            write_result = await self.write_to_database(validated_data)
            sync_count = write_result.get('sync_count', sync_count)
            changed_count = write_result.get('changed_count', changed_count)

        return SyncTaskResult(
            success=True,
            sync_count=sync_count,
            changed_count=changed_count,
            data_source=data_source,
            data=validated_data
        )


# 创建单例实例
_sync_industry_concept_task = SyncIndustryConceptTask()


async def sync_industry_concept(dry_run: bool = False) -> Any:
    """
    对外暴露的同步函数，保持接口兼容
    :param dry_run: 是否仅拉取数据不写入数据库
    :return: 同步结果
    """
    logger.info("开始执行行业概念关联同步任务")
    result = await _sync_industry_concept_task.execute(dry_run=dry_run)

    if result.success:
        logger.info(f"行业概念关联同步完成，共 {result.sync_count} 条记录，数据源: {result.data_source}")
        return {
            'success': True,
            'data': result.data,
            'source': result.data_source,
            'sync_count': result.sync_count,
            'execution_time': result.duration_ms
        }
    else:
        logger.error(f"行业概念关联同步失败: {result.error}")
        raise Exception(result.error)
