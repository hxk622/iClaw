import sys
import time
import traceback
from typing import Any, Dict, List, Optional, Type
from datetime import datetime, timedelta

from .base_provider import BaseProvider
from .akshare_provider import AKShareProvider
from .efinance_provider import EfinanceProvider
from src.config.settings import settings
from src.utils.logger import logger

# 熔断配置：连续失败3次熔断10分钟
FUSE_CONFIG = {
    'max_fail_count': 3,
    'fuse_duration': 10 * 60,  # 10分钟，单位秒
}

# 内存熔断状态存储
fuses: Dict[str, Dict[str, Any]] = {}
fuses_loaded = False


async def load_fuses_from_db():
    """从数据库加载熔断状态"""
    global fuses_loaded
    if fuses_loaded:
        return

    try:
        from src.db.session import get_db
        db = next(get_db())

        # TODO: 实现从数据库加载熔断状态
        # 暂时使用内存存储
        logger.info("使用内存熔断状态存储")
        fuses_loaded = True

    except Exception as e:
        logger.error(f"加载熔断状态失败: {e}")
        # 加载失败时使用内存默认值
        fuses_loaded = True


async def save_fuse_to_db(name: str, fuse: Dict[str, Any]):
    """保存熔断状态到数据库"""
    try:
        from src.db.session import get_db
        db = next(get_db())

        # TODO: 实现保存熔断状态到数据库
        # 暂时仅保存在内存
        pass

    except Exception as e:
        logger.error(f"保存熔断状态失败: {e}")


async def init_fuse(name: str):
    """初始化熔断状态"""
    await load_fuses_from_db()

    if name not in fuses:
        fuse = {
            'fail_count': 0,
            'last_fail_time': None,
            'is_fused': False,
        }
        fuses[name] = fuse
        await save_fuse_to_db(name, fuse)


async def mark_success(name: str):
    """标记数据源执行成功，重置熔断状态"""
    await load_fuses_from_db()
    fuse = fuses.get(name)
    if fuse:
        fuse['fail_count'] = 0
        fuse['is_fused'] = False
        fuse['last_fail_time'] = None
        await save_fuse_to_db(name, fuse)


async def mark_fail(name: str):
    """标记数据源执行失败，更新熔断状态"""
    await load_fuses_from_db()
    fuse = fuses.get(name)
    if fuse:
        fuse['fail_count'] += 1
        fuse['last_fail_time'] = time.time()
        if fuse['fail_count'] >= FUSE_CONFIG['max_fail_count']:
            fuse['is_fused'] = True
            logger.warning(f"数据源 {name} 熔断 {FUSE_CONFIG['fuse_duration']/60} 分钟，连续失败 {fuse['fail_count']} 次")
        await save_fuse_to_db(name, fuse)


async def is_fused(name: str) -> bool:
    """检查数据源是否被熔断"""
    await load_fuses_from_db()
    fuse = fuses.get(name)
    if not fuse or not fuse['is_fused']:
        return False
    if not fuse['last_fail_time']:
        return False

    # 熔断时间到了，自动恢复
    if time.time() - fuse['last_fail_time'] > FUSE_CONFIG['fuse_duration']:
        fuse['is_fused'] = False
        fuse['fail_count'] = 0
        await save_fuse_to_db(name, fuse)
        logger.info(f"数据源 {name} 从熔断中恢复")
        return False
    return True


# 可用的数据源列表
PROVIDER_CLASSES: List[Type[BaseProvider]] = [
    AKShareProvider,
    EfinanceProvider,
]


def get_providers() -> List[BaseProvider]:
    """获取所有已启用的数据源实例，按优先级排序"""
    providers = []
    for provider_class in PROVIDER_CLASSES:
        try:
            provider = provider_class()
            if provider.enabled:
                providers.append(provider)
        except Exception as e:
            logger.error(f"初始化数据源 {provider_class.__name__} 失败: {e}")
            continue

    # 按优先级排序
    providers.sort(key=lambda p: p.priority)
    return providers


