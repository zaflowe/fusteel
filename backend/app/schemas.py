from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Any
from uuid import UUID
from datetime import datetime
from .models import ProjectStatus, FileType, ActionType, ActionStatus, ProjectPriority

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
    project_code: Optional[str] = None  # 项目编号
    department: Optional[str] = None
    leader: Optional[str] = None
    participants: List[str] = []
    tags: List[str] = []
    status: ProjectStatus = ProjectStatus.in_progress
    end_date: Optional[datetime] = None  # 结项时间
    delay_reason: Optional[str] = None  # 延期原因
    # PDF 导入字段
    proposer: Optional[str] = None
    post_delivery_person: Optional[str] = None
    improvement_site: List[str] = []
    owning_company: List[str] = []
    improvement_purpose: List[str] = []
    improvement_method: List[str] = []
    needs_evaluation: Optional[str] = None
    implementation_period: Optional[int] = None
    planned_start_date: Optional[datetime] = None
    planned_end_date: Optional[datetime] = None
    budget: Optional[float] = None
    budget_text: Optional[str] = None
    expected_revenue: Optional[float] = None
    expected_revenue_text: Optional[str] = None
    is_one_time_investment: Optional[bool] = None
    is_one_time_revenue: Optional[bool] = None
    quantitative_goal: Optional[str] = None
    current_problem: Optional[str] = None
    technical_solution: Optional[str] = None
    # ABC 优先级（NULL = 未定级）
    priority: Optional[ProjectPriority] = None
    priority_score: Optional[int] = None
    priority_reason: Optional[str] = None
    priority_set_at: Optional[datetime] = None

    # 数据库中老数据这些列可能为 NULL，统一在反序列化前转为空列表，避免 500
    @field_validator(
        'participants', 'tags',
        'improvement_site', 'owning_company',
        'improvement_purpose', 'improvement_method',
        mode='before',
    )
    @classmethod
    def _none_to_empty_list(cls, v):
        return [] if v is None else v

class ProjectCreate(ProjectBase):
    pass

class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    department: Optional[str] = None
    leader: Optional[str] = None
    participants: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    status: Optional[ProjectStatus] = None
    end_date: Optional[datetime] = None
    delay_reason: Optional[str] = None
    # PDF 导入字段
    proposer: Optional[str] = None
    post_delivery_person: Optional[str] = None
    improvement_site: Optional[List[str]] = None
    owning_company: Optional[List[str]] = None
    improvement_purpose: Optional[List[str]] = None
    improvement_method: Optional[List[str]] = None
    needs_evaluation: Optional[str] = None
    implementation_period: Optional[int] = None
    planned_start_date: Optional[datetime] = None
    planned_end_date: Optional[datetime] = None
    budget: Optional[float] = None
    budget_text: Optional[str] = None
    expected_revenue: Optional[float] = None
    expected_revenue_text: Optional[str] = None
    is_one_time_investment: Optional[bool] = None
    is_one_time_revenue: Optional[bool] = None
    quantitative_goal: Optional[str] = None
    current_problem: Optional[str] = None
    technical_solution: Optional[str] = None

class ProjectResponse(ProjectBase):
    id: UUID
    created_at: datetime
    files: List[ProjectFileResponse] = []
    milestones: List[MilestoneResponse] = []
    delay_history: List['ProjectDelayHistoryResponse'] = []

    latest_update_at: Optional[datetime] = None
    latest_update_summary: Optional[str] = None
    latest_update_reporter: Optional[str] = None

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


# ---- 项目变更记录（干预动作） Schema ----

class ProjectChangeLogResponse(BaseModel):
    id: UUID
    project_id: UUID
    created_at: datetime
    action_type: str
    field_name: Optional[str] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    summary: str
    details: Optional[Any] = None

    class Config:
        from_attributes = True


class GlobalChangeLogResponse(ProjectChangeLogResponse):
    """全站干预动作流：附带项目标题，方便前端列表直接展示"""
    project_title: str


class PortalDeliveryPersonUpdate(BaseModel):
    post_delivery_person: str


# ---- ABC 优先级 Schema ----

class PriorityUpdate(BaseModel):
    """
    手动定级请求体。必须填理由：既为审计留痕，也防止"随手定级"。
    """
    priority: ProjectPriority
    reason: str = Field(..., min_length=2, description="定级 / 升降级理由，必填")


class AutoScoreDimension(BaseModel):
    """单个打分维度的结果（供前端展示打分明细）"""
    dim: str           # 维度名：投资额/实施周期/协同部门数/创新程度
    value: str         # 原始取值的人类可读表述，如 "20 万"
    score: int         # 0-3
    rationale: str     # 判分理由（解释为什么给这个分）
    manual: bool = False  # True 表示此维度无法自动判断，建议人工确认


class AutoScoreResponse(BaseModel):
    """
    自动打分建议。注意：此接口**只给建议，不落库**。
    前端拿到后交给人工确认/微调，再调用 PUT /priority 正式定级。
    """
    project_id: UUID
    project_title: str
    suggested_priority: ProjectPriority
    total_score: int
    hard_hit: Optional[str] = None   # 命中硬指标时的说明，如 "投资 ≥ 50 万"
    breakdown: List[AutoScoreDimension] = []
    note: Optional[str] = None       # 给前端的补充提示，例如"本项目多维度需人工确认"


class PriorityStatsResponse(BaseModel):
    """ABC 数量统计（供首页 Tab 栏显示）"""
    A: int = 0
    B: int = 0
    C: int = 0
    unset: int = 0
    total: int = 0
