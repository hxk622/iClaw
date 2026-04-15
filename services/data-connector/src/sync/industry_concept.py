from typing import Any, Dict, List, Optional
from src.providers.provider_scheduler import schedule_industry_concept
from src.utils.data_validator import DataValidator
from src.utils.temp_table_manager import TempTableManager
from src.utils.logger import logger


async def sync_industry_concept(dry_run: bool = False) -> Optional[Dict[str, List[Dict[str, Any]]]]:
    """
    同步行业概念关联数据
    :param dry_run: 是否仅拉取数据不写入数据库
    :return: 拉取到的行业概念关联数据
    """
    try:
        logger.info("开始同步行业概念关联数据")

        # 1. 调度数据源获取数据
        result = await schedule_industry_concept()
        data = result['data']
        source = result['source']

        if not data:
            logger.error("未获取到行业概念关联数据")
            return None

        # 2. 数据验证
        if not DataValidator.validate_industry_concept(data):
            logger.error("行业概念关联数据验证失败")
            return None

        # 3. 写入数据库（非 dry_run 模式）
        if not dry_run:
            temp_table_manager = TempTableManager()
            await temp_table_manager.atomic_write_industry_concept(data)
            logger.info(f"行业概念关联数据同步完成，数据源: {source}，行业关联 {len(data['industry_relations'])} 条，概念关联 {len(data['concept_relations'])} 条")
        else:
            logger.info(f"Dry run 模式，行业概念关联数据拉取成功，数据源: {source}，行业关联 {len(data['industry_relations'])} 条，概念关联 {len(data['concept_relations'])} 条")

        return data

    except Exception as e:
        logger.exception("同步行业概念关联数据失败")
        raise
