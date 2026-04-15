from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional

class BaseProvider(ABC):
    """数据源提供者抽象基类"""

    @property
    @abstractmethod
    def name(self) -> str:
        """数据源名称"""
        pass

    @property
    @abstractmethod
    def priority(self) -> int:
        """优先级，数字越小越优先"""
        pass

    @property
    @abstractmethod
    def enabled(self) -> bool:
        """是否启用"""
        pass

    @abstractmethod
    def fetch_stock_basics(self) -> Optional[List[Dict[str, Any]]]:
        """获取股票基础信息"""
        pass

    @abstractmethod
    def fetch_stock_quotes(self) -> Optional[List[Dict[str, Any]]]:
        """获取股票行情数据"""
        pass

    @abstractmethod
    def fetch_industry_concept(self) -> Optional[Dict[str, List[Dict[str, Any]]]]:
        """获取行业概念关联"""
        pass

    @abstractmethod
    def fetch_finance_data(self) -> Optional[List[Dict[str, Any]]]:
        """获取财务数据"""
        pass
