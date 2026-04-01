import uuid
from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.types import Uuid as UUID
from sqlalchemy import JSON as JSONB
import enum
from datetime import datetime

from .database import Base

class ProjectStatus(str, enum.Enum):
    in_progress = "实施中"
    pending_completion = "已完成"  # 原待结项
    completed = "已结项"         # 原已完成归档
    paused = "暂停中"

class FileType(str, enum.Enum):
    application = "application"  # 立项申请表
    ppt = "ppt"                  # 结项PPT
    free_resource = "free_resource"  # 自由资料池

class ActionType(str, enum.Enum):
    add_milestone = "新增里程碑"
    wecom_remind = "企微催收"
    send_news = "发送喜报"

class ActionStatus(str, enum.Enum):
    pending = "待审核"
    approved = "已批准"
    rejected = "已驳回"

class Project(Base):
    __tablename__ = "projects"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_code = Column(String, unique=True, nullable=True, index=True)  # 项目编号，如 JGCX-2026-014
    title = Column(String, index=True, nullable=False, unique=True)
    department = Column(String)
    leader = Column(String, nullable=True)              # 项目负责人
    participants = Column(JSONB, default=list)           # 参与人员列表
    tags = Column(JSONB, default=list)                  # e.g. ["#实施中", "#管理创新"]
    status = Column(SQLEnum(ProjectStatus), default=ProjectStatus.in_progress)
    created_at = Column(DateTime, default=datetime.utcnow)
    end_date = Column(DateTime, nullable=True, comment="结项时间")  # 项目结束时间
    delay_reason = Column(String, nullable=True, comment="当前延期原因")  # 最近一次延期原因

    files = relationship("ProjectFile", back_populates="project", cascade="all, delete-orphan")
    milestones = relationship("Milestone", back_populates="project", cascade="all, delete-orphan", order_by="Milestone.created_at")
    updates = relationship("ProjectUpdate", back_populates="project", cascade="all, delete-orphan", order_by="ProjectUpdate.created_at.desc()")
    ai_actions = relationship("AIPendingAction", back_populates="project", cascade="all, delete-orphan")
    delay_history = relationship("ProjectDelayHistory", back_populates="project", cascade="all, delete-orphan", order_by="ProjectDelayHistory.created_at.desc()")

class ProjectFile(Base):
    __tablename__ = "project_files"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"))
    file_type = Column(SQLEnum(FileType))  # application/ppt/free_resource
    storage_path = Column(String, nullable=False)  # 存储路径：uploads/{project_id}/{file_type}/{filename}
    original_name = Column(String, nullable=False)  # 原始文件名
    file_size = Column(Integer, default=0)  # 文件大小（字节）
    uploaded_by = Column(String, default="匿名")
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="files")

class Milestone(Base):
    """
    周期更新记录表（原里程碑表改造）
    用于记录项目的周期性汇报内容
    """
    __tablename__ = "milestones"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"))
    # 周期更新字段
    update_time = Column(DateTime, nullable=True, comment="更新时间/汇报时间")
    description = Column(String, nullable=False, comment="文字说明/进度描述")
    attachments = Column(JSONB, default=list, comment="附件URL列表")
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="milestones")


class ProjectUpdate(Base):
    """
    项目状态固化记录表（Timeline Snapshot）
    用于存储不可篡改的进展汇报，形成时间轴
    """
    __tablename__ = "project_updates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False, index=True)
    reporter_name = Column(String, nullable=False, comment="填报人姓名")
    content = Column(String, nullable=False, comment="汇报内容")
    image_urls = Column(JSONB, default=list, comment="图片URL列表")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, comment="固化时间戳")

    project = relationship("Project", back_populates="updates")

class AIPendingAction(Base):
    __tablename__ = "ai_pending_actions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    action_type = Column(SQLEnum(ActionType))
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"))
    suggested_payload = Column(JSONB)
    status = Column(SQLEnum(ActionStatus), default=ActionStatus.pending)

    project = relationship("Project", back_populates="ai_actions")

class AIConfig(Base):
    """
    AI引擎配置表 - 通义千问配置
    兼容OpenAI接口规范
    """
    __tablename__ = "ai_config"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, default="默认配置")
    base_url = Column(String, default="https://dashscope.aliyuncs.com/compatible-mode/v1")
    api_key = Column(String, nullable=False)
    model = Column(String, default="qwen-max")  # 支持 qwen-max, qwen-plus 等
    temperature = Column(String, default="0.7")
    max_tokens = Column(Integer, default=2048)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ProjectDelayHistory(Base):
    """
    项目周期延期历史记录表
    记录每次项目结项时间的变更历史
    """
    __tablename__ = "project_delay_history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False, index=True)
    old_end_date = Column(DateTime, nullable=True, comment="原结项时间")
    new_end_date = Column(DateTime, nullable=False, comment="新结项时间")
    reason = Column(String, nullable=False, comment="延期原因")
    changed_by = Column(String, default="系统", comment="修改人")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, comment="修改时间")

    project = relationship("Project", back_populates="delay_history")
