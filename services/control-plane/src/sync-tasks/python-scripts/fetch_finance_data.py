#!/usr/bin/env python3
import os
import sys
import json
import traceback
from datetime import datetime
import pandas as pd

# 项目路径由PYTHONPATH环境变量自动设置，无需硬编码
# sys.path.insert(0, '/Users/shanpeifeng/work/hexun/iClaw')
# sys.path.insert(0, '/Users/shanpeifeng/work/hexun/iClaw/daily_stock_analysis')

from daily_stock_analysis.data_provider import DataFetcherManager

def fetch_finance_data(year: int = None):
    """使用DataFetcherManager获取上市公司财务报表数据"""
    try:
        if year is None:
            year = datetime.now().year

        manager = DataFetcherManager()
        print(f"使用 DataFetcherManager 获取 {year} 年财务数据，可用数据源: {[fetcher.__class__.__name__ for fetcher in manager._fetchers]}", file=sys.stderr)

        finance_data = []

        for fetcher in manager._fetchers:
            fetcher_name = fetcher.__class__.__name__
            print(f"尝试使用 {fetcher_name} 获取财务数据...", file=sys.stderr)

            try:
                if fetcher_name == 'AkshareFetcher':
                    # akshare提供财务报表接口
                    import akshare as ak

                    print("获取A股股票列表...", file=sys.stderr)
                    stock_df = ak.stock_zh_a_spot_em()
                    stock_codes = stock_df['代码'].tolist()
                    print(f"共 {len(stock_codes)} 只股票，开始获取财务数据...", file=sys.stderr)

                    for stock_code in stock_codes:
                        try:
                            stock_code = str(stock_code).strip().zfill(6)
                            print(f"获取 {stock_code} 财务数据...", file=sys.stderr)

                            # 获取利润表
                            profit_df = ak.stock_financial_report_sina(stock=stock_code, symbol="利润表")
                            # 获取资产负债表
                            balance_df = ak.stock_financial_report_sina(stock=stock_code, symbol="资产负债表")
                            # 获取现金流量表
                            cash_df = ak.stock_financial_report_sina(stock=stock_code, symbol="现金流量表")

                            # 只保留指定年份的数据
                            if profit_df is not None and not profit_df.empty:
                                # 找到最新的年报数据
                                latest_profit = profit_df[profit_df['REPORT_DATE'].str.contains(str(year))].head(1)
                                if not latest_profit.empty:
                                    profit_data = latest_profit.iloc[0]

                                    # 匹配资产负债表数据
                                    balance_data = None
                                    if balance_df is not None and not balance_df.empty:
                                        balance_match = balance_df[balance_df['REPORT_DATE'] == profit_data['REPORT_DATE']]
                                        if not balance_match.empty:
                                            balance_data = balance_match.iloc[0]

                                    # 匹配现金流量表数据
                                    cash_data = None
                                    if cash_df is not None and not cash_df.empty:
                                        cash_match = cash_df[cash_df['REPORT_DATE'] == profit_data['REPORT_DATE']]
                                        if not cash_match.empty:
                                            cash_data = cash_match.iloc[0]

                                    def safe_float(value):
                                        try:
                                            if pd.isna(value) or value is None or value == '-' or value == '':
                                                return 0.0
                                            return float(value)
                                        except (ValueError, TypeError):
                                            return 0.0

                                    # 提取年份和季度
                                    report_date = str(profit_data['REPORT_DATE'])
                                    report_year = int(report_date[:4])
                                    # 解析季度: 3月31日=Q1, 6月30日=Q2, 9月30日=Q3, 12月31日=Q4
                                    if '03-31' in report_date or '03月31日' in report_date:
                                        report_quarter = 1
                                    elif '06-30' in report_date or '06月30日' in report_date:
                                        report_quarter = 2
                                    elif '09-30' in report_date or '09月30日' in report_date:
                                        report_quarter = 3
                                    elif '12-31' in report_date or '12月31日' in report_date:
                                        report_quarter = 4
                                    else:
                                        # 默认按年报处理
                                        report_quarter = 4

                                    # 计算毛利率
                                    total_revenue = safe_float(profit_data.get('TOTAL_OPERATE_INCOME'))
                                    operate_cost = safe_float(profit_data.get('OPERATE_COST'))
                                    gross_margin = 0.0
                                    if total_revenue > 0:
                                        gross_margin = (total_revenue - operate_cost) / total_revenue * 100

                                    # 计算资产负债率
                                    total_assets = safe_float(balance_data.get('TOTAL_ASSETS')) if balance_data is not None else 0.0
                                    total_liabilities = safe_float(balance_data.get('TOTAL_LIABILITIES')) if balance_data is not None else 0.0
                                    debt_ratio = 0.0
                                    if total_assets > 0:
                                        debt_ratio = total_liabilities / total_assets * 100

                                    # 构造与TypeScript接口匹配的输出
                                    finance_item = {
                                        'stock_code': stock_code,
                                        'report_year': report_year,
                                        'report_quarter': report_quarter,
                                        'revenue': total_revenue,
                                        'net_profit': safe_float(profit_data.get('PARENT_NETPROFIT')),
                                        'roe': safe_float(profit_data.get('ROE')),
                                        'gross_margin': gross_margin,
                                        'debt_ratio': debt_ratio,
                                        'eps': safe_float(profit_data.get('EPS'))
                                    }

                                    finance_data.append(finance_item)

                        except Exception as e:
                            print(f"获取股票 {stock_code} 财务数据失败: {e}", file=sys.stderr)
                            continue

                    print(f"✅ AkshareFetcher 获取到 {len(finance_data)} 条财务数据记录", file=sys.stderr)
                    break

                elif fetcher_name == 'EfinanceFetcher':
                    # efinance也提供财务数据接口
                    import efinance as ef

                    print("获取A股股票列表...", file=sys.stderr)
                    stock_df = ef.stock.get_realtime_quotes()
                    stock_codes = stock_df['股票代码'].tolist()
                    print(f"共 {len(stock_codes)} 只股票，开始获取财务数据...", file=sys.stderr)

                    for stock_code in stock_codes:
                        try:
                            stock_code = str(stock_code).strip().zfill(6)
                            print(f"获取 {stock_code} 财务数据...", file=sys.stderr)

                            # 获取财务报表
                            df = ef.stock.get_finance_report(stock_code=stock_code)
                            if df is None or df.empty:
                                continue

                            # 筛选指定年份的数据
                            year_df = df[df['报告日期'].str.contains(str(year))].head(1)
                            if year_df.empty:
                                continue

                            row = year_df.iloc[0]

                            def safe_float(value):
                                try:
                                    if pd.isna(value) or value is None or value == '-' or value == '':
                                        return 0.0
                                    return float(value)
                                except (ValueError, TypeError):
                                    return 0.0

                            # 提取年份和季度
                            report_date = str(row.get('报告日期', ''))
                            report_year = int(report_date[:4]) if report_date and len(report_date) >= 4 else datetime.now().year
                            # 解析季度: 3月31日=Q1, 6月30日=Q2, 9月30日=Q3, 12月31日=Q4
                            if '03-31' in report_date or '03月31日' in report_date:
                                report_quarter = 1
                            elif '06-30' in report_date or '06月30日' in report_date:
                                report_quarter = 2
                            elif '09-30' in report_date or '09月30日' in report_date:
                                report_quarter = 3
                            elif '12-31' in report_date or '12月31日' in report_date:
                                report_quarter = 4
                            else:
                                # 默认按年报处理
                                report_quarter = 4

                            # 计算毛利率
                            total_revenue = safe_float(row.get('营业收入'))
                            operate_cost = safe_float(row.get('营业成本'))
                            gross_margin = 0.0
                            if total_revenue > 0:
                                gross_margin = (total_revenue - operate_cost) / total_revenue * 100

                            # 计算资产负债率
                            total_assets = safe_float(row.get('资产总计'))
                            total_liabilities = safe_float(row.get('负债合计'))
                            debt_ratio = 0.0
                            if total_assets > 0:
                                debt_ratio = total_liabilities / total_assets * 100

                            # 构造与TypeScript接口匹配的输出
                            finance_item = {
                                'stock_code': stock_code,
                                'report_year': report_year,
                                'report_quarter': report_quarter,
                                'revenue': total_revenue,
                                'net_profit': safe_float(row.get('净利润')),
                                'roe': safe_float(row.get('净资产收益率')),
                                'gross_margin': gross_margin,
                                'debt_ratio': debt_ratio,
                                'eps': safe_float(row.get('基本每股收益'))
                            }

                            finance_data.append(finance_item)

                        except Exception as e:
                            print(f"获取股票 {stock_code} 财务数据失败: {e}", file=sys.stderr)
                            continue

                    print(f"✅ EfinanceFetcher 获取到 {len(finance_data)} 条财务数据记录", file=sys.stderr)
                    break

            except Exception as e:
                print(f"❌ {fetcher_name} 获取失败: {e}", file=sys.stderr)
                traceback.print_exc()
                continue

        if len(finance_data) == 0:
            print(f"所有数据源都无法获取财务数据", file=sys.stderr)
            return None

        print(f"成功获取财务数据，共 {len(finance_data)} 条记录", file=sys.stderr)
        return finance_data

    except Exception as e:
        print(f"DataFetcherManager 获取财务数据失败: {e}", file=sys.stderr)
        traceback.print_exc()
        return None

if __name__ == '__main__':
    try:
        # 支持指定年份参数
        year = None
        if len(sys.argv) > 1 and sys.argv[1].isdigit():
            year = int(sys.argv[1])

        # 使用DataFetcherManager获取数据
        data = fetch_finance_data(year)
        if data and len(data) > 0:
            print(json.dumps(data, ensure_ascii=False))
            sys.exit(0)
        else:
            print(f"获取财务数据为空", file=sys.stderr)
            print(json.dumps([]))
            sys.exit(1)

    except Exception as e:
        print(f"Fatal error: {e}", file=sys.stderr)
        traceback.print_exc()
        print(json.dumps([]))
        sys.exit(1)
