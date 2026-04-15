import sys
import traceback
from typing import Any, Dict, List, Optional
import pandas as pd
import efinance as ef
from datetime import datetime

from .base_provider import BaseProvider
from src.utils.logger import logger


class EfinanceProvider(BaseProvider):
    """efinance数据源提供者"""

    @property
    def name(self) -> str:
        return "efinance"

    @property
    def priority(self) -> int:
        return 2  # 次高优先级

    @property
    def enabled(self) -> bool:
        return True

    def _safe_float(self, value) -> float:
        """安全转换为float"""
        try:
            if value is None or value == '-' or value == '' or pd.isna(value):
                return 0.0
            return float(value)
        except (ValueError, TypeError):
            return 0.0

    def _safe_int(self, value, multiplier=1) -> int:
        """安全转换为int"""
        try:
            if value is None or value == '-' or value == '' or pd.isna(value):
                return 0
            return int(float(value) * multiplier)
        except (ValueError, TypeError):
            return 0

    def _get_column(self, row: pd.Series, possible_names: List[str]) -> Any:
        """从多种可能的列名中获取值"""
        for name in possible_names:
            if name in row and pd.notna(row[name]):
                return row[name]
        return None

    def _clean_stock_code(self, code_raw: Any) -> Optional[str]:
        """标准化股票代码"""
        if code_raw is None:
            return None

        code_str = str(code_raw).strip()

        # 提取数字部分
        if len(code_str) > 6:
            code_str = ''.join(filter(str.isdigit, code_str))

        if code_str.isdigit():
            code_clean = code_str.lstrip('0') or '0'
            return code_clean.zfill(6)
        else:
            code_digits = ''.join(filter(str.isdigit, code_str))
            if code_digits:
                return code_digits.zfill(6)
            return None

    def fetch_stock_basics(self) -> Optional[List[Dict[str, Any]]]:
        """获取股票基础信息"""
        try:
            print(f"尝试使用 EfinanceProvider 获取全市场数据...", file=sys.stderr)

            # 调用efinance的全量接口
            df = ef.stock.get_realtime_quotes()
            print(f"✅ EfinanceProvider 获取到 {len(df)} 条记录", file=sys.stderr)

            if df.empty:
                return None

            result = []
            for _, row in df.iterrows():
                try:
                    # 标准化股票代码
                    code = self._clean_stock_code(self._get_column(row, ['股票代码', 'code', 'symbol', 'stock_code']))
                    if not code:
                        continue

                    # 获取股票名称
                    name = self._get_column(row, ['股票名称', 'name', 'stock_name', '名称'])
                    name = str(name) if name is not None else ''

                    # 跳过退市等特殊股票
                    if '退' in name or 'ST' in name or '*ST' in name or (name and name[0] == 'N'):
                        continue

                    # 获取各个字段
                    market_cap = self._safe_float(self._get_column(row, ['总市值', 'total_mv', 'market_cap']))
                    float_cap = self._safe_float(self._get_column(row, ['流通市值', 'float_mv', 'circ_mv', 'float_cap']))
                    total_shares = self._safe_int(self._get_column(row, ['总股本', 'total_share', 'total_shares']), 100000000)  # 亿转为股
                    float_shares = self._safe_int(self._get_column(row, ['流通股本', 'float_share', 'float_shares']), 100000000)  # 亿转为股
                    pe_ttm = self._safe_float(self._get_column(row, ['市盈率-动态', 'pe', '市盈率', '动态市盈率', 'pe_ttm']))
                    pb = self._safe_float(self._get_column(row, ['市净率', 'pb']))

                    # 构造与原有格式完全兼容的输出
                    stock_info = {
                        'stock_code': code,
                        'stock_name': name,
                        'exchange': 'sh' if code.startswith('6') else 'sz' if code.startswith(('0', '3')) else 'bj',
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
                    logger.warning(f"处理股票失败: {e}")
                    continue

            logger.info(f"✅ 处理完成，有效股票数量: {len(result)}")

            # 批量获取扩展信息
            if result:
                stock_codes = [item['stock_code'] for item in result]
                detail_map = self._get_stock_detail_batch(stock_codes)
                # 合并扩展信息到基础数据
                for stock_info in result:
                    code = stock_info['stock_code']
                    if code in detail_map:
                        detail = detail_map[code]
                        stock_info['company_name'] = detail.get('company_name', '')
                        stock_info['main_business'] = detail.get('main_business', '')
                        stock_info['industry'] = detail.get('industry', '')
                        stock_info['region'] = detail.get('region', '')
                        stock_info['list_date'] = detail.get('list_date', '')

            return result

        except Exception as e:
            logger.error(f"❌ EfinanceProvider 获取失败: {e}")
            traceback.print_exc()
            return None

    def _get_stock_detail_batch(self, stock_codes: List[str]) -> Dict[str, Dict[str, Any]]:
        """
        批量获取股票详情信息
        :param stock_codes: 股票代码列表（6位格式）
        :return: 股票代码映射到详情信息的字典
        """
        from concurrent.futures import ThreadPoolExecutor, as_completed

        detail_map = {}
        batch_size = 50  # 每批处理50只股票
        max_workers = 5  # 最大并发数

        print(f"开始批量获取 {len(stock_codes)} 只股票的扩展信息...", file=sys.stderr)

        def fetch_detail(stock_code: str) -> Optional[Dict[str, Any]]:
            """获取单只股票详情"""
            try:
                # 获取股票基础信息
                df = ef.stock.get_base_info(stock_codes=[stock_code])
                if df.empty:
                    return None

                row = df.iloc[0]

                # 字段映射
                detail = {
                    'company_name': str(self._get_column(row, ['公司全称', '名称']) or ''),
                    'main_business': str(self._get_column(row, ['主营业务']) or ''),
                    'industry': str(self._get_column(row, ['所属行业', '行业']) or ''),
                    'region': str(self._get_column(row, ['所属地域', '地域']) or ''),
                    'list_date': str(self._get_column(row, ['上市日期']) or '')
                }

                # 统一日期格式为YYYY-MM-DD
                if detail['list_date']:
                    # 处理可能的格式，如 2020-01-01 或 20200101 或 Timestamp 对象
                    if isinstance(detail['list_date'], str):
                        if len(detail['list_date']) == 8 and detail['list_date'].isdigit():
                            detail['list_date'] = f"{detail['list_date'][:4]}-{detail['list_date'][4:6]}-{detail['list_date'][6:8]}"
                        elif ' ' in detail['list_date']:  # 处理带时间的格式
                            detail['list_date'] = detail['list_date'].split(' ')[0]
                    elif hasattr(detail['list_date'], 'strftime'):  # Timestamp或datetime对象
                        detail['list_date'] = detail['list_date'].strftime('%Y-%m-%d')

                return stock_code, detail

            except Exception as e:
                print(f"获取股票 {stock_code} 详情失败: {e}", file=sys.stderr)
                return None

        # 分批处理
        for i in range(0, len(stock_codes), batch_size):
            batch = stock_codes[i:i+batch_size]
            logger.info(f"处理批次 {i//batch_size + 1}/{(len(stock_codes)+batch_size-1)//batch_size}，共 {len(batch)} 只股票")

            try:
                # efinance支持批量获取，尝试批量获取整个批次
                df = ef.stock.get_base_info(stock_codes=batch)
                if not df.empty:
                    for _, row in df.iterrows():
                        try:
                            stock_code = str(self._get_column(row, ['股票代码', 'code']) or '').strip().zfill(6)
                            if len(stock_code) != 6:
                                continue

                            detail = {
                                'company_name': str(self._get_column(row, ['公司全称', '名称']) or ''),
                                'main_business': str(self._get_column(row, ['主营业务']) or ''),
                                'industry': str(self._get_column(row, ['所属行业', '行业']) or ''),
                                'region': str(self._get_column(row, ['所属地域', '地域']) or ''),
                                'list_date': str(self._get_column(row, ['上市日期']) or '')
                            }

                            # 统一日期格式
                            if detail['list_date']:
                                if isinstance(detail['list_date'], str):
                                    if len(detail['list_date']) == 8 and detail['list_date'].isdigit():
                                        detail['list_date'] = f"{detail['list_date'][:4]}-{detail['list_date'][4:6]}-{detail['list_date'][6:8]}"
                                    elif ' ' in detail['list_date']:
                                        detail['list_date'] = detail['list_date'].split(' ')[0]
                                elif hasattr(detail['list_date'], 'strftime'):
                                    detail['list_date'] = detail['list_date'].strftime('%Y-%m-%d')

                            detail_map[stock_code] = detail
                        except Exception as e:
                            print(f"处理批次内股票信息失败: {e}", file=sys.stderr)
                            continue
                    continue  # 批量获取成功，跳过单线程处理
            except Exception as e:
                print(f"批量获取批次失败，降级为单线程获取: {e}", file=sys.stderr)

            # 批量获取失败，降级为单线程获取
            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                futures = [executor.submit(fetch_detail, code) for code in batch]
                for future in as_completed(futures):
                    result = future.result()
                    if result:
                        stock_code, detail = result
                        detail_map[stock_code] = detail

        print(f"成功获取 {len(detail_map)} 只股票的扩展信息", file=sys.stderr)
        return detail_map

    def fetch_stock_quotes(self) -> Optional[List[Dict[str, Any]]]:
        """获取股票行情数据"""
        try:
            logger.info("尝试使用 EfinanceProvider 获取全市场行情...")

            # 调用efinance的全量接口
            df = ef.stock.get_realtime_quotes()
            print(f"✅ EfinanceProvider 获取到 {len(df)} 条行情记录", file=sys.stderr)

            if df.empty:
                return None

            result = []
            trade_date = datetime.now().strftime('%Y-%m-%d')

            for _, row in df.iterrows():
                try:
                    # 标准化股票代码
                    code = self._clean_stock_code(self._get_column(row, ['股票代码', 'code', 'symbol', 'stock_code']))
                    if not code:
                        continue

                    # 获取股票名称
                    name = self._get_column(row, ['股票名称', 'name', 'stock_name', '名称'])
                    name = str(name) if name is not None else ''

                    # 跳过退市、ST股票
                    if '退' in name or 'ST' in name or '*ST' in name:
                        continue

                    # 获取各个字段
                    open_price = self._safe_float(self._get_column(row, ['今开', '开盘', 'open', '今开(元)']))
                    high = self._safe_float(self._get_column(row, ['最高', 'high']))
                    low = self._safe_float(self._get_column(row, ['最低', 'low']))
                    close = self._safe_float(self._get_column(row, ['最新价', '现价', '最新价(元)', 'price', '最新', 'trade']))
                    change = self._safe_float(self._get_column(row, ['涨跌额', '涨跌', 'change']))
                    change_percent = self._safe_float(self._get_column(row, ['涨跌幅', '涨跌幅(%)', '涨幅', 'pct_chg', 'changepercent']))
                    volume = self._safe_float(self._get_column(row, ['成交量', '成交量(手)', 'volume', '成交量(股)', 'vol']))
                    amount = self._safe_float(self._get_column(row, ['成交额', '成交额(元)', 'amount', '成交额(万元)', 'amount(万元)']))
                    turnover_rate = self._safe_float(self._get_column(row, ['换手率', 'turnover']))
                    pe_ttm = self._safe_float(self._get_column(row, ['市盈率-动态', 'pe', '市盈率', '动态市盈率', 'pe_ttm']))
                    pb = self._safe_float(self._get_column(row, ['市净率', 'pb']))
                    total_market_cap = self._safe_float(self._get_column(row, ['总市值', 'total_mv']))
                    float_market_cap = self._safe_float(self._get_column(row, ['流通市值', 'float_mv', 'circ_mv']))

                    # 构造与原有格式完全兼容的输出
                    quote_info = {
                        'stock_code': code,
                        'stock_name': name,
                        'open': open_price,
                        'high': high,
                        'low': low,
                        'close': close,
                        'change': change,
                        'change_percent': change_percent,
                        'volume': volume,  # 单位：手
                        'amount': amount,  # 单位：元
                        'turnover_rate': turnover_rate,
                        'pe_ttm': pe_ttm,
                        'pb': pb,
                        'total_market_cap': total_market_cap,
                        'float_market_cap': float_market_cap,
                        'trade_date': trade_date
                    }

                    result.append(quote_info)

                except Exception as e:
                    print(f"处理股票 {code} 失败: {e}", file=sys.stderr)
                    continue

            print(f"✅ 处理完成，有效行情数据共 {len(result)} 条", file=sys.stderr)
            return result

        except Exception as e:
            logger.error(f"❌ EfinanceProvider 获取行情失败: {e}")
            traceback.print_exc()
            return None

    def fetch_industry_concept(self) -> Optional[Dict[str, List[Dict[str, Any]]]]:
        """获取行业概念关联"""
        try:
            logger.info("尝试使用 EfinanceProvider 获取行业概念数据...")

            industry_relations = []
            concept_relations = []

            print("获取全市场股票列表...", file=sys.stderr)
            stock_df = ef.stock.get_realtime_quotes()
            if stock_df is None or stock_df.empty:
                print("股票列表为空", file=sys.stderr)
                return None

            stock_codes = stock_df['股票代码'].tolist()
            print(f"共 {len(stock_codes)} 只股票，开始批量获取基础信息...", file=sys.stderr)

            # 批量获取股票基础信息（包含行业和概念）
            stock_list = ef.stock.get_base_info(stock_codes=stock_codes)
            print(f"成功获取 {len(stock_list)} 只股票的基础信息", file=sys.stderr)

            for _, row in stock_list.iterrows():
                try:
                    stock_code = str(row.get('股票代码', '')).strip().zfill(6)
                    if not stock_code or len(stock_code) != 6:
                        continue

                    # 处理行业信息
                    industry = row.get('所属行业', '')
                    if industry and str(industry).strip():
                        industry = str(industry).strip()
                        industry_relations.append({
                            'stock_code': stock_code,
                            'industry_code': industry,  # efinance没有行业代码，用名称当代码
                            'industry_name': industry
                        })

                    # 处理概念信息
                    concepts = row.get('概念', '')
                    if concepts and str(concepts).strip():
                        concept_list = str(concepts).split(',')
                        for concept in concept_list:
                            concept = concept.strip()
                            if concept:
                                concept_relations.append({
                                    'stock_code': stock_code,
                                    'concept_code': concept,
                                    'concept_name': concept
                                })
                except Exception as e:
                    print(f"处理股票 {stock_code} 失败: {e}", file=sys.stderr)
                    continue

            print(f"✅ EfinanceProvider 获取到 {len(industry_relations)} 条行业关联, {len(concept_relations)} 条概念关联", file=sys.stderr)
            return {
                'industry_relations': industry_relations,
                'concept_relations': concept_relations
            }

        except Exception as e:
            print(f"❌ EfinanceProvider 获取行业概念失败: {e}", file=sys.stderr)
            traceback.print_exc()
            return None

    def fetch_finance_data(self) -> Optional[List[Dict[str, Any]]]:
        """获取财务数据"""
        try:
            print(f"尝试使用 EfinanceProvider 获取财务数据...", file=sys.stderr)

            # 获取所有A股股票列表
            stock_df = ef.stock.get_realtime_quotes()
            if stock_df.empty:
                print("股票列表为空", file=sys.stderr)
                return None

            # 提取股票代码，标准化为6位
            stock_codes = []
            for _, row in stock_df.iterrows():
                code = self._clean_stock_code(self._get_column(row, ['股票代码', 'code', 'symbol', 'stock_code']))
                if code:
                    # 跳过退市、ST股票
                    name = self._get_column(row, ['股票名称', 'name', 'stock_name', '名称'])
                    name = str(name) if name is not None else ''
                    if '退' not in name and 'ST' not in name and '*ST' not in name:
                        stock_codes.append(code)

            print(f"共 {len(stock_codes)} 只有效股票，开始获取财务数据...", file=sys.stderr)

            result = []
            # 批量获取财务数据
            for stock_code in stock_codes[:1000]:  # 先获取1000只，避免超时
                try:
                    # 获取财务报表数据
                    finance_df = ef.stock.get_financial_report(stock_code=stock_code)
                    if finance_df.empty:
                        continue

                    # 获取最新报告期数据
                    latest_report = finance_df.iloc[0]

                    # 字段映射，与AKShare格式完全一致
                    report_date = self._get_column(latest_report, ['报告日期', 'REPORT_DATE'])
                    if not report_date:
                        continue

                    # 转换报告日期格式为YYYY-MM-DD
                    if isinstance(report_date, pd.Timestamp):
                        report_date_str = report_date.strftime('%Y-%m-%d')
                    else:
                        report_date_str = str(report_date)[:10]  # 截取前10位，确保格式正确

                    finance_info = {
                        'stock_code': stock_code,
                        'report_date': report_date_str,
                        'total_revenue': self._safe_float(self._get_column(latest_report, ['营业收入', 'TOTAL_OPERATE_INCOME', '营业总收入'])),
                        'net_profit': self._safe_float(self._get_column(latest_report, ['净利润', 'PARENT_NETPROFIT', '归属于母公司股东的净利润'])),
                        'eps': self._safe_float(self._get_column(latest_report, ['基本每股收益', 'EPS', '每股收益'])),
                        'roe': self._safe_float(self._get_column(latest_report, ['净资产收益率', 'WEIGHTAVG_ROE', '加权平均净资产收益率'])),
                        'gross_margin': self._safe_float(self._get_column(latest_report, ['毛利率', 'GROSS_MARGIN', '销售毛利率'])),
                        'debt_ratio': self._safe_float(self._get_column(latest_report, ['资产负债率', 'DEBT_TO_ASSETS_RATIO'])),
                        'cash_flow_per_share': self._safe_float(self._get_column(latest_report, ['每股经营现金流', 'OPERATE_CASHFLOW_PER_SHARE', '经营活动产生的现金流量净额每股']))
                    }

                    result.append(finance_info)

                except Exception as e:
                    print(f"获取股票 {stock_code} 财务数据失败: {e}", file=sys.stderr)
                    continue

            print(f"✅ EfinanceProvider 获取到 {len(result)} 条财务数据记录", file=sys.stderr)
            return result

        except Exception as e:
            print(f"❌ EfinanceProvider 获取财务数据失败: {e}", file=sys.stderr)
            traceback.print_exc()
            return None
