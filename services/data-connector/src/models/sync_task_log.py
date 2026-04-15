from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Text
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()


class SyncTaskLog(Base):
    """同步任务日志表"""
    __tablename__ = "sync_task_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    task_name = Column(String(100), nullable=False, index=True, comment="任务名称")
    status = Column(String(20), nullable=False, comment="任务状态: running/success/failed")
    start_time = Column(DateTime, nullable=False, default=datetime.utcnow, comment="任务开始时间")
    end_time = Column(DateTime, comment="任务结束时间")
    error_message = Column(Text, comment="错误信息")
    sync_count = Column(Integer, default=0, comment="同步记录数量")
    data_source = Column(String(100), comment="数据源名称")
    created_at = Column(DateTime, default=datetime.utcnow, comment="创建时间")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, comment="更新时间")

    def __repr__(self):
        return f"<SyncTaskLog(id={self.id}, task_name='{self.task_name}', status='{self.status}')>"
