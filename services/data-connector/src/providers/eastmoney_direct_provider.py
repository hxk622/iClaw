import sys
import traceback
import requests
import os
import urllib3
from typing import Any, Dict, List, Optional
from datetime import datetime
import pandas as pd

from .base_provider import BaseProvider
from src.utils.logger import logger

# 禁用SSL警告
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# 强制清空代理环境变量
for key in list(os.environ.keys()):
    if key.lower().endswith('_proxy'):
        del os.environ[key]


class EastMoneyDirectProvider(BaseProvider):
    """东方财富直接请求数据源提供者，绕过Akshare和efinance，避免代理问题"""

    @property
    def name(self) -> str:
        return "eastmoney_direct"

    @property
    def priority(self) -> int:
        return 0  # 最高优先级，比akshare还高

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

    def _fetch_eastmoney_data(self, pz: int = 10000) -> Optional[List[Dict[str, Any]]]:
        """
        直接请求东方财富API获取全市场股票数据
        :param pz: 每页数量，默认10000，足够覆盖所有A股
        """
        try:
            url = f"http://82.push2delay.eastmoney.com/api/qt/clist/get?pn=1&pz={pz}&po=1&np=1&ut=bd1d9ddb04089700cf9c27f6f7426281&fltt=2&invt=2&fid=f12&fs=m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23,m:0+t:81+s:2048&fields=f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f12,f13,f14,f15,f16,f17,f18,f20,f21,f23,f24,f25,f22,f11,f62,f128,f136,f115,f152"

            headers = {
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
                "Accept-Language": "zh-CN,zh;q=0.9",
                "Cache-Control": "max-age=0",
                "Proxy-Connection": "keep-alive",
                "Upgrade-Insecure-Requests": "1",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36"
            }

            # 强制不使用任何代理，忽略SSL验证
            response = requests.get(url, headers=headers, proxies={"http": None, "https": None}, verify=False, timeout=30)
            response.raise_for_status()

            data = response.json()
            if not data or 'data' not in data or 'diff' not in data['data']:
                logger.error("东方财富API返回数据格式异常")
                return None

            diff_list = data['data']['diff']
            logger.info(f"✅ 东方财富API返回 {len(diff_list)} 条股票数据")
            return diff_list

        except Exception as e:
            logger.error(f"❌ 请求东方财富API失败: {e}")
            traceback.print_exc()
            return None

    def fetch_stock_basics(self) -> Optional[List[Dict[str, Any]]]:
        """获取股票基础信息"""
        try:
            logger.info("尝试使用 EastMoneyDirectProvider 获取全市场股票基础信息...")

            # 直接请求东方财富API，获取10000条数据，覆盖所有A股
            diff_list = self._fetch_eastmoney_data(pz=10000)
            if not diff_list:
                return None

            result = []
            for item in diff_list:
                try:
                    # 标准化股票代码
                    code = self._clean_stock_code(item.get('f12'))
                    if not code:
                        continue

                    # 获取股票名称
                    name = item.get('f14', '')
                    name = str(name) if name is not None else ''

                    # 跳过退市等特殊股票
                    if '退' in name or 'ST' in name or '*ST' in name or (name and name[0] == 'N'):
                        continue

                    # 获取各个字段
                    # f20: 总市值（元）
                    market_cap = self._safe_float(item.get('f20')) / 100000000  # 转换为亿元
                    # f21: 流通市值（元）
                    float_cap = self._safe_float(item.get('f21')) / 100000000  # 转换为亿元
                    # f23: 市净率
                    pb = self._safe_float(item.get('f23'))
                    # f9: 市盈率-动态
                    pe_ttm = self._safe_float(item.get('f9'))

                    # 总股本和流通股本可以通过市值/股价计算
                    close_price = self._safe_float(item.get('f2'))
                    total_shares = 0
                    float_shares = 0
                    if close_price > 0:
                        total_shares = self._safe_int(market_cap * 100000000 / close_price)  # 单位：股
                        float_shares = self._safe_int(float_cap * 100000000 / close_price)  # 单位：股

                    # 构造与原有格式完全兼容的输出
                    stock_info = {
                        'stock_code': code,
                        'stock_name': name,
                        'exchange': 'sh' if code.startswith('6') else 'sz' if code.startswith(('0', '3')) else 'bj',
                        'company_name': '',  # 这些额外字段后续可以补充
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

            logger.info(f"✅ EastMoneyDirectProvider 处理完成，有效股票数量: {len(result)}")
            return result

        except Exception as e:
            logger.error(f"❌ EastMoneyDirectProvider 获取股票基础信息失败: {e}")
            traceback.print_exc()
            return None

    def fetch_stock_quotes(self) -> Optional[List[Dict[str, Any]]]:
        """获取股票行情数据"""
        try:
            logger.info("尝试使用 EastMoneyDirectProvider 获取全市场行情...")

            # 直接请求东方财富API，获取10000条数据，覆盖所有A股
            diff_list = self._fetch_eastmoney_data(pz=10000)
            if not diff_list:
                return None

            result = []
            trade_date = datetime.now().strftime('%Y-%m-%d')

            for item in diff_list:
                try:
                    # 标准化股票代码
                    code = self._clean_stock_code(item.get('f12'))
                    if not code:
                        continue

                    # 获取股票名称
                    name = item.get('f14', '')
                    name = str(name) if name is not None else ''

                    # 跳过退市、ST股票
                    if '退' in name or 'ST' in name or '*ST' in name:
                        continue

                    # 获取各个字段
                    open_price = self._safe_float(item.get('f17'))  # 今开
                    high = self._safe_float(item.get('f15'))  # 最高
                    low = self._safe_float(item.get('f16'))  # 最低
                    close = self._safe_float(item.get('f2'))  # 最新价
                    change = self._safe_float(item.get('f4'))  # 涨跌额
                    change_percent = self._safe_float(item.get('f3'))  # 涨跌幅(%)
                    volume = self._safe_float(item.get('f5'))  # 成交量(手)
                    amount = self._safe_float(item.get('f6'))  # 成交额(元)
                    turnover_rate = self._safe_float(item.get('f8'))  # 换手率(%)
                    pe_ttm = self._safe_float(item.get('f9'))  # 市盈率-动态
                    pb = self._safe_float(item.get('f23'))  # 市净率
                    total_market_cap = self._safe_float(item.get('f20')) / 100000000  # 总市值(亿元)
                    float_market_cap = self._safe_float(item.get('f21')) / 100000000  # 流通市值(亿元)

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
                    logger.warning(f"处理股票 {code} 失败: {e}")
                    continue

            logger.info(f"✅ EastMoneyDirectProvider 处理完成，有效行情数据共 {len(result)} 条")
            return result

        except Exception as e:
            logger.error(f"❌ EastMoneyDirectProvider 获取行情失败: {e}")
            traceback.print_exc()
            return None

    def fetch_industry_concept(self) -> Optional[Dict[str, List[Dict[str, Any]]]]:
        """获取行业概念关联 - 暂时返回None，由后续provider处理"""
        logger.info("EastMoneyDirectProvider 暂不支持行业概念数据，将fallback到其他数据源")
        return None

    def fetch_finance_data(self) -> Optional[List[Dict[str, Any]]]:
        """获取财务数据 - 暂时返回None，由后续provider处理"""
        logger.info("EastMoneyDirectProvider 暂不支持财务数据，将fallback到其他数据源")
        return None
