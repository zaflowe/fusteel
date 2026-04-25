from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, and_, func
from uuid import UUID
from datetime import datetime, timedelta
from typing import Optional
from . import models, schemas

# "最近固化"摘要的内容截断长度（单位：字符），超过则追加省略号
LATEST_UPDATE_SUMMARY_LIMIT = 30

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

def _attach_latest_update_info(db: Session, projects: list[models.Project]):
    """
    给一批 Project 对象批量挂载三个"虚拟"属性（SQLAlchemy 对象可直接赋值，
    Pydantic 的 from_attributes 会把它们读到 ProjectResponse 里）：
      - latest_update_at
      - latest_update_summary
      - latest_update_reporter

    用一次子查询 + 一次 join 拿每个项目最近的 ProjectUpdate，避免 N+1。
    """
    if not projects:
        return projects

    project_ids = [p.id for p in projects]

    latest_subq = (
        db.query(
            models.ProjectUpdate.project_id.label('pid'),
            func.max(models.ProjectUpdate.created_at).label('latest_at'),
        )
        .filter(models.ProjectUpdate.project_id.in_(project_ids))
        .group_by(models.ProjectUpdate.project_id)
        .subquery()
    )

    latest_rows = (
        db.query(models.ProjectUpdate)
        .join(
            latest_subq,
            and_(
                models.ProjectUpdate.project_id == latest_subq.c.pid,
                models.ProjectUpdate.created_at == latest_subq.c.latest_at,
            ),
        )
        .all()
    )

    by_pid = {r.project_id: r for r in latest_rows}

    for p in projects:
        u = by_pid.get(p.id)
        if u:
            p.latest_update_at = u.created_at
            content = (u.content or '').strip()
            if len(content) > LATEST_UPDATE_SUMMARY_LIMIT:
                content = content[:LATEST_UPDATE_SUMMARY_LIMIT] + '…'
            p.latest_update_summary = content
            p.latest_update_reporter = u.reporter_name
        else:
            p.latest_update_at = None
            p.latest_update_summary = None
            p.latest_update_reporter = None

    return projects


def _sort_projects(projects: list[models.Project], sort: str) -> list[models.Project]:
    """
    按照 sort 参数对项目列表做内存排序。
    - latest_update_desc（默认）：最近有汇报的排前，从未汇报的兜底在末尾
    - latest_update_asc：从未汇报的排最前（僵尸优先），然后有汇报的按旧→新
    - created_desc：立项时间新→旧
    - created_asc ：立项时间旧→新
    """
    if sort == 'latest_update_asc':
        # 从未汇报的放最前（僵尸项目优先露出）
        return sorted(
            projects,
            key=lambda p: (
                1 if p.latest_update_at else 0,            # 0: 从未汇报 → 排前
                p.latest_update_at.timestamp() if p.latest_update_at else 0,
            ),
        )
    if sort == 'created_desc':
        return sorted(projects, key=lambda p: p.created_at or datetime.min, reverse=True)
    if sort == 'created_asc':
        return sorted(projects, key=lambda p: p.created_at or datetime.min)

    # 默认 latest_update_desc：最近汇报的在前，从未汇报的排最后
    return sorted(
        projects,
        key=lambda p: (
            0 if p.latest_update_at else 1,                # 0: 有汇报 → 排前
            -(p.latest_update_at.timestamp()) if p.latest_update_at else 0,
        ),
    )


