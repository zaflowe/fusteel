from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, func
from uuid import UUID
from datetime import datetime, timedelta
from . import models, schemas

def sync_status_from_tags(project: models.Project):
    """根据最新标签列表，自动同步状态并移除冲突标签"""
    if project.tags is None:
        return
        
    tags = list(project.tags)
    
    # "已完成"是已经完成但是没有结项(待结项状态), 已结项是就是归档了(已完成状态)
    has_closed = "#已结项" in tags
    has_paused = "#暂停" in tags or "#暂停中" in tags
    # 只要有待结项或者已完成，都视为待结项状态
    has_pending_closure = "#待结项" in tags or "#已完成" in tags
    has_progress = "#实施中" in tags
    
    # 状态决定及冲突清理
    target_status = models.ProjectStatus.in_progress
    target_tag = "#实施中"
    
    if has_closed:
        target_status = models.ProjectStatus.completed
        target_tag = "#已结项"
    elif has_paused:
        target_status = models.ProjectStatus.paused
        target_tag = "#暂停中"
    elif has_pending_closure:
        target_status = models.ProjectStatus.pending_completion
        # 偏好使用 #已完成 这个词（根据用户的反馈，已完成其实代表待结项）
        target_tag = "#已完成"
        
    # 移除所有状态标签，然后加上最终的 target_tag
    status_tags_pool = ["#已结项", "#已完成", "#暂停", "#暂停中", "#待结项", "#实施中"]
    cleaned_tags = [t for t in tags if t not in status_tags_pool]
    
    if target_tag not in cleaned_tags:
        cleaned_tags.append(target_tag)
        
    project.tags = cleaned_tags
    project.status = target_status

def get_project_by_title(db: Session, title: str):
    return db.query(models.Project).filter(models.Project.title == title).first()

def create_project(db: Session, project: schemas.ProjectCreate):
    # 新策略：项目周期改由 planned_start_date / planned_end_date 字段承载，
    # 二者都不自动填充，允许为空（前端显示"未设置"并提示手动维护）。
    # 老的 end_date 字段保留用于兼容历史数据与旧的延期流程，不再自动塞默认值。
    project_data = project.model_dump()
    db_project = models.Project(**project_data)
    sync_status_from_tags(db_project)
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return db_project

def update_project(db: Session, project_id: UUID, updates: schemas.ProjectUpdate):
    db_project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not db_project:
        return None
    for field, value in updates.model_dump(exclude_none=True).items():
        setattr(db_project, field, value)
        
    if "tags" in updates.model_dump(exclude_none=True):
        sync_status_from_tags(db_project)
        
    db.commit()
    db.refresh(db_project)
    return db_project

def search_projects(db: Session, keyword: str = "", tags: list[str] = None):
    # 先查询所有项目
    query = db.query(models.Project)
    results = query.all()
    
    # 关键词搜索：使用 Python 内存过滤
    if keyword:
        # 数据清洗：剥离 # 号，转小写
        search_term = keyword.replace("#", "").strip().lower()
        
        filtered = []
        for project in results:
            # 匹配标题（转小写）
            title_match = search_term in (project.title or "").lower()
            
            # 匹配标签（转小写，剥离标签中的 # 号）
            project_tags = [t.replace("#", "").lower() for t in (project.tags or [])]
            tag_match = any(search_term in tag for tag in project_tags)
            
            if title_match or tag_match:
                filtered.append(project)
        
        results = filtered
    
    # 标签筛选（额外的精确标签过滤）
    if tags:
        for tag in tags:
            clean_tag = tag.replace("#", "").strip().lower()
            results = [p for p in results if any(clean_tag in t.replace("#", "").lower() for t in (p.tags or []))]
    
    return results

def get_project(db: Session, project_id: UUID):
    return db.query(models.Project).filter(models.Project.id == project_id).first()

def complete_project(db: Session, project_id: UUID):
    db_project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if db_project:
        db_project.status = models.ProjectStatus.completed
        # 强制添加 #已结项 标签
        tags = list(db_project.tags or [])
        tags.append("#已结项")
        db_project.tags = tags
        sync_status_from_tags(db_project)
        db.commit()
        db.refresh(db_project)
    return db_project

# --- File CRUD (新版 - 支持分层存储) ---

def get_project_files(db: Session, project_id: UUID, file_type: models.FileType = None):
    """获取项目文件列表"""
    query = db.query(models.ProjectFile).filter(models.ProjectFile.project_id == project_id)
    if file_type:
        query = query.filter(models.ProjectFile.file_type == file_type)
    return query.order_by(models.ProjectFile.uploaded_at.desc()).all()

