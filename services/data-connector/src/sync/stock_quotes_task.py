from typing import Any, Dict, List
from datetime import datetime

from src.sync.base_sync_task import FullSyncTaskBase
from src.providers.provider_scheduler import schedule_stock_quotes
from src.utils.data_validator import DataValidator
from src.utils.logger import logger


class SyncStockQuotesTask(FullSyncTaskBase):
    """股票行情同步任务，与control-plane逻辑100%兼容"""

    def __init__(self):
        super().__init__(
            task_name='sync_stock_quotes',
            data_source='akshare+efinance',
            min_record_threshold=5000,
            table_name='stock_quotes',
            primary_key='stock_code',
            md5_fields=[
                'open', 'high', 'low', 'close', 'volume', 'amount',
                'change', 'change_pct', 'turnover_rate', 'amplitude'
            ]
        )

    async def fetch_data(self) -> Dict[str, Any]:
        """从数据源调度器拉取数据"""
        return await schedule_stock_quotes()

    def validate_record(self, record: Dict[str, Any]) -> bool:
        """单条记录验证"""
        return DataValidator.validate_stock_quotes_record(record)

    def transform_record(self, record: Dict[str, Any]) -> Dict[str, Any]:
        """数据转换，与control-plane逻辑完全一致"""
        return {
            'stock_code': record.get('stock_code'),
            'stock_name': record.get('stock_name'),
            'open': float(record.get('open', 0)) if record.get('open') is not None else 0,
            'high': float(record.get('high', 0)) if record.get('high') is not None else 0,
            'low': float(record.get('low', 0)) if record.get('low') is not None else 0,
            'close': float(record.get('close', 0)) if record.get('close') is not None else 0,
            'pre_close': float(record.get('pre_close', 0)) if record.get('pre_close') is not None else 0,
            'change': float(record.get('change', 0)) if record.get('change') is not None else 0,
            'change_pct': float(record.get('change_pct', 0)) if record.get('change_pct') is not None else 0,
            'volume': int(record.get('volume', 0)) if record.get('volume') is not None else 0,
            'amount': float(record.get('amount', 0)) if record.get('amount') is not None else 0,
            'turnover_rate': float(record.get('turnover_rate', 0)) if record.get('turnover_rate') is not None else 0,
            'amplitude': float(record.get('amplitude', 0)) if record.get('amplitude') is not None else 0,
            'pe_ttm': float(record.get('pe_ttm', 0)) if record.get('pe_ttm') is not None else 0,
            'pb': float(record.get('pb', 0)) if record.get('pb') is not None else 0,
            'market_cap': float(record.get('market_cap', 0)) if record.get('market_cap') is not None else 0,
            'float_cap': float(record.get('float_cap', 0)) if record.get('float_cap') is not None else 0,
            'trade_date': record.get('trade_date'),
            'updated_at': datetime.utcnow()
        }


# 创建单例实例
_sync_stock_quotes_task = SyncStockQuotesTask()


async def sync_stock_quotes(dry_run: bool = False) -> Any:
    """
    对外暴露的同步函数，保持接口兼容
    :param dry_run: 是否仅拉取数据不写入数据库
    :return: 同步结果
    """
    logger.info("开始执行股票行情同步任务")
    result = await _sync_stock_quotes_task.execute(dry_run=dry_run)

    if result.success:
        logger.info(f"股票行情同步完成，共 {result.sync_count} 条记录，数据源: {result.data_source}")
        return {
            'success': True,
            'data': result.data,
            'source': result.data_source,
            'sync_count': result.sync_count,
            'execution_time': result.duration_ms
        }
    else:
        logger.error(f"股票行情同步失败: {result.error}")
        raise Exception(result.error)
