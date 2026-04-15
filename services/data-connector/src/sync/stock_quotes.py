from typing import Any, Dict, List, Optional
from src.providers.provider_scheduler import schedule_stock_quotes
from src.utils.data_validator import DataValidator
from src.utils.temp_table_manager import TempTableManager
from src.utils.logger import logger
from src.db.session import get_db


async def sync_stock_quotes(dry_run: bool = False) -> Optional[List[Dict[str, Any]]]:
    """
    同步股票行情数据
    :param dry_run: 是否仅拉取数据不写入数据库
    :return: 拉取到的股票行情数据
    """
    try:
        logger.info("开始同步股票行情数据")

        # 1. 调度数据源获取数据
        result = await schedule_stock_quotes()
        data = result['data']
        source = result['source']

        if not data:
            logger.error("未获取到股票行情数据")
            return None

        # 2. 数据验证
        if not DataValidator.validate_stock_quotes(data):
            logger.error("股票行情数据验证失败")
            return None

        # 3. 写入数据库（非 dry_run 模式）
        if not dry_run:
            async for db in get_db():
                temp_table_manager = TempTableManager(db=db)
                await temp_table_manager.atomic_write('stock_quotes', data)
                break
            logger.info(f"股票行情数据同步完成，数据源: {source}，共 {len(data)} 条记录")
        else:
            logger.info(f"Dry run 模式，股票行情数据拉取成功，数据源: {source}，共 {len(data)} 条记录")

        return data

    except Exception as e:
        logger.exception("同步股票行情数据失败")
        raise
