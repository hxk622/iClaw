import asyncio
from typing import Optional, Callable, Any
from collections import deque
from src.utils.logger import logger
from src.utils.retry_decorator import retry

class ConcurrencyLimiter:
    """并发限流器，支持任务队列和优先级调度"""

    def __init__(self, max_concurrent: int = 1, queue_size: int = 100):
        """
        初始化并发限流器
        :param max_concurrent: 最大并发任务数
        :param queue_size: 最大队列大小
        """
        self.max_concurrent = max_concurrent
        self.queue_size = queue_size
        self.current_running = 0
        self.task_queue = deque()
        self.queue_condition = asyncio.Condition()
        self._shutdown = False
        self._processor_task: Optional[asyncio.Task] = None

    def start(self) -> None:
        """启动后台任务处理器"""
        if self._processor_task is None or self._processor_task.done():
            self._processor_task = asyncio.create_task(self._process_queue())

    async def acquire(self) -> None:
        """获取执行许可"""
        async with self.queue_condition:
            # 等待直到有可用的并发槽
            while self.current_running >= self.max_concurrent:
                await self.queue_condition.wait()
            self.current_running += 1

    async def release(self) -> None:
        """释放执行许可"""
        async with self.queue_condition:
            self.current_running -= 1
            self.queue_condition.notify_all()

    async def _process_queue(self) -> None:
        """处理任务队列"""
        while not self._shutdown:
            async with self.queue_condition:
                # 等待队列中有任务并且有可用的并发槽
                while not self.task_queue or self.current_running >= self.max_concurrent:
                    await self.queue_condition.wait()

                # 取出最高优先级的任务
                task = self.task_queue.popleft()
                future, coro, priority, retries = task

            # 执行任务
            asyncio.create_task(self._execute_task(future, coro, retries))

    async def _execute_task(self, future: asyncio.Future, coro: Callable, retries: int) -> None:
        """
        执行任务
        :param future: 用于返回结果的Future对象
        :param coro: 要执行的协程
        :param retries: 重试次数
        """
        try:
            await self.acquire()

            # 应用重试装饰器
            if retries > 0:
                decorated = retry(max_attempts=retries + 1)(coro)
                result = await decorated()
            else:
                result = await coro()

            if not future.done():
                future.set_result(result)
        except Exception as e:
            if not future.done():
                future.set_exception(e)
            logger.error(f"Task execution failed: {str(e)}")
        finally:
            await self.release()

    async def submit(
        self,
        coro: Callable,
        priority: int = 0,
        retries: int = 0
    ) -> Any:
        """
        提交任务到队列
        :param coro: 要执行的协程函数
        :param priority: 任务优先级，数值越大优先级越高
        :param retries: 失败重试次数
        :return: 任务执行结果
        """
        if self._shutdown:
            raise RuntimeError("Concurrency limiter is shutting down")

        async with self.queue_condition:
            if len(self.task_queue) >= self.queue_size:
                raise RuntimeError(f"Task queue is full (max size: {self.queue_size})")

            # 创建Future用于返回结果
            future = asyncio.get_event_loop().create_future()

            # 根据优先级插入到合适的位置
            inserted = False
            for i, (_, _, p, _) in enumerate(self.task_queue):
                if priority > p:
                    self.task_queue.insert(i, (future, coro, priority, retries))
                    inserted = True
                    break
            if not inserted:
                self.task_queue.append((future, coro, priority, retries))

            # 通知队列处理器
            self.queue_condition.notify_all()

        # 等待任务完成
        return await future

    async def shutdown(self, wait: bool = True) -> None:
        """
        关闭限流器
        :param wait: 是否等待所有任务完成
        """
        self._shutdown = True

        async with self.queue_condition:
            if not wait:
                # 清空队列
                while self.task_queue:
                    future, _, _, _ = self.task_queue.popleft()
                    if not future.done():
                        future.cancel()

            # 通知所有等待的任务
            self.queue_condition.notify_all()

        if wait:
            # 等待所有运行中的任务完成
            while self.current_running > 0:
                await asyncio.sleep(0.1)

    def get_queue_size(self) -> int:
        """获取当前队列大小"""
        return len(self.task_queue)

    def get_current_running(self) -> int:
        """获取当前正在运行的任务数"""
        return self.current_running

    def is_full(self) -> bool:
        """判断队列是否已满"""
        return len(self.task_queue) >= self.queue_size

# 限流器实例，在应用启动时调用start()方法
# 全局限流器实例，默认串行执行
global_limiter = ConcurrencyLimiter(max_concurrent=1, queue_size=100)

# 同步任务专用限流器，允许最多2个并发任务
sync_task_limiter = ConcurrencyLimiter(max_concurrent=2, queue_size=50)
# 别名，与control-plane接口兼容
global_concurrency_limiter = sync_task_limiter

# 数据源请求专用限流器，允许最多5个并发请求
data_source_limiter = ConcurrencyLimiter(max_concurrent=5, queue_size=200)


def start_all_limiters() -> None:
    """启动所有限流器的后台处理器"""
    global_limiter.start()
    sync_task_limiter.start()
    data_source_limiter.start()
    logger.info("All concurrency limiters started")
