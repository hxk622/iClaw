from typing import Any, Dict, List
from datetime import datetime

from src.sync.base_sync_task import FullSyncTaskBase
from src.providers.provider_scheduler import schedule_finance_data
from src.utils.data_validator import DataValidator
from src.utils.logger import logger


class SyncFinanceDataTask(FullSyncTaskBase):
    """财务数据同步任务，与control-plane逻辑100%兼容"""

    def __init__(self):
        super().__init__(
            task_name='sync_finance_data',
            data_source='akshare+efinance',
            min_record_threshold=4000,
            table_name='stock_finance',
            primary_key='stock_code',
            md5_fields=[
                'revenue', 'profit', 'net_profit', 'eps', 'roe',
                'gross_margin', 'net_margin', 'total_assets', 'total_liabilities'
            ]
        )

    async def fetch_data(self) -> Dict[str, Any]:
        """从数据源调度器拉取数据"""
        return await schedule_finance_data()

    def validate_record(self, record: Dict[str, Any]) -> bool:
        """单条记录验证"""
        return DataValidator.validate_finance_data_record(record)

    def transform_record(self, record: Dict[str, Any]) -> Dict[str, Any]:
        """数据转换，与control-plane逻辑完全一致"""
        return {
            'stock_code': record.get('stock_code'),
            'report_period': record.get('report_period'),
            'revenue': float(record.get('revenue', 0)) if record.get('revenue') is not None else 0,
            'profit': float(record.get('profit', 0)) if record.get('profit') is not None else 0,
            'net_profit': float(record.get('net_profit', 0)) if record.get('net_profit') is not None else 0,
            'eps': float(record.get('eps', 0)) if record.get('eps') is not None else 0,
            'roe': float(record.get('roe', 0)) if record.get('roe') is not None else 0,
            'gross_margin': float(record.get('gross_margin', 0)) if record.get('gross_margin') is not None else 0,
            'net_margin': float(record.get('net_margin', 0)) if record.get('net_margin') is not None else 0,
            'total_assets': float(record.get('total_assets', 0)) if record.get('total_assets') is not None else 0,
            'total_liabilities': float(record.get('total_liabilities', 0)) if record.get('total_liabilities') is not None else 0,
            'equity': float(record.get('equity', 0)) if record.get('equity') is not None else 0,
            'cash_flow': float(record.get('cash_flow', 0)) if record.get('cash_flow') is not None else 0,
            'updated_at': datetime.utcnow()
        }


# 创建单例实例
_sync_finance_data_task = SyncFinanceDataTask()


async def sync_finance_data(dry_run: bool = False) -> Any:
    """
    对外暴露的同步函数，保持接口兼容
    :param dry_run: 是否仅拉取数据不写入数据库
    :return: 同步结果
    """
    logger.info("开始执行财务数据同步任务")
    result = await _sync_finance_data_task.execute(dry_run=dry_run)

    if result.success:
        logger.info(f"财务数据同步完成，共 {result.sync_count} 条记录，数据源: {result.data_source}")
        return {
            'success': True,
            'data': result.data,
            'source': result.data_source,
            'sync_count': result.sync_count,
            'execution_time': result.duration_ms
        }
    else:
        logger.error(f"财务数据同步失败: {result.error}")
        raise Exception(result.error)