async def schedule_stock_basics() -> Dict[str, Any]:
    """调度数据源获取股票基础信息，自动降级和熔断"""
    providers = get_providers()
    logger.info(f"可用数据源: {[p.name for p in providers]}")

    for provider in providers:
        await init_fuse(provider.name)
        if await is_fused(provider.name):
            logger.info(f"数据源 {provider.name} 已熔断，跳过")
            continue

        try:
            logger.info(f"尝试从 {provider.name} 获取股票基础信息...")
            data = provider.fetch_stock_basics()
            if data and len(data) >= 4000:  # 至少要有4000只股票才算有效
                await mark_success(provider.name)
                logger.info(f"从 {provider.name} 获取股票基础信息成功，共 {len(data)} 条")
                return {
                    'data': data,
                    'source': provider.name
                }
            else:
                logger.warning(f"从 {provider.name} 获取数据不足: {len(data) if data else 0}条，未达到最低要求4000条")
                await mark_fail(provider.name)
        except Exception as e:
            await mark_fail(provider.name)
            logger.error(f"从 {provider.name} 获取股票基础信息失败: {e}")
            traceback.print_exc()

    raise Exception("所有数据源都无法获取股票基础信息")


async def schedule_stock_quotes() -> Dict[str, Any]:
    """调度数据源获取股票行情数据，自动降级和熔断"""
    providers = get_providers()
    logger.info(f"可用数据源: {[p.name for p in providers]}")

    for provider in providers:
        await init_fuse(provider.name)
        if await is_fused(provider.name):
            logger.info(f"数据源 {provider.name} 已熔断，跳过")
            continue

        try:
            logger.info(f"尝试从 {provider.name} 获取股票行情数据...")
            data = provider.fetch_stock_quotes()
            if data and len(data) >= 4000:  # 至少要有4000只股票才算有效
                await mark_success(provider.name)
                logger.info(f"从 {provider.name} 获取股票行情数据成功，共 {len(data)} 条")
                return {
                    'data': data,
                    'source': provider.name
                }
            else:
                logger.warning(f"从 {provider.name} 获取行情数据不足: {len(data) if data else 0}条，未达到最低要求4000条")
                await mark_fail(provider.name)
        except Exception as e:
            await mark_fail(provider.name)
            logger.error(f"从 {provider.name} 获取股票行情数据失败: {e}")
            traceback.print_exc()

    raise Exception("所有数据源都无法获取股票行情数据")


async def schedule_industry_concept() -> Dict[str, Any]:
    """调度数据源获取行业概念关联，自动降级和熔断"""
    providers = get_providers()
    logger.info(f"可用数据源: {[p.name for p in providers]}")

    for provider in providers:
        await init_fuse(provider.name)
        if await is_fused(provider.name):
            logger.info(f"数据源 {provider.name} 已熔断，跳过")
            continue

        try:
            logger.info(f"尝试从 {provider.name} 获取行业概念关联...")
            data = provider.fetch_industry_concept()
            if data and (len(data.get('industry_relations', [])) > 0 or len(data.get('concept_relations', [])) > 0):
                await mark_success(provider.name)
                logger.info(f"从 {provider.name} 获取行业概念关联成功，行业关联 {len(data['industry_relations'])} 条，概念关联 {len(data['concept_relations'])} 条")
                return {
                    'data': data,
                    'source': provider.name
                }
            else:
                logger.warning(f"从 {provider.name} 获取行业概念数据为空")
                await mark_fail(provider.name)
        except Exception as e:
            await mark_fail(provider.name)
            logger.error(f"从 {provider.name} 获取行业概念关联失败: {e}")
            traceback.print_exc()

    raise Exception("所有数据源都无法获取行业概念关联")


async def schedule_finance_data() -> Dict[str, Any]:
    """调度数据源获取财务数据，自动降级和熔断"""
    providers = get_providers()
    logger.info(f"可用数据源: {[p.name for p in providers]}")

    for provider in providers:
        await init_fuse(provider.name)
        if await is_fused(provider.name):
            logger.info(f"数据源 {provider.name} 已熔断，跳过")
            continue

        try:
            logger.info(f"尝试从 {provider.name} 获取财务数据...")
            data = provider.fetch_finance_data()
            if data and len(data) >= 4000:  # 至少要有4000只股票才算有效
                await mark_success(provider.name)
                logger.info(f"从 {provider.name} 获取财务数据成功，共 {len(data)} 条")
                return {
                    'data': data,
                    'source': provider.name
                }
            else:
                logger.warning(f"从 {provider.name} 获取财务数据不足: {len(data) if data else 0}条，未达到最低要求4000条")
                await mark_fail(provider.name)
        except Exception as e:
            await mark_fail(provider.name)
            logger.error(f"从 {provider.name} 获取财务数据失败: {e}")
            traceback.print_exc()

    raise Exception("所有数据源都无法获取财务数据")
