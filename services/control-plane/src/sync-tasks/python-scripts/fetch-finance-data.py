#!/usr/bin/env python3
import os
import json
import sys
import traceback
from datetime import datetime


def get_latest_quarter():
    """获取最新的季度报告期"""
    now = datetime.now()
    year = now.year
    month = now.month

    # 计算当前季度
    quarter = (month - 1) // 3 + 1
    if quarter == 1 and month < 4:  # 1-3月，最新报告期是去年Q4
        year -= 1
        quarter = 4

    return year, quarter

def fetch_akshare(year: int, quarter: int):
    """从AKShare获取A股季度财务数据"""
    import akshare as ak

    print(f"使用 AKShare 获取 {year}年Q{quarter} 财务数据", file=sys.stderr)

    try:
        # 调用财务数据接口
        df = ak.stock_financial_report_sina(quarter=f"{year}年{quarter}季报告")

        if df is None or df.empty:
            print(f"AKShare 返回空数据", file=sys.stderr)
            return None

        # 列名映射
        code_col = next((c for c in ["股票代码", "code", "symbol"] if c in df.columns), None)
        name_col = next((c for c in ["股票名称", "name"] if c in df.columns), None)
        revenue_col = next((c for c in ["营业收入", "revenue"] if c in df.columns), None)
        net_profit_col = next((c for c in ["净利润", "net_profit"] if c in df.columns), None)
        roe_col = next((c for c in ["净资产收益率", "roe", "ROE"] if c in df.columns), None)
        gross_margin_col = next((c for c in ["毛利率", "gross_margin"] if c in df.columns), None)
        debt_ratio_col = next((c for c in ["资产负债率", "debt_ratio"] if c in df.columns), None)
        eps_col = next((c for c in ["每股收益", "eps", "EPS"] if c in df.columns), None)

        if not code_col:
            print(f"AKShare 缺少股票代码列，可用列: {list(df.columns)}", file=sys.stderr)
            return None

        result = []
        for _, row in df.iterrows():
            code_raw = row.get(code_col)
            name = row.get(name_col, '') if name_col else ''

            # 过滤ST/退市股票
            if '退' in str(name) or 'ST' in str(name) or '*ST' in str(name):
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
                    if value is None or value == '-' or value == '' or value == 'NaN':
                        return 0.0
                    return float(value)
                except (ValueError, TypeError):
                    return 0.0

            try:
                finance_info = {
                    'stock_code': code,
                    'report_year': year,
                    'report_quarter': quarter,
                    'revenue': safe_float(row.get(revenue_col)),
                    'net_profit': safe_float(row.get(net_profit_col)),
                    'roe': safe_float(row.get(roe_col)),
                    'gross_margin': safe_float(row.get(gross_margin_col)),
                    'debt_ratio': safe_float(row.get(debt_ratio_col)),
                    'eps': safe_float(row.get(eps_col))
                }
                result.append(finance_info)
            except Exception as e:
                print(f"处理股票 {code} 财务数据失败: {e}", file=sys.stderr)
                continue

        print(f"✅ AKShare 获取到 {len(result)} 条财务数据", file=sys.stderr)
        return result

    except Exception as e:
        print(f"AKShare 接口失败: {e}", file=sys.stderr)
        traceback.print_exc()
        return None

def fetch_efinance(year: int, quarter: int):
    """从efinance获取A股季度财务数据"""
    import efinance as ef

    print(f"使用 efinance 获取 {year}年Q{quarter} 财务数据", file=sys.stderr)

    try:
        # 获取财务报表数据
        df = ef.stock.get_financial_report(quarter=f"{year}{quarter}")

        if df is None or df.empty:
            print(f"efinance 返回空数据", file=sys.stderr)
            return None

        result = []
        for _, row in df.iterrows():
            code_raw = row.get('股票代码', '')
            name = row.get('股票名称', '')

            # 过滤ST/退市股票
            if '退' in str(name) or 'ST' in str(name) or '*ST' in str(name):
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
                    if value is None or value == '-' or value == '' or value == 'NaN':
                        return 0.0
                    return float(value)
                except (ValueError, TypeError):
                    return 0.0

            try:
                finance_info = {
                    'stock_code': code,
                    'report_year': year,
                    'report_quarter': quarter,
                    'revenue': safe_float(row.get('营业收入', 0)),
                    'net_profit': safe_float(row.get('净利润', 0)),
                    'roe': safe_float(row.get('净资产收益率', 0)),
                    'gross_margin': safe_float(row.get('毛利率', 0)),
                    'debt_ratio': safe_float(row.get('资产负债率', 0)),
                    'eps': safe_float(row.get('每股收益', 0))
                }
                result.append(finance_info)
            except Exception as e:
                print(f"处理股票 {code} 财务数据失败: {e}", file=sys.stderr)
                continue

        print(f"✅ efinance 获取到 {len(result)} 条财务数据", file=sys.stderr)
        return result

    except Exception as e:
        print(f"efinance 接口失败: {e}", file=sys.stderr)
        traceback.print_exc()
        return None