def search_projects(
    db: Session,
    keyword: str = "",
    tags: list[str] = None,
    sort: str = 'latest_update_desc',
    priority: str = "",
):
    """
    查询项目列表并挂载"最近固化"摘要。
    priority 取值：
      ""     不过滤
      "A"/"B"/"C"  仅返回该等级
      "unset"     仅返回未定级（priority IS NULL）
    保留了 Python 层过滤（兼容老逻辑与复杂标签匹配），之后再做 SQL 化重构。
    """
    query = db.query(models.Project)
    results = query.all()

    # 关键词搜索：使用 Python 内存过滤
    if keyword:
        search_term = keyword.replace("#", "").strip().lower()

        filtered = []
        for project in results:
            title_match = search_term in (project.title or "").lower()
            project_tags = [t.replace("#", "").lower() for t in (project.tags or [])]
            tag_match = any(search_term in tag for tag in project_tags)
            if title_match or tag_match:
                filtered.append(project)

        results = filtered

    # 标签筛选（额外的精确标签过滤）
    if tags:
        for tag in tags:
            clean_tag = tag.replace("#", "").strip().lower()
            results = [
                p for p in results
                if any(clean_tag in t.replace("#", "").lower() for t in (p.tags or []))
            ]

    # ABC 优先级过滤
    if priority:
        p_norm = priority.strip().upper()
        if p_norm == "UNSET":
            results = [p for p in results if p.priority is None]
        elif p_norm in ("A", "B", "C"):
            results = [p for p in results if p.priority and p.priority.value == p_norm]

    # 挂载最近固化信息 & 排序
    _attach_latest_update_info(db, results)
    return _sort_projects(results, sort)


def set_project_priority(
    db: Session,
    project_id: UUID,
    priority: models.ProjectPriority,
    reason: str,
):
    """
    手动定级 / 升降级。调用方（main.py）负责在返回后写 ProjectChangeLog，
    这里只负责落字段。
    返回 (project, old_priority_value) 供调用方生成变更记录摘要。
    """
    project = get_project(db, project_id)
    if not project:
        return None, None

    old_value = project.priority.value if project.priority else None

    project.priority = priority
    project.priority_reason = reason
    project.priority_set_at = datetime.utcnow()

    db.commit()
    db.refresh(project)
    return project, old_value


# ---- ABC 自动打分引擎 ----

# 核电关键词：命中任一 → 直接 A 类（制度红线）
_NUCLEAR_KEYWORDS = ("核电", "核能", "反应堆", "核岛")

def _score_budget(budget_wan: Optional[float]) -> tuple[int, str, str]:
    """投资额维度：0-3 分。>= 50 万走硬指标，此处不兜底到 A。"""
    if budget_wan is None:
        return 0, "未填写", "无数据默认给 0 分，请人工确认"
    b = float(budget_wan)
    if b < 5:   return 0, f"{b:g} 万", "< 5 万"
    if b < 10:  return 1, f"{b:g} 万", "5–10 万"
    if b < 30:  return 2, f"{b:g} 万", "10–30 万"
    if b < 50:  return 3, f"{b:g} 万", "30–50 万"
    # 50+ 理论上已被硬指标接管
    return 3, f"{b:g} 万", "≥ 50 万（已命中硬指标）"


def _score_period(months: Optional[int]) -> tuple[int, str, str]:
    """实施周期维度：0-3 分（单位月）"""
    if months is None:
        return 1, "未填写", "无数据默认给 1 分（中等），请人工确认"
    m = int(months)
    if m <= 1:   return 0, f"{m} 个月", "≤ 1 个月"
    if m <= 3:   return 1, f"{m} 个月", "1–3 个月"
    if m <= 6:   return 2, f"{m} 个月", "3–6 个月"
    return 3, f"{m} 个月", "6 个月以上"


def _score_dept_span(sites: Optional[list]) -> tuple[int, str, str]:
    """协同部门数维度：用 improvement_site 列表长度代理。>= 3 是硬 A。"""
    count = len(sites or [])
    if count == 0:
        return 0, "未填写", "无改造场地信息，按 1 处理"
    if count == 1:   return 0, "1 个场地", "单部门项目"
    if count == 2:   return 1, "2 个场地", "2 个部门协同"
    if count == 3:   return 2, "3 个场地", "3 个部门协同（接近硬指标阈值）"
    return 3, f"{count} 个场地", "≥ 4 个部门协同"


