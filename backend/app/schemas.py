from pydantic import BaseModel
from typing import List, Optional, Any
from uuid import UUID
from datetime import datetime
from .models import ProjectStatus, FileType, ActionType, ActionStatus

class ProjectFileBase(BaseModel):
    file_type: FileType
    original_name: str

class ProjectFileCreate(ProjectFileBase):
    pass

class ProjectFileResponse(BaseModel):
    id: UUID
    project_id: UUID
    file_type: FileType
    storage_path: str
    original_name: str
    file_size: int
    uploaded_by: str
    uploaded_at: datetime

    class Config:
        from_attributes = True

class MilestoneBase(BaseModel):
    """周期更新记录基础模型"""
    update_time: Optional[datetime] = None
    description: str
    attachments: List[str] = []

class MilestoneCreate(MilestoneBase):
    pass

class MilestoneResponse(MilestoneBase):
    id: UUID
    project_id: UUID
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class ProjectBase(BaseModel):
    title: str
    project_code: Optional[str] = None  # 项目编号，如 JGCX-2026-014
    department: Optional[str] = None
    leader: Optional[str] = None
    participants: List[str] = []
    tags: List[str] = []
    status: ProjectStatus = ProjectStatus.in_progress
    end_date: Optional[datetime] = None  # 结项时间
    delay_reason: Optional[str] = None  # 延期原因

class ProjectCreate(ProjectBase):
    pass

class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    department: Optional[str] = None
    leader: Optional[str] = None
    participants: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    status: Optional[ProjectStatus] = None
    end_date: Optional[datetime] = None   # 结项时间
    delay_reason: Optional[str] = None    # 延期原因（修改end_date时必填）

class ProjectResponse(ProjectBase):
    id: UUID
    created_at: datetime
    files: List[ProjectFileResponse] = []
    milestones: List[MilestoneResponse] = []
    delay_history: List['ProjectDelayHistoryResponse'] = []

    class Config:
        from_attributes = True

class AIPendingActionBase(BaseModel):
    action_type: ActionType
    suggested_payload: Any
    status: ActionStatus = ActionStatus.pending

class AIPendingActionCreate(AIPendingActionBase):
    pass

class AIPendingActionResponse(AIPendingActionBase):
    id: UUID
    project_id: UUID

    class Config:
        from_attributes = True

class AIConfigBase(BaseModel):
    """AI引擎配置基础模型"""
    name: str = "默认配置"
    base_url: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    api_key: str
    model: str = "qwen-max"
    temperature: str = "0.7"
    max_tokens: int = 2048
    is_active: bool = True

class AIConfigCreate(AIConfigBase):
    pass

class AIConfigUpdate(BaseModel):
    name: Optional[str] = None
    base_url: Optional[str] = None
    api_key: Optional[str] = None
    model: Optional[str] = None
    temperature: Optional[str] = None
    max_tokens: Optional[int] = None
    is_active: Optional[bool] = None

class AIConfigResponse(AIConfigBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class AIConfigListResponse(BaseModel):
    """AI配置列表响应（隐藏API Key）"""
    id: UUID
    name: str
    base_url: str
    model: str
    temperature: str
    max_tokens: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ---- 项目固化记录 Schema ----

class ProjectLogRemarkResponse(BaseModel):
    id: str
    content: str
    created_by: str
    created_at: datetime

    class Config:
        from_attributes = True

class ProjectUpdateCreate(BaseModel):
    reporter_name: str
    content: str
    image_urls: List[str] = []

class ProjectUpdateResponse(BaseModel):
    id: UUID
    project_id: UUID
    reporter_name: str
    content: str
    image_urls: List[str]
    remarks: List[ProjectLogRemarkResponse] = []
    created_at: datetime

    class Config:
        from_attributes = True

class HistoryItemResponse(ProjectUpdateResponse):
    project_title: str

class HistoryRemarkCreate(BaseModel):
    content: str


# ---- 项目周期延期历史 Schema ----

class ProjectDelayHistoryCreate(BaseModel):
    new_end_date: datetime
    reason: str
    changed_by: Optional[str] = "系统"

class ProjectDelayHistoryResponse(BaseModel):
    id: UUID
    project_id: UUID
    old_end_date: Optional[datetime]
    new_end_date: datetime
    reason: str
    changed_by: str
    created_at: datetime

    class Config:
        from_attributes = True
