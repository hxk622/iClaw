#!/usr/bin/env python3
import os
import sys
import json
import traceback

# 项目路径由PYTHONPATH环境变量自动设置，无需硬编码
# sys.path.insert(0, '/Users/shanpeifeng/work/hexun/iClaw')
# sys.path.insert(0, '/Users/shanpeifeng/work/hexun/iClaw/daily_stock_analysis')

from daily_stock_analysis.data_provider import DataFetcherManager

def fetch_stock_basics():
    """使用DataFetcherManager获取A股基础信息，多数据源自动切换"""
    try:
        manager = DataFetcherManager()
        print(f"使用 DataFetcherManager 获取股票基础信息，可用数据源: {[fetcher.__class__.__name__ for fetcher in manager._fetchers]}", file=sys.stderr)

        # 尝试找到支持全量拉取的fetcher（efinance或akshare）
        df = None
        for fetcher in manager._fetchers:
            fetcher_name = fetcher.__class__.__name__
            print(f"尝试使用 {fetcher_name} 获取全市场数据...", file=sys.stderr)

            try:
                if hasattr(fetcher, '_realtime_cache'):
                    # 对于有缓存的fetcher，先清理缓存强制刷新
                    fetcher._realtime_cache = {'data': None, 'timestamp': 0, 'ttl': 60}

                if fetcher_name == 'EfinanceFetcher':
                    # 调用efinance的全量接口
                    import efinance as ef
                    df = ef.stock.get_realtime_quotes()
                    print(f"✅ EfinanceFetcher 获取到 {len(df)} 条记录", file=sys.stderr)
                    break
                elif fetcher_name == 'AkshareFetcher':
                    # 调用akshare的全量接口
                    import akshare as ak
                    df = ak.stock_zh_a_spot_em()
                    print(f"✅ AkshareFetcher 获取到 {len(df)} 条记录", file=sys.stderr)
                    break
            except Exception as e:
                print(f"❌ {fetcher_name} 获取失败: {e}", file=sys.stderr)
                continue

        if df is None or df.empty:
            print(f"所有数据源都无法获取全市场数据", file=sys.stderr)
            return None

        print(f"成功获取全市场数据，共 {len(df)} 条记录", file=sys.stderr)

        result = []

        # 通用字段映射，适配不同数据源的列名
        def get_column(row, possible_names):
            for name in possible_names:
                if name in row and pd.notna(row[name]):
                    return row[name]
            return None

        for _, row in df.iterrows():
            try:
                # 获取股票代码
                code_raw = get_column(row, ['股票代码', 'code', 'symbol', 'stock_code'])
                if code_raw is None:
                    continue

                code_str = str(code_raw).strip()
                # 标准化股票代码
                if len(code_str) > 6:
                    code_str = ''.join(filter(str.isdigit, code_str))
                if code_str.isdigit():
                    code_clean = code_str.lstrip('0') or '0'
                    code = code_clean.zfill(6)
                else:
                    code_digits = ''.join(filter(str.isdigit, code_str))
                    if code_digits:
                        code = code_digits.zfill(6)
                    else:
                        continue

                # 获取股票名称
                name = get_column(row, ['股票名称', 'name', 'stock_name', '名称'])
                name = str(name) if name is not None else ''

                # 跳过退市等特殊股票
                if '退' in name or 'ST' in name or '*ST' in name or (name and name[0] == 'N'):
                    continue

                def safe_float(value) -> float:
                    try:
                        if value is None or value == '-' or value == '' or pd.isna(value):
                            return 0.0
                        return float(value)
                    except (ValueError, TypeError):
                        return 0.0

                def safe_int(value, multiplier=1) -> int:
                    try:
                        if value is None or value == '-' or value == '' or pd.isna(value):
                            return 0
                        return int(float(value) * multiplier)
                    except (ValueError, TypeError):
                        return 0

                # 获取各个字段，兼容不同数据源的列名
                market_cap = safe_float(get_column(row, ['总市值', 'total_mv', 'market_cap']))
                float_cap = safe_float(get_column(row, ['流通市值', 'float_mv', 'circ_mv', 'float_cap']))
                total_shares = safe_int(get_column(row, ['总股本', 'total_share', 'total_shares']), 100000000)  # 亿转为股
                float_shares = safe_int(get_column(row, ['流通股本', 'float_share', 'float_shares']), 100000000)  # 亿转为股
                pe_ttm = safe_float(get_column(row, ['市盈率-动态', 'pe', '市盈率', '动态市盈率', 'pe_ttm']))
                pb = safe_float(get_column(row, ['市净率', 'pb']))

                # 构造与原有格式完全兼容的输出
                stock_info = {
                    'stock_code': code,
                    'stock_name': name,
                    'exchange': 'sh' if code.startswith('6') else 'sz' if code.startswith(('0','3')) else 'bj',
                    'company_name': '',  # 这些额外字段需要单独获取
                    'main_business': '',
                    'industry': '',
                    'region': '',
                    'market_cap': market_cap,
                    'float_cap': float_cap,
                    'total_shares': total_shares,
                    'float_shares': float_shares,
                    'pe_ttm': pe_ttm,
                    'pb': pb,
                    'list_date': ''
                }

                result.append(stock_info)

            except Exception as e:
                print(f"Failed to process stock: {e}", file=sys.stderr)
                continue

        print(f"✅ 处理完成，有效股票数量: {len(result)}", file=sys.stderr)
        return result

    except Exception as e:
        print(f"DataFetcherManager 获取失败: {e}", file=sys.stderr)
        traceback.print_exc()
        return None

if __name__ == '__main__':
    try:
        # 使用DataFetcherManager获取数据
        data = fetch_stock_basics()
        if data and len(data) > 4000:  # 至少要有4000只股票才算有效
            print(json.dumps(data, ensure_ascii=False))
            sys.exit(0)
        else:
            print(f"获取数据不足: {len(data) if data else 0}条, 未达到最低要求4000条", file=sys.stderr)
            print(json.dumps([], ensure_ascii=False))
            sys.exit(1)

    except Exception as e:
        print(f"Fatal error: {e}", file=sys.stderr)
        traceback.print_exc()
        print(json.dumps([], ensure_ascii=False))
        sys.exit(1)
