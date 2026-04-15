
import os
import sys
import asyncio

# 强制清除所有代理环境变量
os.environ.pop('http_proxy', None)
os.environ.pop('https_proxy', None)
os.environ.pop('all_proxy', None)
os.environ.pop('HTTP_PROXY', None)
os.environ.pop('HTTPS_PROXY', None)
os.environ.pop('ALL_PROXY', None)

# 禁用requests的自动代理
import requests
s = requests.Session()
s.trust_env = False # 不读取系统代理设置

# 添加src目录到路径
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

from src.sync.stock_basics import sync_stock_basics
from src.sync.stock_quotes import sync_stock_quotes
from src.sync.industry_concept import sync_industry_concept
from src.sync.finance_data import sync_finance_data

async def run_all_tasks():
    print("=== 开始运行所有同步任务 ===")

    # 1. 股票基础信息同步
    print("\n1. 运行股票基础信息同步任务...")
    try:
        result = await sync_stock_basics(dry_run=False)
        if result:
            print(f"[OK] 股票基础信息同步成功，共 {len(result)} 条记录")
        else:
            print("[ERROR] 股票基础信息同步失败")
    except Exception as e:
        print(f"[ERROR] 股票基础信息同步出错: {str(e)}")

    # 2. 股票行情数据同步
    print("\n2. 运行股票行情数据同步任务...")
    try:
        result = await sync_stock_quotes(dry_run=False)
        if result:
            print(f"[OK] 股票行情数据同步成功，共 {len(result)} 条记录")
        else:
            print("[ERROR] 股票行情数据同步失败")
    except Exception as e:
        print(f"[ERROR] 股票行情数据同步出错: {str(e)}")

    # 3. 行业概念数据同步
    print("\n3. 运行行业概念数据同步任务...")
    try:
        result = await sync_industry_concept(dry_run=False)
        if result:
            print(f"[OK] 行业概念数据同步成功，共 {len(result)} 条记录")
        else:
            print("[ERROR] 行业概念数据同步失败")
    except Exception as e:
        print(f"[ERROR] 行业概念数据同步出错: {str(e)}")

    # 4. 财务数据同步
    print("\n4. 运行财务数据同步任务...")
    try:
        result = await sync_finance_data(dry_run=False)
        if result:
            print(f"[OK] 财务数据同步成功，共 {len(result)} 条记录")
        else:
            print("[ERROR] 财务数据同步失败")
    except Exception as e:
        print(f"[ERROR] 财务数据同步出错: {str(e)}")

    print("\n=== 所有任务运行完成 ===")

if __name__ == "__main__":
    asyncio.run(run_all_tasks())