def add_project_file_v2(db: Session, project_id: UUID, file: schemas.ProjectFileCreate, 
                        storage_path: str, file_size: int, uploaded_by: str = "匿名"):
    """
    新版文件上传 - 支持分层存储
    application 和 ppt 类型：覆盖旧文件（唯一）
    free_resource 类型：允许重复上传
    """
    # application 和 ppt 类型：先删除旧文件
    if file.file_type in [models.FileType.application, models.FileType.ppt]:
        existing_files = db.query(models.ProjectFile).filter(
            models.ProjectFile.project_id == project_id,
            models.ProjectFile.file_type == file.file_type
        ).all()
        # 删除数据库记录（物理文件由调用方处理）
        for existing in existing_files:
            db.delete(existing)
        db.commit()
    
    # 创建新记录
    db_file = models.ProjectFile(
        project_id=project_id,
        file_type=file.file_type,
        storage_path=storage_path,
        original_name=file.original_name,
        file_size=file_size,
        uploaded_by=uploaded_by,
        uploaded_at=datetime.utcnow()
    )
    db.add(db_file)
    db.commit()
    db.refresh(db_file)
    return db_file

def get_file_by_id(db: Session, file_id: UUID):
    """通过ID获取文件"""
    return db.query(models.ProjectFile).filter(models.ProjectFile.id == file_id).first()

def delete_file(db: Session, file_id: UUID):
    """删除文件记录"""
    f = db.query(models.ProjectFile).filter(models.ProjectFile.id == file_id).first()
    if f:
        db.delete(f)
        db.commit()
        return True
    return False

# --- 兼容旧接口（已废弃） ---
def add_project_file(db: Session, project_id: UUID, file: schemas.ProjectFileCreate):
    """旧版接口 - 仅兼容"""
    db_file = models.ProjectFile(
        project_id=project_id,
        file_type=file.file_type,
        storage_path="",
        original_name=file.original_name,
        uploaded_at=datetime.utcnow()
    )
    db.add(db_file)
    db.commit()
    db.refresh(db_file)
    return db_file

def delete_project_file(db: Session, file_id: UUID):
    """旧版接口 - 仅兼容"""
    return delete_file(db, file_id)

# --- 周期更新记录 CRUD (原Milestone) ---

def get_milestones(db: Session, project_id: UUID):
    """获取项目的周期更新记录"""
    return db.query(models.Milestone).filter(models.Milestone.project_id == project_id).order_by(models.Milestone.created_at.desc()).all()

def create_milestone(db: Session, project_id: UUID, milestone: schemas.MilestoneCreate):
    """创建周期更新记录"""
    db_milestone = models.Milestone(**milestone.model_dump(), project_id=project_id)
    db.add(db_milestone)
    db.commit()
    db.refresh(db_milestone)
    return db_milestone

def delete_milestone(db: Session, milestone_id: UUID):
    """删除周期更新记录"""
    m = db.query(models.Milestone).filter(models.Milestone.id == milestone_id).first()
    if m:
        db.delete(m)
        db.commit()
        return True
    return False

# 保留旧函数名兼容，但内部使用新逻辑
def complete_milestone(db: Session, milestone_id: UUID):
    """[已废弃] 完成里程碑 - 保留兼容"""
    return db.query(models.Milestone).filter(models.Milestone.id == milestone_id).first()

# --- AI Actions ---

def get_pending_actions(db: Session):
    return db.query(models.AIPendingAction).filter(models.AIPendingAction.status == models.ActionStatus.pending).all()

def approve_action(db: Session, action_id: UUID, new_payload: dict):
    action = db.query(models.AIPendingAction).filter(models.AIPendingAction.id == action_id).first()
    if not action:
        return None
    action.status = models.ActionStatus.approved
    action.suggested_payload = new_payload
    db.commit()
    return action

def delete_action(db: Session, action_id: UUID):
    action = db.query(models.AIPendingAction).filter(models.AIPendingAction.id == action_id).first()
    if action:
        db.delete(action)
        db.commit()
    return True

# --- AI Config CRUD ---

def get_ai_configs(db: Session, skip: int = 0, limit: int = 100):
    """获取所有AI配置列表"""
    return db.query(models.AIConfig).offset(skip).limit(limit).all()

def get_ai_config(db: Session, config_id: UUID):
    """获取单个AI配置"""
    return db.query(models.AIConfig).filter(models.AIConfig.id == config_id).first()

def get_active_ai_config(db: Session):
    """获取当前启用的AI配置"""
    return db.query(models.AIConfig).filter(models.AIConfig.is_active == True).first()

def create_ai_config(db: Session, config: schemas.AIConfigCreate):
    """创建AI配置"""
    db_config = models.AIConfig(**config.model_dump())
    db.add(db_config)
    db.commit()
    db.refresh(db_config)
    return db_config

def update_ai_config(db: Session, config_id: UUID, updates: schemas.AIConfigUpdate):
    """更新AI配置"""
    db_config = db.query(models.AIConfig).filter(models.AIConfig.id == config_id).first()
    if not db_config:
        return None
    
    update_data = updates.model_dump(exclude_none=True)
    for field, value in update_data.items():
        setattr(db_config, field, value)
    
    db.commit()
    db.refresh(db_config)
    return db_config

def delete_ai_config(db: Session, config_id: UUID):
    """删除AI配置"""
    db_config = db.query(models.AIConfig).filter(models.AIConfig.id == config_id).first()
    if db_config:
        db.delete(db_config)
        db.commit()
        return True
    return False