def fetch_tushare(year: int, quarter: int):
    """从Tushare获取A股季度财务数据（需要配置TOKEN）"""
    token = os.getenv('TUSHARE_TOKEN')
    if not token:
        print(f"TUSHARE_TOKEN 未配置，跳过Tushare数据源", file=sys.stderr)
        return None

    print(f"使用 Tushare 获取 {year}年Q{quarter} 财务数据", file=sys.stderr)

    try:
        import tushare as ts
        ts.set_token(token)
        pro = ts.pro_api()

        # 构造报告期
        period = f"{year}{['0331', '0630', '0930', '1231'][quarter-1]}"

        # 获取利润表
        income_df = pro.income_vip(period=period, fields='ts_code,revenue,net_profit,eps')
        # 获取财务指标
        fina_df = pro.fina_indicator_vip(period=period, fields='ts_code,roe,debt_to_assets,grossprofit_margin')

        if income_df is None or fina_df is None:
            print(f"Tushare 返回空数据", file=sys.stderr)
            return None

        # 合并数据
        merged = income_df.merge(fina_df, on='ts_code', how='inner')

        result = []
        for _, row in merged.iterrows():
            ts_code = row.get('ts_code', '')
            if not ts_code:
                continue

            # 提取股票代码，去掉交易所后缀
            code = ts_code.split('.')[0]

            # 获取股票名称并过滤ST
            try:
                name_df = pro.stock_basic(ts_code=ts_code, fields='name')
                if not name_df.empty:
                    name = name_df.iloc[0]['name']
                    if '退' in str(name) or 'ST' in str(name) or '*ST' in str(name):
                        continue
            except:
                # 名称获取失败时跳过ST过滤
                pass

            def safe_float(value) -> float:
                try:
                    if value is None or value == '-' or value == '' or value == 'NaN':
                        return 0.0
                    return float(value)
                except (ValueError, TypeError):
                    return 0.0

            try:
                finance_info = {
                    'stock_code': code,
                    'report_year': year,
                    'report_quarter': quarter,
                    'revenue': safe_float(row.get('revenue', 0)),
                    'net_profit': safe_float(row.get('net_profit', 0)),
                    'roe': safe_float(row.get('roe', 0)),
                    'gross_margin': safe_float(row.get('grossprofit_margin', 0)),
                    'debt_ratio': safe_float(row.get('debt_to_assets', 0)),
                    'eps': safe_float(row.get('eps', 0))
                }
                result.append(finance_info)
            except Exception as e:
                print(f"处理股票 {code} 财务数据失败: {e}", file=sys.stderr)
                continue

        print(f"✅ Tushare 获取到 {len(result)} 条财务数据", file=sys.stderr)
        return result

    except Exception as e:
        print(f"Tushare 接口失败: {e}", file=sys.stderr)
        traceback.print_exc()
        return None

if __name__ == '__main__':
    try:
        # 获取报告期参数，如果没有传入则使用最新季度
        year = None
        quarter = None

        if len(sys.argv) >= 3:
            try:
                year = int(sys.argv[1])
                quarter = int(sys.argv[2])
                if quarter < 1 or quarter > 4:
                    raise ValueError("季度必须是1-4")
            except ValueError as e:
                print(f"参数错误: {e}, 使用最新季度", file=sys.stderr)
                year, quarter = get_latest_quarter()
        else:
            year, quarter = get_latest_quarter()

        print(f"开始获取 {year}年Q{quarter} 财务数据", file=sys.stderr)

        # 1. 先尝试AKShare
        try:
            data = fetch_akshare(year, quarter)
            if data and len(data) > 1000:
                print(json.dumps(data, ensure_ascii=False))
                sys.exit(0)
            else:
                print(f"AKShare获取数据不足: {len(data) if data else 0}条, 尝试efinance", file=sys.stderr)
        except Exception as e:
            print(f"AKShare接口失败: {e}", file=sys.stderr)
            traceback.print_exc()

        # 2. 尝试efinance
        try:
            data = fetch_efinance(year, quarter)
            if data and len(data) > 1000:
                print(json.dumps(data, ensure_ascii=False))
                sys.exit(0)
            else:
                print(f"efinance获取数据不足: {len(data) if data else 0}条, 尝试Tushare", file=sys.stderr)
        except Exception as e:
            print(f"efinance接口失败: {e}", file=sys.stderr)
            traceback.print_exc()

        # 3. 尝试Tushare
        try:
            data = fetch_tushare(year, quarter)
            if data and len(data) > 1000:
                print(json.dumps(data, ensure_ascii=False))
                sys.exit(0)
            else:
                print(f"Tushare获取数据不足: {len(data) if data else 0}条", file=sys.stderr)
        except Exception as e:
            print(f"Tushare接口失败: {e}", file=sys.stderr)
            traceback.print_exc()

        # 所有接口都失败
        print(json.dumps([], ensure_ascii=False), file=sys.stderr)
        sys.exit(1)

    except Exception as e:
        print(f"致命错误: {e}", file=sys.stderr)
        traceback.print_exc()
        sys.exit(1)
