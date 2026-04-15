#!/usr/bin/env python3
import os
import json
import sys
import traceback
from datetime import datetime


def fetch_akshare(source: str = "eastmoney"):
    """从AKShare获取全市场最新行情，支持东方财富(eastmoney)和新浪(sina)双数据源"""
    import akshare as ak

    # 根据 source 参数选择接口
    if source == "sina":
        df = ak.stock_zh_a_spot()  # 新浪财经接口
        print(f"使用 AKShare 新浪财经接口获取实时行情", file=sys.stderr)
    else:  # 默认使用东方财富
        df = ak.stock_zh_a_spot_em()  # 东方财富接口
        print(f"使用 AKShare 东方财富接口获取实时行情", file=sys.stderr)

    if df is None or df.empty:
        print(f"AKShare {source} 返回空数据", file=sys.stderr)
        return None

    # 列名兼容（两个接口的列名可能不同）
    code_col = next((c for c in ["代码", "code", "symbol", "股票代码"] if c in df.columns), None)
    name_col = next((c for c in ["名称", "name", "股票名称"] if c in df.columns), None)
    open_col = next((c for c in ["今开", "开盘", "open", "今开(元)"] if c in df.columns), None)
    high_col = next((c for c in ["最高", "high"] if c in df.columns), None)
    low_col = next((c for c in ["最低", "low"] if c in df.columns), None)
    close_col = next((c for c in ["最新价", "现价", "最新价(元)", "price", "最新", "trade"] if c in df.columns), None)
    change_col = next((c for c in ["涨跌额", "涨跌", "change"] if c in df.columns), None)
    change_percent_col = next((c for c in ["涨跌幅", "涨跌幅(%)", "涨幅", "pct_chg", "changepercent"] if c in df.columns), None)
    volume_col = next((c for c in ["成交量", "成交量(手)", "volume", "成交量(股)", "vol"] if c in df.columns), None)
    amount_col = next((c for c in ["成交额", "成交额(元)", "amount", "成交额(万元)", "amount(万元)"] if c in df.columns), None)
    turnover_col = next((c for c in ["换手率", "turnover"] if c in df.columns), None)
    pe_col = next((c for c in ["市盈率-动态", "pe", "市盈率"] if c in df.columns), None)
    pb_col = next((c for c in ["市净率", "pb"] if c in df.columns), None)
    total_mv_col = next((c for c in ["总市值", "total_mv"] if c in df.columns), None)
    float_mv_col = next((c for c in ["流通市值", "float_mv"] if c in df.columns), None)

    if not code_col or not close_col:
        print(f"AKShare {source} 缺少必要列: code={code_col}, price={close_col}, columns={list(df.columns)}", file=sys.stderr)
        return None

    result = []
    trade_date = datetime.now().strftime('%Y-%m-%d')

    for _, row in df.iterrows():
        code_raw = row.get(code_col)
        name = row.get(name_col, '') if name_col else ''

        # 跳过退市、ST股票
        if '退' in str(name) or 'ST' in str(name) or '*ST' in str(name):
            continue

        # 标准化股票代码：处理交易所前缀（如 sz000001, sh600036）
        code_str = str(code_raw).strip()

        # 如果代码长度超过6位，去掉前面的交易所前缀（如 sz, sh）
        if len(code_str) > 6:
            # 去掉前面的非数字字符（通常是2个字符的交易所代码）
            code_str = ''.join(filter(str.isdigit, code_str))

        # 如果是纯数字，移除前导0后补齐到6位
        if code_str.isdigit():
            code_clean = code_str.lstrip('0') or '0'  # 移除前导0，如果全是0则保留一个0
            code = code_clean.zfill(6)  # 补齐到6位
        else:
            # 如果不是纯数字，尝试提取数字部分
            code_digits = ''.join(filter(str.isdigit, code_str))
            if code_digits:
                code = code_digits.zfill(6)
            else:
                # 无法提取有效代码，跳过
                continue

        def safe_float(value) -> float:
            try:
                if value is None or value == '-' or value == '':
                    return 0.0
                return float(value)
            except (ValueError, TypeError):
                return 0.0

        try:
            result.append({
                'stock_code': code,
                'stock_name': str(name),
                'open': safe_float(row.get(open_col)),
                'high': safe_float(row.get(high_col)),
                'low': safe_float(row.get(low_col)),
                'close': safe_float(row.get(close_col)),
                'change': safe_float(row.get(change_col)),
                'change_percent': safe_float(row.get(change_percent_col)),
                'volume': safe_float(row.get(volume_col)),  # 单位：手
                'amount': safe_float(row.get(amount_col)),  # 单位：元
                'turnover_rate': safe_float(row.get(turnover_col)),
                'pe_ttm': safe_float(row.get(pe_col)),
                'pb': safe_float(row.get(pb_col)),
                'total_market_cap': safe_float(row.get(total_mv_col)),
                'float_market_cap': safe_float(row.get(float_mv_col)),
                'trade_date': trade_date
            })
        except Exception as e:
            print(f"Failed to parse stock {code}: {e}", file=sys.stderr)
            continue

    print(f"✅ AKShare {source} 获取到 {len(result)} 只股票的实时行情", file=sys.stderr)
    return result

