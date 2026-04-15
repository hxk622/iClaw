import asyncio
import time
from functools import wraps
from typing import Callable, Any, Type, Tuple
from src.utils.logger import logger

class RetryError(Exception):
    """重试失败异常"""
    pass

class CircuitBreaker:
    """熔断器实现"""
    def __init__(self, failure_threshold: int = 5, recovery_timeout: int = 30):
        """
        初始化熔断器
        :param failure_threshold: 失败阈值，达到该值后熔断器打开
        :param recovery_timeout: 恢复超时时间，超时后进入半开状态
        """
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.failure_count = 0
        self.last_failure_time = 0
        self.state = "CLOSED"  # CLOSED, OPEN, HALF_OPEN

    def record_failure(self) -> None:
        """记录失败"""
        self.failure_count += 1
        self.last_failure_time = time.time()
        if self.failure_count >= self.failure_threshold:
            self.state = "OPEN"
            logger.warning(f"Circuit breaker opened after {self.failure_count} failures")

    def record_success(self) -> None:
        """记录成功"""
        self.failure_count = 0
        self.state = "CLOSED"

    def allow_request(self) -> bool:
        """
        检查是否允许请求
        :return: 是否允许请求
        """
        if self.state == "CLOSED":
            return True
        elif self.state == "OPEN":
            if time.time() - self.last_failure_time > self.recovery_timeout:
                self.state = "HALF_OPEN"
                return True
            return False
        else:  # HALF_OPEN
            return False  # 半开状态只允许一个请求，由成功/失败回调处理

# 全局熔断器实例
circuit_breaker = CircuitBreaker()

def retry(
    max_attempts: int = 3,
    delay: float = 1.0,
    backoff_factor: float = 2.0,
    max_delay: float = 30.0,
    retry_exceptions: Tuple[Type[Exception], ...] = (Exception,),
    use_circuit_breaker: bool = True
) -> Callable:
    """
    重试装饰器，支持指数退避和熔断器
    :param max_attempts: 最大重试次数
    :param delay: 初始延迟时间（秒）
    :param backoff_factor: 退避因子
    :param max_delay: 最大延迟时间（秒）
    :param retry_exceptions: 需要重试的异常类型
    :param use_circuit_breaker: 是否使用熔断器
    :return: 装饰器函数
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
            current_delay = delay
            last_exception = None

            for attempt in range(max_attempts):
                # 检查熔断器状态
                if use_circuit_breaker and not circuit_breaker.allow_request():
                    raise RetryError(f"Circuit breaker is open, rejecting request to {func.__name__}")

                try:
                    result = await func(*args, **kwargs)
                    if use_circuit_breaker:
                        circuit_breaker.record_success()
                    if attempt > 0:
                        logger.info(f"Retry {attempt + 1}/{max_attempts} for {func.__name__} succeeded")
                    return result
                except retry_exceptions as e:
                    last_exception = e
                    if use_circuit_breaker:
                        circuit_breaker.record_failure()

                    if attempt < max_attempts - 1:
                        logger.warning(
                            f"Attempt {attempt + 1}/{max_attempts} for {func.__name__} failed: {str(e)}. "
                            f"Retrying in {current_delay:.2f} seconds..."
                        )
                        await asyncio.sleep(current_delay)
                        current_delay = min(current_delay * backoff_factor, max_delay)
                    else:
                        logger.error(
                            f"All {max_attempts} attempts for {func.__name__} failed. Last error: {str(e)}"
                        )

            raise RetryError(f"All {max_attempts} attempts failed") from last_exception

        @wraps(func)
        def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
            current_delay = delay
            last_exception = None

            for attempt in range(max_attempts):
                # 检查熔断器状态
                if use_circuit_breaker and not circuit_breaker.allow_request():
                    raise RetryError(f"Circuit breaker is open, rejecting request to {func.__name__}")

                try:
                    result = func(*args, **kwargs)
                    if use_circuit_breaker:
                        circuit_breaker.record_success()
                    if attempt > 0:
                        logger.info(f"Retry {attempt + 1}/{max_attempts} for {func.__name__} succeeded")
                    return result
                except retry_exceptions as e:
                    last_exception = e
                    if use_circuit_breaker:
                        circuit_breaker.record_failure()

                    if attempt < max_attempts - 1:
                        logger.warning(
                            f"Attempt {attempt + 1}/{max_attempts} for {func.__name__} failed: {str(e)}. "
                            f"Retrying in {current_delay:.2f} seconds..."
                        )
                        time.sleep(current_delay)
                        current_delay = min(current_delay * backoff_factor, max_delay)
                    else:
                        logger.error(
                            f"All {max_attempts} attempts for {func.__name__} failed. Last error: {str(e)}"
                        )

            raise RetryError(f"All {max_attempts} attempts failed") from last_exception

        # 判断函数是异步还是同步
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper

    return decorator

# 别名，与control-plane接口兼容
retry_with_exponential_backoff = retry