def set_active_config(db: Session, config_id: UUID):
    """设置指定配置为启用状态（其他设为禁用）"""
    # 先禁用所有
    db.query(models.AIConfig).update({models.AIConfig.is_active: False})
    # 启用指定配置
    config = db.query(models.AIConfig).filter(models.AIConfig.id == config_id).first()
    if config:
        config.is_active = True
        db.commit()
        db.refresh(config)
    return config


# ---- 项目固化记录 CRUD ----

from typing import List, Optional

def create_project_update(db: Session, project_id: UUID, update_data) -> models.ProjectUpdate:
    """创建项目固化记录"""
    db_update = models.ProjectUpdate(
        project_id=project_id,
        reporter_name=update_data.reporter_name,
        content=update_data.content,
        image_urls=update_data.image_urls if update_data.image_urls else []
    )
    db.add(db_update)
    db.commit()
    db.refresh(db_update)
    return db_update

def get_project_updates(db: Session, project_id: UUID) -> List[models.ProjectUpdate]:
    """获取项目的所有固化记录，按时间倒序"""
    return db.query(models.ProjectUpdate).filter(
        models.ProjectUpdate.project_id == project_id
    ).order_by(models.ProjectUpdate.created_at.desc()).all()

def get_project_update(db: Session, update_id: UUID) -> Optional[models.ProjectUpdate]:
    """获取单个固化记录"""
    return db.query(models.ProjectUpdate).filter(models.ProjectUpdate.id == update_id).first()

def get_all_history(db: Session, limit: int = 50):
    return db.query(
        models.ProjectUpdate,
        models.Project.title.label("project_title")
    ).options(joinedload(models.ProjectUpdate.remarks)).join(
        models.Project, models.ProjectUpdate.project_id == models.Project.id
    ).order_by(
        models.ProjectUpdate.created_at.desc()
    ).limit(limit).all()

def update_history_remark(db: Session, update_id: UUID, remark: str) -> Optional[models.ProjectUpdate]:
    # 废弃的旧方法，保留兼容性或直接删除。此处保留空实现。
    pass

def create_history_remark(db: Session, update_id: UUID, content: str, created_by: str = "用户") -> models.ProjectLogRemark:
    new_remark = models.ProjectLogRemark(
        update_id=update_id,
        content=content,
        created_by=created_by
    )
    db.add(new_remark)
    db.commit()
    db.refresh(new_remark)
    return new_remark


# ---- 项目周期延期历史 CRUD ----

def create_delay_history(db: Session, project_id: UUID, old_end_date: datetime, 
                         new_end_date: datetime, reason: str, changed_by: str = "系统") -> models.ProjectDelayHistory:
    """创建延期历史记录"""
    db_history = models.ProjectDelayHistory(
        project_id=project_id,
        old_end_date=old_end_date,
        new_end_date=new_end_date,
        reason=reason,
        changed_by=changed_by
    )
    db.add(db_history)
    db.commit()
    db.refresh(db_history)
    return db_history

def get_delay_history(db: Session, project_id: UUID) -> List[models.ProjectDelayHistory]:
    """获取项目的延期历史，按时间倒序"""
    return db.query(models.ProjectDelayHistory).filter(
        models.ProjectDelayHistory.project_id == project_id
    ).order_by(models.ProjectDelayHistory.created_at.desc()).all()


# ---- 项目变更留痕 CRUD ----

def _to_str(v) -> Optional[str]:
    if v is None:
        return None
    if isinstance(v, datetime):
        return v.strftime('%Y-%m-%d')
    if isinstance(v, (list, tuple)):
        return '、'.join(str(x) for x in v)
    return str(v)

def log_change(
    db: Session,
    project_id: UUID,
    action_type: str,
    summary: str,
    field_name: Optional[str] = None,
    old_value=None,
    new_value=None,
    details=None,
    commit: bool = True,
) -> models.ProjectChangeLog:
    """
    统一写入"干预动作"日志。summary 是前端直接展示的一行文字。
    调用方通常已经在一次事务里做了业务改动，这里默认 commit=True 保证日志落地；
    如需和业务一起原子提交可传 commit=False。
    """
    rec = models.ProjectChangeLog(
        project_id=project_id,
        action_type=action_type,
        field_name=field_name,
        old_value=_to_str(old_value),
        new_value=_to_str(new_value),
        summary=summary,
        details=details,
    )
    db.add(rec)
    if commit:
        db.commit()
        db.refresh(rec)
    return rec


def get_project_change_logs(db: Session, project_id: UUID, limit: int = 200) -> List[models.ProjectChangeLog]:
    return db.query(models.ProjectChangeLog).filter(
        models.ProjectChangeLog.project_id == project_id
    ).order_by(models.ProjectChangeLog.created_at.desc()).limit(limit).all()


def get_all_change_logs(db: Session, limit: int = 100):
    """全站变更日志，连 join 项目标题一起返回。"""
    return db.query(
        models.ProjectChangeLog,
        models.Project.title.label("project_title"),
    ).join(
        models.Project, models.ProjectChangeLog.project_id == models.Project.id
    ).order_by(
        models.ProjectChangeLog.created_at.desc()
    ).limit(limit).all()
