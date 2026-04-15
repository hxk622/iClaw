from typing import Any, Dict, List
from datetime import datetime

from src.sync.base_sync_task import FullSyncTaskBase
from src.providers.provider_scheduler import schedule_stock_basics
from src.utils.data_validator import DataValidator
from src.utils.logger import logger


class SyncStockBasicsTask(FullSyncTaskBase):
    """股票基础信息同步任务，与control-plane逻辑100%兼容"""

    def __init__(self):
        super().__init__(
            task_name='sync_stock_basics',
            data_source='akshare+efinance',
            min_record_threshold=5000,
            table_name='stock_basics',
            primary_key='stock_code',
            md5_fields=[
                'stock_name', 'exchange', 'company_name', 'main_business',
                'industry', 'region', 'market_cap', 'float_cap',
                'total_shares', 'float_shares', 'pe_ttm', 'pb', 'list_date'
            ]
        )

    async def fetch_data(self) -> Dict[str, Any]:
        """从数据源调度器拉取数据"""
        return await schedule_stock_basics()

    def validate_record(self, record: Dict[str, Any]) -> bool:
        """单条记录验证"""
        return DataValidator.validate_stock_basics_record(record)

    def transform_record(self, record: Dict[str, Any]) -> Dict[str, Any]:
        """数据转换，与control-plane逻辑完全一致"""
        return {
            'stock_code': record.get('stock_code'),
            'stock_name': record.get('stock_name'),
            'exchange': record.get('exchange'),
            'company_name': record.get('company_name'),
            'main_business': record.get('main_business'),
            'industry': record.get('industry'),
            'region': record.get('region'),
            'market_cap': float(record.get('market_cap', 0)) if record.get('market_cap') is not None else 0,
            'float_cap': float(record.get('float_cap', 0)) if record.get('float_cap') is not None else 0,
            'total_shares': float(record.get('total_shares', 0)) if record.get('total_shares') is not None else 0,
            'float_shares': float(record.get('float_shares', 0)) if record.get('float_shares') is not None else 0,
            'pe_ttm': float(record.get('pe_ttm', 0)) if record.get('pe_ttm') is not None else 0,
            'pb': float(record.get('pb', 0)) if record.get('pb') is not None else 0,
            'list_date': record.get('list_date'),
            'updated_at': datetime.utcnow()
        }


# 创建单例实例
_sync_stock_basics_task = SyncStockBasicsTask()


async def sync_stock_basics(dry_run: bool = False) -> Any:
    """
    对外暴露的同步函数，保持接口兼容
    :param dry_run: 是否仅拉取数据不写入数据库
    :return: 同步结果
    """
    logger.info("开始执行股票基础信息同步任务")
    result = await _sync_stock_basics_task.execute(dry_run=dry_run)

    if result.success:
        logger.info(f"股票基础信息同步完成，共 {result.sync_count} 条记录，数据源: {result.data_source}")
        return {
            'success': True,
            'data': result.data,
            'source': result.data_source,
            'sync_count': result.sync_count,
            'execution_time': result.duration_ms
        }
    else:
        logger.error(f"股票基础信息同步失败: {result.error}")
        raise Exception(result.error)