def fetch_efinance():
    """从efinance获取全市场最新行情，兜底"""
    import efinance as ef
    # 获取全市场最新行情
    print(f"使用 efinance 获取全市场实时行情", file=sys.stderr)
    df = ef.stock.get_realtime_quotes()

    if df is None or df.empty:
        print(f"efinance 返回空数据", file=sys.stderr)
        return None

    result = []
    trade_date = datetime.now().strftime('%Y-%m-%d')

    for _, row in df.iterrows():
        code_raw = row.get('股票代码', '')
        name = row.get('股票名称', '')

        # 跳过退市、ST股票
        if '退' in str(name) or 'ST' in str(name) or '*ST' in str(name):
            continue

        # 标准化股票代码：处理交易所前缀（如 sz000001, sh600036）
        code_str = str(code_raw).strip()

        # 如果代码长度超过6位，去掉前面的交易所前缀（如 sz, sh）
        if len(code_str) > 6:
            # 去掉前面的非数字字符（通常是2个字符的交易所代码）
            code_str = ''.join(filter(str.isdigit, code_str))

        # 如果是纯数字，移除前导0后补齐到6位
        if code_str.isdigit():
            code_clean = code_str.lstrip('0') or '0'  # 移除前导0，如果全是0则保留一个0
            code = code_clean.zfill(6)  # 补齐到6位
        else:
            # 如果不是纯数字，尝试提取数字部分
            code_digits = ''.join(filter(str.isdigit, code_str))
            if code_digits:
                code = code_digits.zfill(6)
            else:
                # 无法提取有效代码，跳过
                continue

        def safe_float(value) -> float:
            try:
                if value is None or value == '-' or value == '':
                    return 0.0
                return float(value)
            except (ValueError, TypeError):
                return 0.0

        try:
            result.append({
                'stock_code': code,
                'stock_name': str(name),
                'open': safe_float(row.get('开盘')),
                'high': safe_float(row.get('最高')),
                'low': safe_float(row.get('最低')),
                'close': safe_float(row.get('最新价')),
                'change': safe_float(row.get('涨跌额')),
                'change_percent': safe_float(row.get('涨跌幅')),
                'volume': safe_float(row.get('成交量')),  # 单位：手
                'amount': safe_float(row.get('成交额')),  # 单位：元
                'turnover_rate': safe_float(row.get('换手率')),
                'pe_ttm': safe_float(row.get('动态市盈率')),
                'pb': safe_float(row.get('市净率')),
                'total_market_cap': safe_float(row.get('总市值')),
                'float_market_cap': safe_float(row.get('流通市值')),
                'trade_date': trade_date
            })
        except Exception as e:
            print(f"Failed to parse stock {code}: {e}", file=sys.stderr)
            continue

    print(f"✅ efinance 获取到 {len(result)} 只股票的实时行情", file=sys.stderr)
    return result

if __name__ == '__main__':
    try:
        # 先尝试AKShare东方财富接口
        try:
            data = fetch_akshare("eastmoney")
            if data:
                print(json.dumps(data, ensure_ascii=False))
                sys.exit(0)
        except Exception as e:
            print(f"AKShare东方财富接口失败: {e}", file=sys.stderr)
            traceback.print_exc()

        # 东方财富失败尝试新浪接口
        try:
            data = fetch_akshare("sina")
            if data:
                print(json.dumps(data, ensure_ascii=False))
                sys.exit(0)
        except Exception as e:
            print(f"AKShare新浪接口失败: {e}", file=sys.stderr)
            traceback.print_exc()

        # AKShare两个接口都失败，尝试efinance
        try:
            data = fetch_efinance()
            if data:
                print(json.dumps(data, ensure_ascii=False))
                sys.exit(0)
        except Exception as e:
            print(f"efinance 接口失败: {e}", file=sys.stderr)
            traceback.print_exc()

        # 所有接口都失败
        print(json.dumps([]), file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Fatal error: {e}", file=sys.stderr)
        traceback.print_exc()
        sys.exit(1)
