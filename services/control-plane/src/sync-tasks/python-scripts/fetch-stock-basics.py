#!/usr/bin/env python3
import os
import json
import sys
import traceback

# 强制清空所有代理环境变量，绝对不走代理
for k in list(os.environ.keys()):
    if k.lower() in ['http_proxy', 'https_proxy', 'all_proxy', 'ftp_proxy', 'no_proxy',
                    'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'FTP_PROXY', 'NO_PROXY']:
        del os.environ[k]

def fetch_akshare(source: str = "eastmoney"):
    """从AKShare获取A股基础信息，支持东方财富(eastmoney)和新浪(sina)双数据源"""
    import akshare as ak

    # 根据 source 参数选择接口
    if source == "sina":
        df = ak.stock_zh_a_spot()  # 新浪财经接口
        print(f"使用 AKShare 新浪财经接口获取股票基础信息", file=sys.stderr)
    else:  # 默认使用东方财富
        df = ak.stock_zh_a_spot_em()  # 东方财富接口
        print(f"使用 AKShare 东方财富接口获取股票基础信息", file=sys.stderr)

    if df is None or df.empty:
        print(f"AKShare {source} 返回空数据", file=sys.stderr)
        return None

    # 列名兼容（两个接口的列名可能不同）
    code_col = next((c for c in ["代码", "code", "symbol", "股票代码"] if c in df.columns), None)
    name_col = next((c for c in ["名称", "name", "股票名称"] if c in df.columns), None)
    market_cap_col = next((c for c in ["总市值", "total_mv"] if c in df.columns), None)
    float_cap_col = next((c for c in ["流通市值", "float_mv"] if c in df.columns), None)
    total_shares_col = next((c for c in ["总股本", "total_share"] if c in df.columns), None)
    float_shares_col = next((c for c in ["流通股本", "float_share"] if c in df.columns), None)
    pe_col = next((c for c in ["市盈率-动态", "pe", "市盈率"] if c in df.columns), None)
    pb_col = next((c for c in ["市净率", "pb"] if c in df.columns), None)

    if not code_col or not name_col:
        print(f"AKShare {source} 缺少必要列: code={code_col}, name={name_col}, columns={list(df.columns)}", file=sys.stderr)
        return None

    result = []
    for _, row in df.iterrows():
        code_raw = row.get(code_col)
        name = row.get(name_col, '') if name_col else ''

        # 跳过退市等特殊股票
        if '退' in str(name) or 'ST' in str(name) or '*ST' in str(name) or 'N' == str(name)[0]:
            continue

        # 标准化股票代码
        code_str = str(code_raw).strip()
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

        def safe_float(value) -> float:
            try:
                if value is None or value == '-' or value == '':
                    return 0.0
                return float(value)
            except (ValueError, TypeError):
                return 0.0

        def safe_int(value, multiplier=1) -> int:
            try:
                if value is None or value == '-' or value == '':
                    return 0
                return int(float(value) * multiplier)
            except (ValueError, TypeError):
                return 0

        try:
            result.append({
                'stock_code': code,
                'stock_name': str(name),
                'exchange': 'sh' if code.startswith('6') else 'sz' if code.startswith(('0','3')) else 'bj',
                'company_name': '',
                'main_business': '',
                'industry': '',
                'region': '',
                'market_cap': safe_float(row.get(market_cap_col)),
                'float_cap': safe_float(row.get(float_cap_col)),
                'total_shares': safe_int(row.get(total_shares_col), 100000000),  # 亿转为股
                'float_shares': safe_int(row.get(float_shares_col), 100000000),  # 亿转为股
                'pe_ttm': safe_float(row.get(pe_col)),
                'pb': safe_float(row.get(pb_col)),
                'list_date': ''
            })
        except Exception as e:
            print(f"Failed to process {code}: {e}", file=sys.stderr)
            continue
    print(f"✅ AKShare {source} 获取到 {len(result)} 只股票的基础信息", file=sys.stderr)
    return result

def fetch_efinance():
    """从efinance获取股票基础信息，兜底"""
    import efinance as ef
    # 获取全市场最新行情
    print(f"使用 efinance 获取股票基础信息", file=sys.stderr)
    df = ef.stock.get_realtime_quotes()

    if df is None or df.empty:
        print(f"efinance 返回空数据", file=sys.stderr)
        return None

    result = []
    for _, row in df.iterrows():
        code_raw = row.get('股票代码', '')
        name = row.get('股票名称', '')

        # 跳过退市等特殊股票
        if '退' in str(name) or 'ST' in str(name) or '*ST' in str(name) or 'N' == str(name)[0]:
            continue

        # 标准化股票代码
        code_str = str(code_raw).strip()
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

        def safe_float(value) -> float:
            try:
                if value is None or value == '-' or value == '':
                    return 0.0
                return float(value)
            except (ValueError, TypeError):
                return 0.0

        def safe_int(value, multiplier=1) -> int:
            try:
                if value is None or value == '-' or value == '':
                    return 0
                return int(float(value) * multiplier)
            except (ValueError, TypeError):
                return 0

        try:
            result.append({
                'stock_code': code,
                'stock_name': str(name),
                'exchange': 'sh' if code.startswith('6') else 'sz' if code.startswith(('0','3')) else 'bj',
                'company_name': '',
                'main_business': '',
                'industry': '',
                'region': '',
                'market_cap': safe_float(row.get('总市值')),
                'float_cap': safe_float(row.get('流通市值')),
                'total_shares': safe_int(row.get('总股本'), 100000000),  # 亿转为股
                'float_shares': safe_int(row.get('流通股本'), 100000000),  # 亿转为股
                'pe_ttm': safe_float(row.get('动态市盈率')),
                'pb': safe_float(row.get('市净率')),
                'list_date': ''
            })
        except Exception as e:
            print(f"Failed to process {code}: {e}", file=sys.stderr)
            continue
    print(f"✅ efinance 获取到 {len(result)} 只股票的基础信息", file=sys.stderr)
    return result

if __name__ == '__main__':
    try:
        # 先尝试AKShare东方财富接口
        try:
            data = fetch_akshare("eastmoney")
            if data and len(data) > 100:
                print(json.dumps(data, ensure_ascii=False))
                sys.exit(0)
            else:
                print(f"AKShare东方财富接口获取数据不足: {len(data) if data else 0}条, 尝试新浪接口", file=sys.stderr)
        except Exception as e:
            print(f"AKShare东方财富接口失败: {e}", file=sys.stderr)
            traceback.print_exc()

        # 东方财富失败尝试新浪接口
        try:
            data = fetch_akshare("sina")
            if data and len(data) > 100:
                print(json.dumps(data, ensure_ascii=False))
                sys.exit(0)
            else:
                print(f"AKShare新浪接口获取数据不足: {len(data) if data else 0}条, 尝试efinance", file=sys.stderr)
        except Exception as e:
            print(f"AKShare新浪接口失败: {e}", file=sys.stderr)
            traceback.print_exc()

        # AKShare两个接口都失败，尝试efinance
        try:
            data = fetch_efinance()
            if data and len(data) > 100:
                print(json.dumps(data, ensure_ascii=False))
                sys.exit(0)
            else:
                print(f"efinance接口获取数据不足: {len(data) if data else 0}条", file=sys.stderr)
        except Exception as e:
            print(f"efinance 接口失败: {e}", file=sys.stderr)
            traceback.print_exc()

        # 所有接口都失败
        print(json.dumps([], ensure_ascii=False), file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Fatal error: {e}", file=sys.stderr)
        traceback.print_exc()
        sys.exit(1)
