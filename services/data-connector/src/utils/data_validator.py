from typing import Any, Dict, List, Optional
import hashlib
import json
from src.utils.logger import logger


class DataValidator:
    """数据验证工具类"""

    @staticmethod
    def validate_dataset(records: List[Dict[str, Any]], validate_record_func=None) -> Dict[str, Any]:
        """
        验证数据集，与control-plane接口兼容
        :param records: 待验证的记录列表
        :param validate_record_func: 单条记录验证函数
        :return: 验证结果，包含valid_records、invalid_count、issues
        """
        if not records:
            return {
                'valid_records': [],
                'invalid_count': 0,
                'issues': []
            }

        valid_records = []
        invalid_count = 0
        issues = []

        for record in records:
            try:
                if validate_record_func is None or validate_record_func(record):
                    valid_records.append(record)
                else:
                    invalid_count += 1
                    issues.append(f"Record validation failed: {record}")
            except Exception as e:
                invalid_count += 1
                issues.append(f"Record validation error: {e}, record: {record}")

        return {
            'valid_records': valid_records,
            'invalid_count': invalid_count,
            'issues': issues
        }

    @staticmethod
    def calculate_record_md5(record: Dict[str, Any], fields: List[str]) -> str:
        """
        计算记录的MD5值，用于增量同步，与control-plane算法一致
        :param record: 数据记录
        :param fields: 参与计算的字段列表
        :return: MD5哈希值
        """
        # 按字段名排序，保证顺序一致
        sorted_fields = sorted(fields)
        values = []

        for field in sorted_fields:
            value = record.get(field)
            # 统一处理None值
            if value is None:
                values.append('')
            else:
                # 转换为字符串，保证类型一致
                values.append(str(value))

        # 拼接所有值
        content = '|'.join(values).encode('utf-8')
        return hashlib.md5(content).hexdigest()

    @staticmethod
    def validate_stock_basics(data: List[Dict[str, Any]]) -> bool:
        """验证股票基础信息数据有效性"""
        if not data:
            logger.error("股票基础信息数据为空")
            return False

        if len(data) < 50:
            logger.error(f"股票基础信息数据不足，仅有 {len(data)} 条，最少需要50条")
            return False

        # 验证关键字段存在且格式正确
        required_fields = ['stock_code', 'stock_name', 'exchange']
        invalid_count = 0

        for idx, item in enumerate(data):
            for field in required_fields:
                if field not in item or item[field] is None:
                    invalid_count += 1
                    if invalid_count <= 10:  # 只打印前10个错误
                        logger.error(f"第 {idx} 条股票基础信息缺少必填字段 {field}: {item}")
                    continue

            # 验证股票代码格式
            stock_code = item.get('stock_code', '')
            if not isinstance(stock_code, str) or len(stock_code) != 6 or not stock_code.isdigit():
                invalid_count += 1
                if invalid_count <= 10:
                    logger.error(f"第 {idx} 条股票基础信息代码格式错误: {stock_code}")
                continue

        if invalid_count > 0:
            error_rate = invalid_count / len(data)
            if error_rate > 0.05:  # 错误率超过5%则验证失败
                logger.error(f"股票基础信息数据错误率过高: {error_rate:.2%} ({invalid_count}/{len(data)})")
                return False
            else:
                logger.warning(f"股票基础信息数据存在少量错误: {error_rate:.2%} ({invalid_count}/{len(data)})")

        logger.info(f"股票基础信息数据验证通过，共 {len(data)} 条，错误率 {invalid_count/len(data):.2%}")
        return True

    @staticmethod
    def validate_stock_basics_record(record: Dict[str, Any]) -> bool:
        """验证单条股票基础信息记录"""
        required_fields = ['stock_code', 'stock_name', 'exchange']
        for field in required_fields:
            if field not in record or record[field] is None:
                return False

        # 验证股票代码格式
        stock_code = record.get('stock_code', '')
        if not isinstance(stock_code, str) or len(stock_code) != 6 or not stock_code.isdigit():
            return False

        return True

    @staticmethod
    def validate_stock_quotes(data: List[Dict[str, Any]]) -> bool:
        """验证股票行情数据有效性"""
        if not data:
            logger.error("股票行情数据为空")
            return False

        if len(data) < 50:
            logger.error(f"股票行情数据不足，仅有 {len(data)} 条，最少需要50条")
            return False

        # 验证关键字段存在且格式正确
        required_fields = ['stock_code', 'stock_name', 'close', 'trade_date']
        invalid_count = 0

        for idx, item in enumerate(data):
            for field in required_fields:
                if field not in item or item[field] is None:
                    invalid_count += 1
                    if invalid_count <= 10:  # 只打印前10个错误
                        logger.error(f"第 {idx} 条股票行情缺少必填字段 {field}: {item}")
                    continue

            # 验证股票代码格式
            stock_code = item.get('stock_code', '')
            if not isinstance(stock_code, str) or len(stock_code) != 6 or not stock_code.isdigit():
                invalid_count += 1
                if invalid_count <= 10:
                    logger.error(f"第 {idx} 条股票行情代码格式错误: {stock_code}")
                continue

            # 验证价格字段为非负数
            price_fields = ['open', 'high', 'low', 'close']
            for field in price_fields:
                value = item.get(field, 0)
                if not isinstance(value, (int, float)) or value < 0:
                    invalid_count += 1
                    if invalid_count <= 10:
                        logger.error(f"第 {idx} 条股票行情 {field} 价格无效: {value}")
                    continue

        if invalid_count > 0:
            error_rate = invalid_count / len(data)
            if error_rate > 0.05:  # 错误率超过5%则验证失败
                logger.error(f"股票行情数据错误率过高: {error_rate:.2%} ({invalid_count}/{len(data)})")
                return False
            else:
                logger.warning(f"股票行情数据存在少量错误: {error_rate:.2%} ({invalid_count}/{len(data)})")

        logger.info(f"股票行情数据验证通过，共 {len(data)} 条，错误率 {invalid_count/len(data):.2%}")
        return True

    @staticmethod
    def validate_stock_quotes_record(record: Dict[str, Any]) -> bool:
        """验证单条股票行情记录"""
        required_fields = ['stock_code', 'stock_name', 'close', 'trade_date']
        for field in required_fields:
            if field not in record or record[field] is None:
                return False

        # 验证股票代码格式
        stock_code = record.get('stock_code', '')
        if not isinstance(stock_code, str) or len(stock_code) != 6 or not stock_code.isdigit():
            return False

        # 验证价格字段为非负数
        price_fields = ['open', 'high', 'low', 'close']
        for field in price_fields:
            value = record.get(field, 0)
            if not isinstance(value, (int, float)) or value < 0:
                return False

        return True

    @staticmethod
    def validate_industry_concept(data: Dict[str, List[Dict[str, Any]]]) -> bool:
        """验证行业概念关联数据有效性"""
        if not data:
            logger.error("行业概念关联数据为空")
            return False

        industry_relations = data.get('industry_relations', [])
        concept_relations = data.get('concept_relations', [])

        if len(industry_relations) == 0 and len(concept_relations) == 0:
            logger.error("行业和概念关联数据都为空")
            return False

        # 验证行业关联
        invalid_industry = 0
        if industry_relations:
            required_fields = ['stock_code', 'industry_code', 'industry_name']
            for idx, item in enumerate(industry_relations):
                for field in required_fields:
                    if field not in item or item[field] is None or str(item[field]).strip() == '':
                        invalid_industry += 1
                        if invalid_industry <= 10:
                            logger.error(f"第 {idx} 条行业关联缺少必填字段 {field}: {item}")
                        continue

                # 验证股票代码格式
                stock_code = item.get('stock_code', '')
                if not isinstance(stock_code, str) or len(stock_code) != 6 or not stock_code.isdigit():
                    invalid_industry += 1
                    if invalid_industry <= 10:
                        logger.error(f"第 {idx} 条行业关联代码格式错误: {stock_code}")
                    continue

        # 验证概念关联
        invalid_concept = 0
        if concept_relations:
            required_fields = ['stock_code', 'concept_code', 'concept_name']
            for idx, item in enumerate(concept_relations):
                for field in required_fields:
                    if field not in item or item[field] is None or str(item[field]).strip() == '':
                        invalid_concept += 1
                        if invalid_concept <= 10:
                            logger.error(f"第 {idx} 条概念关联缺少必填字段 {field}: {item}")
                        continue

                # 验证股票代码格式
                stock_code = item.get('stock_code', '')
                if not isinstance(stock_code, str) or len(stock_code) != 6 or not stock_code.isdigit():
                    invalid_concept += 1
                    if invalid_concept <= 10:
                        logger.error(f"第 {idx} 条概念关联代码格式错误: {stock_code}")
                    continue

        total_invalid = invalid_industry + invalid_concept
        total_records = len(industry_relations) + len(concept_relations)

        if total_invalid > 0 and total_records > 0:
            error_rate = total_invalid / total_records
            if error_rate > 0.1:  # 错误率超过10%则验证失败
                logger.error(f"行业概念关联数据错误率过高: {error_rate:.2%} ({total_invalid}/{total_records})")
                return False
            else:
                logger.warning(f"行业概念关联数据存在少量错误: {error_rate:.2%} ({total_invalid}/{total_records})")

        logger.info(f"行业概念关联数据验证通过，行业关联 {len(industry_relations)} 条，概念关联 {len(concept_relations)} 条，总错误率 {total_invalid/total_records:.2%}")
        return True

    @staticmethod
    def validate_industry_relation_record(record: Dict[str, Any]) -> bool:
        """验证单条行业关联记录"""
        required_fields = ['stock_code', 'industry_code', 'industry_name']
        for field in required_fields:
            if field not in record or record[field] is None or str(record[field]).strip() == '':
                return False

        # 验证股票代码格式
        stock_code = record.get('stock_code', '')
        if not isinstance(stock_code, str) or len(stock_code) != 6 or not stock_code.isdigit():
            return False

        return True

    @staticmethod
    def validate_concept_relation_record(record: Dict[str, Any]) -> bool:
        """验证单条概念关联记录"""
        required_fields = ['stock_code', 'concept_code', 'concept_name']
        for field in required_fields:
            if field not in record or record[field] is None or str(record[field]).strip() == '':
                return False

        # 验证股票代码格式
        stock_code = record.get('stock_code', '')
        if not isinstance(stock_code, str) or len(stock_code) != 6 or not stock_code.isdigit():
            return False

        return True

    @staticmethod
    def validate_finance_data(data: List[Dict[str, Any]]) -> bool:
        """验证财务数据有效性"""
        if not data:
            logger.error("财务数据为空")
            return False

        if len(data) < 4000:
            logger.error(f"财务数据不足，仅有 {len(data)} 条，最少需要4000条")
            return False

        # 验证关键字段存在且格式正确
        required_fields = ['stock_code', 'report_date', 'total_revenue', 'net_profit', 'eps', 'roe']
        invalid_count = 0

        for idx, item in enumerate(data):
            for field in required_fields:
                if field not in item or item[field] is None:
                    invalid_count += 1
                    if invalid_count <= 10:  # 只打印前10个错误
                        logger.error(f"第 {idx} 条财务数据缺少必填字段 {field}: {item}")
                    continue

            # 验证股票代码格式
            stock_code = item.get('stock_code', '')
            if not isinstance(stock_code, str) or len(stock_code) != 6 or not stock_code.isdigit():
                invalid_count += 1
                if invalid_count <= 10:
                    logger.error(f"第 {idx} 条财务数据代码格式错误: {stock_code}")
                continue

            # 验证报告日期格式
            report_date = item.get('report_date', '')
            if not isinstance(report_date, str) or len(report_date) != 10 or report_date[4] != '-' or report_date[7] != '-':
                invalid_count += 1
                if invalid_count <= 10:
                    logger.error(f"第 {idx} 条财务数据报告日期格式错误: {report_date}")
                continue

            # 验证数值字段有效性
            numeric_fields = ['total_revenue', 'net_profit', 'eps', 'roe', 'gross_margin', 'debt_ratio', 'cash_flow_per_share']
            for field in numeric_fields:
                value = item.get(field, 0)
                if not isinstance(value, (int, float)):
                    invalid_count += 1
                    if invalid_count <= 10:
                        logger.error(f"第 {idx} 条财务数据 {field} 类型无效: {type(value)}")
                    continue

        if invalid_count > 0:
            error_rate = invalid_count / len(data)
            if error_rate > 0.05:  # 错误率超过5%则验证失败
                logger.error(f"财务数据错误率过高: {error_rate:.2%} ({invalid_count}/{len(data)})")
                return False
            else:
                logger.warning(f"财务数据存在少量错误: {error_rate:.2%} ({invalid_count}/{len(data)})")

        logger.info(f"财务数据验证通过，共 {len(data)} 条，错误率 {invalid_count/len(data):.2%}")
        return True

    @staticmethod
    def validate_finance_data_record(record: Dict[str, Any]) -> bool:
        """验证单条财务数据记录"""
        required_fields = ['stock_code', 'report_date']
        for field in required_fields:
            if field not in record or record[field] is None:
                return False

        # 验证股票代码格式
        stock_code = record.get('stock_code', '')
        if not isinstance(stock_code, str) or len(stock_code) != 6 or not stock_code.isdigit():
            return False

        # 验证报告日期格式
        report_date = record.get('report_date', '')
        if not isinstance(report_date, str) or len(report_date) != 10 or report_date[4] != '-' or report_date[7] != '-':
            return False

        return True
