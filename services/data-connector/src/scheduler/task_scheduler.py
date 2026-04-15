import asyncio
import logging
from typing import Callable, Any
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.events import EVENT_JOB_EXECUTED, EVENT_JOB_ERROR
from pytz import timezone

from src.config.settings import settings
from src.sync.stock_basics import sync_stock_basics
from src.sync.stock_quotes import sync_stock_quotes
from src.sync.industry_concept import sync_industry_concept
from src.sync.finance_data import sync_finance_data

logger = logging.getLogger(__name__)


class TaskScheduler:
    """
    APScheduler-based task scheduler for market data sync tasks.
    Fully replicates the cron schedule from control-plane.
    """

    def __init__(self):
        """Initialize the scheduler with configured timezone."""
        self.scheduler = AsyncIOScheduler(
            timezone=timezone(settings.SCHEDULER_TIMEZONE),
            job_defaults={
                'coalesce': True,  # Combine missed executions
                'max_instances': 1,  # Only one instance per job
                'misfire_grace_time': 300,  # 5 minutes grace time for misfired jobs
            }
        )
        self._setup_event_listeners()
        self._register_tasks()

    def _setup_event_listeners(self) -> None:
        """Setup event listeners for job execution and errors."""
        self.scheduler.add_listener(
            self._on_job_executed,
            EVENT_JOB_EXECUTED
        )
        self.scheduler.add_listener(
            self._on_job_error,
            EVENT_JOB_ERROR
        )

    def _register_tasks(self) -> None:
        """Register all sync tasks with their cron schedules."""
        # 1. 交易日每天17:00 同步股票基础信息
        self.scheduler.add_job(
            self._wrap_task(sync_stock_basics, "Stock Basics"),
            'cron',
            id='sync_stock_basics',
            name='Daily Stock Basics Sync',
            hour=17,
            minute=0,
            day_of_week='1-5',  # Monday to Friday
            replace_existing=True
        )
        logger.info("Registered sync_stock_basics task with cron: 0 17 * * 1-5")

        # 2. 交易日9:30-15:00 每小时同步一次行情数据
        self.scheduler.add_job(
            self._wrap_task(sync_stock_quotes, "Stock Quotes"),
            'cron',
            id='sync_stock_quotes',
            name='Hourly Stock Quotes Sync',
            hour='9-15',
            minute=0,
            day_of_week='1-5',  # Monday to Friday
            replace_existing=True
        )
        logger.info("Registered sync_stock_quotes task with cron: 0 9-15 * * 1-5")

        # 3. 交易日每天18:00 同步行业概念数据
        self.scheduler.add_job(
            self._wrap_task(sync_industry_concept, "Industry Concept"),
            'cron',
            id='sync_industry_concept',
            name='Daily Industry Concept Sync',
            hour=18,
            minute=0,
            day_of_week='1-5',  # Monday to Friday
            replace_existing=True
        )
        logger.info("Registered sync_industry_concept task with cron: 0 18 * * 1-5")

        # 4. 每季度第一天10:00 同步财务数据
        self.scheduler.add_job(
            self._wrap_task(sync_finance_data, "Finance Data"),
            'cron',
            id='sync_finance_data',
            name='Quarterly Finance Data Sync',
            month='1,4,7,10',
            day=1,
            hour=10,
            minute=0,
            replace_existing=True
        )
        logger.info("Registered sync_finance_data task with cron: 0 10 1 1,4,7,10 *")

    def _wrap_task(self, task_func: Callable, task_name: str) -> Callable:
        """Wrap task function with logging and error handling."""
        async def wrapped_task():
            logger.info(f"Starting {task_name} sync task...")
            try:
                result = await task_func(dry_run=False)
                if result.get('success', False):
                    sync_count = result.get('sync_count', 0)
                    logger.info(f"{task_name} sync task completed successfully, synced {sync_count} records")
                else:
                    error = result.get('error', 'Unknown error')
                    logger.info(f"{task_name} sync task skipped: {error}")
            except Exception as e:
                logger.error(f"{task_name} sync task failed: {str(e)}", exc_info=True)
                # Re-raise to allow scheduler to handle error event
                raise

        return wrapped_task

    def _on_job_executed(self, event: Any) -> None:
        """Handle job execution success event."""
        job = self.scheduler.get_job(event.job_id)
        if job:
            logger.debug(f"Job {job.name} ({event.job_id}) executed successfully")

    def _on_job_error(self, event: Any) -> None:
        """Handle job execution error event."""
        job = self.scheduler.get_job(event.job_id)
        if job:
            logger.error(
                f"Job {job.name} ({event.job_id}) failed with exception: {event.exception}",
                exc_info=event.traceback
            )

    def start(self) -> None:
        """Start the scheduler if it's not already running."""
        if not self.scheduler.running:
            self.scheduler.start()
            job_count = len(self.scheduler.get_jobs())
            logger.info(f"Scheduler started successfully with {job_count} registered jobs")
        else:
            logger.warning("Scheduler is already running")

    def shutdown(self, wait: bool = True) -> None:
        """Shutdown the scheduler gracefully."""
        if self.scheduler.running:
            logger.info("Shutting down scheduler...")
            self.scheduler.shutdown(wait=wait)
            logger.info("Scheduler shutdown completed")
        else:
            logger.warning("Scheduler is not running")

    def get_job_ids(self) -> list[str]:
        """Get list of all registered job IDs."""
        return [job.id for job in self.scheduler.get_jobs()]

    def is_running(self) -> bool:
        """Check if scheduler is currently running."""
        return self.scheduler.running


# Global scheduler instance
scheduler = TaskScheduler()


async def start_scheduler() -> None:
    """Start the global scheduler instance if enabled in settings."""
    if settings.SCHEDULER_ENABLED:
        logger.info("Scheduler is enabled, starting...")
        scheduler.start()
    else:
        logger.info("Scheduler is disabled in configuration, skipping start")


async def shutdown_scheduler() -> None:
    """Shutdown the global scheduler instance."""
    if scheduler.is_running():
        await asyncio.to_thread(scheduler.shutdown, wait=True)
    else:
        logger.info("Scheduler is not running, no shutdown needed")