def _score_innovation(project: models.Project) -> tuple[int, str, str, bool]:
    """
    创新程度维度：0-3 分。
    这一维没有结构化字段，用规则近似 + 标记 manual=True 提醒人工确认。
    """
    tags = [t.replace("#", "") for t in (project.tags or [])]
    methods = project.improvement_method or []
    purposes = project.improvement_purpose or []

    # 先看标签里的强信号
    if any(k in t for t in tags for k in ("自主创新", "首创", "集团首台", "首台套")):
        return 3, "/".join(tags) or "标签命中", "标签含首台套/自主创新", True
    if "技术改造" in methods and "工艺改善" in purposes:
        return 2, "技术改造+工艺改善", "方法+目的组合，引进新方法", True
    if "技术改造" in methods:
        return 1, "技术改造", "常规技改，改善工艺", True
    return 0, "/".join(methods) or "备件/小改", "备件更换 / 小改小革", True


def auto_score_project(project: models.Project) -> dict:
    """
    基于项目当前字段按《ABC 项目分类执行建议.md》打分。
    4 个维度（投资额 / 实施周期 / 协同部门数 / 创新程度）各 0-3 分，总分上限 12。
    「失败冲击」因缺乏结构化字段，本版本不纳入自动打分。
    不落库，结果仅供参考。
    """
    tags = [t.replace("#", "") for t in (project.tags or [])]
    title = project.title or ""

    # ---- 硬指标判定：命中任一条 → 直接 A ----
    hard_hit: Optional[str] = None

    # 战略性项目（用户约定：标签含「战略性项目」/「战略」= 集团意志 = A）
    if any(("战略性项目" in t) or (t == "战略") or (t.startswith("战略")) for t in tags):
        hard_hit = "标签含「战略性项目」（集团战略意志）"
    # 核电类
    elif any(k in title for k in _NUCLEAR_KEYWORDS) or any(k in t for t in tags for k in _NUCLEAR_KEYWORDS):
        hard_hit = "涉及核电/核能（制度红线）"
    # 投资 ≥ 50 万
    elif project.budget is not None and float(project.budget) >= 50:
        hard_hit = f"投资 {project.budget:g} 万 ≥ 50 万"
    # 跨 3+ 部门（改造场地 ≥ 3）
    elif len(project.improvement_site or []) >= 3:
        hard_hit = f"协同 {len(project.improvement_site)} 个场地 ≥ 3（跨部门）"
    # 专家评审 / 第一类 / 领导点名（标签约定）
    elif any(k in t for t in tags for k in ("专家评审", "第一类", "总办关注", "集团关注")):
        hard_hit = "标签命中硬指标（专家评审/领导点名）"

    # ---- 打分维度 ----
    s1, v1, r1 = _score_budget(project.budget)
    s2, v2, r2 = _score_period(project.implementation_period)
    s3, v3, r3 = _score_dept_span(project.improvement_site)
    s4, v4, r4, m4 = _score_innovation(project)

    breakdown = [
        {"dim": "投资额",       "value": v1, "score": s1, "rationale": r1, "manual": False},
        {"dim": "实施周期",     "value": v2, "score": s2, "rationale": r2, "manual": False},
        {"dim": "协同部门数",   "value": v3, "score": s3, "rationale": r3, "manual": False},
        {"dim": "创新程度",     "value": v4, "score": s4, "rationale": r4, "manual": m4},
    ]
    total = s1 + s2 + s3 + s4

    # ---- 最终等级（满分 12，按比例对应原 5 维 15 分的 10/5/4 阈值） ----
    if hard_hit:
        suggested = models.ProjectPriority.A
    elif total >= 8:
        suggested = models.ProjectPriority.A
    elif total >= 4:
        suggested = models.ProjectPriority.B
    else:
        suggested = models.ProjectPriority.C

    # 把打分结果"缓存"到项目字段（priority_score），不改变 priority 本身
    project.priority_score = total

    note = None
    if any(d["manual"] for d in breakdown):
        note = "「创新程度」维度缺少结构化字段，建议人工确认。"

    return {
        "project_id": project.id,
        "project_title": project.title,
        "suggested_priority": suggested,
        "total_score": total,
        "hard_hit": hard_hit,
        "breakdown": breakdown,
        "note": note,
    }

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
