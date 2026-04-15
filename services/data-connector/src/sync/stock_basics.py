from typing import Any, Dict, List, Optional
from src.providers.provider_scheduler import schedule_stock_basics
from src.utils.data_validator import DataValidator
from src.utils.temp_table_manager import TempTableManager
from src.utils.logger import logger


async def sync_stock_basics(dry_run: bool = False) -> Optional[List[Dict[str, Any]]]:
    """
    同步股票基础信息
    :param dry_run: 是否仅拉取数据不写入数据库
    :return: 拉取到的股票基础信息数据
    """
    try:
        logger.info("开始同步股票基础信息")

        # 1. 调度数据源获取数据
        result = await schedule_stock_basics()
        data = result['data']
        source = result['source']

        if not data:
            logger.error("未获取到股票基础信息数据")
            return None

        # 2. 数据验证
        if not DataValidator.validate_stock_basics(data):
            logger.error("股票基础信息数据验证失败")
            return None

        # 3. 写入数据库（非 dry_run 模式）
        if not dry_run:
            temp_table_manager = TempTableManager()
            await temp_table_manager.atomic_write('stock_basics', data)
            logger.info(f"股票基础信息同步完成，数据源: {source}，共 {len(data)} 条记录")
        else:
            logger.info(f"Dry run 模式，股票基础信息拉取成功，数据源: {source}，共 {len(data)} 条记录")

        return data

    except Exception as e:
        logger.exception("同步股票基础信息失败")
        raise
