from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, Query, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import os
import io
import uuid
import jwt
import shutil
import openpyxl
import pandas as pd
import zipfile
import re
from datetime import datetime, timedelta
from pathlib import Path
from urllib.parse import quote

from . import models, schemas, crud
from .database import engine, get_db

# Ensure uploads directory exists
UPLOAD_DIR = Path(__file__).parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# In production use Alembic. Here we create tables directly on startup for simplicity.
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="技改项目智能调度中枢 API")

# CORS配置 - 开发环境允许所有来源
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,  # 使用通配符时不能为True
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded files statically
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

JWT_SECRET = os.getenv("JWT_SECRET", "super-secret-key-123")

@app.get("/")
def root():
    return {"message": "Welcome to CompanyHub AI API"}

# ---- 项目主业务接口 ----

@app.post("/api/projects/import")
async def import_projects(file: UploadFile = File(...), db: Session = Depends(get_db)):
    content = await file.read()
    try:
        wb = openpyxl.load_workbook(filename=io.BytesIO(content), data_only=True)
        sheet = wb.active
        
        imported_count = 0
        skipped_count = 0

        # 表头行检测（支持第2行或第3行作为表头）
        header_row = None
        for row_idx in [2, 3]:  # 尝试第2行和第3行
            test_row = list(sheet.iter_rows(min_row=row_idx, max_row=row_idx, values_only=True))[0]
            if any('项目编号' in str(cell) or '项目名称' in str(cell) for cell in test_row if cell):
                header_row = row_idx
                break
        
        data_start_row = header_row + 1 if header_row else 4
        
        # 获取表头并建立列名映射
        headers = list(sheet.iter_rows(min_row=header_row, max_row=header_row, values_only=True))[0] if header_row else []
        header_map = {}
        for idx, h in enumerate(headers):
            if h:
                header_map[str(h).strip()] = idx
        
        # 查找关键字段的列索引（支持多种表头别名）
        def find_column(*aliases):
            for alias in aliases:
                if alias in header_map:
                    return header_map[alias]
            return None
        
        col_title = find_column('项目名称', '项目标题', 'name', 'title') or 4
        col_dept = find_column('申报单位', '部门', 'department', 'dept') or 1
        col_project_no = find_column('项目编号', '编号', 'project_no', 'no') or 0
        # 优先使用 F项目实施负责人/F项目主要参与人员，同时兼容之前的别名
        col_leader = find_column('F项目实施负责人', '项目实施负责人', '负责人', 'leader', '项目经理') or 39
        col_participants = find_column('F项目主要参与人员', '项目主要参与人员', '参与人员', 'participants', '成员') or 41
        
        # 标签列映射（从第7列开始）
        tag_columns = {
            7: "长材厂",
            8: "大棒厂", 
            9: "特钢厂",
            10: "涂层厂",
            11: "特冶厂",
            12: "电渣车间",
            13: "炼钢厂",
            14: "改造场地其他",
            16: "富钢",
            17: "盛特隆",
            18: "富佰",
            19: "隆毅",
            23: "工艺改善",
            24: "节能降耗",
            25: "质量提升",
            26: "成本优化",
            27: "产业提升",
            28: "安全环保",
            29: "布局优化",
            30: "信息化",
            34: "管理创新",
            35: "技术改造",
            36: "新产品新工艺",
            37: "战略性项目",
        }

        for row in sheet.iter_rows(min_row=data_start_row, values_only=True):
            if not row:
                continue
            
            # 获取项目编号（D列）
            project_code = str(row[col_project_no]).strip() if col_project_no < len(row) and row[col_project_no] and str(row[col_project_no]).strip() not in ['None', ''] else None
            
            # 获取项目名称（关键字段）
            title = str(row[col_title]).strip() if row[col_title] and str(row[col_title]).strip() not in ['None', ''] else None
            if not title:
                continue
            
            # 获取部门
            department = str(row[col_dept]).strip() if row[col_dept] and str(row[col_dept]).strip() not in ['None', ''] else "未知部门"
            
            # 获取负责人
            leader = str(row[col_leader]).strip() if col_leader < len(row) and row[col_leader] and str(row[col_leader]).strip() not in ['None', ''] else None
            
            # 获取参与人员（解析逗号、顿号分隔的字符串）
            participants = []
            if col_participants < len(row) and row[col_participants]:
                participants_str = str(row[col_participants]).strip()
                if participants_str and participants_str != 'None':
                    # 支持顿号、逗号、空格分隔
                    import re
                    participants = [p.strip() for p in re.split('[、,，\s]+', participants_str) if p.strip()]
            
            # 构建标签列表
            tags = ["#实施中"]  # 默认标签
            
            for col_idx, tag_name in tag_columns.items():
                if col_idx < len(row) and row[col_idx]:
                    val = str(row[col_idx]).strip()
                    if val in ['勾选', '是', '✓', '√', 'True', '1']:
                        tags.append(f"#{tag_name}")
            
            # 检查是否已存在（按标题去重）
            existing = crud.get_project_by_title(db, title=title)
            if existing:
                skipped_count += 1
                continue
            
            # 创建项目
            project_data = schemas.ProjectCreate(
                title=title,
                project_code=project_code,
                department=department,
                leader=leader,
                participants=participants,
                tags=tags,
                status=models.ProjectStatus.in_progress
            )
            crud.create_project(db, project_data)
            imported_count += 1
            
        return {
            "message": f"解析完毕，成功导入 {imported_count} 个新项目，跳过 {skipped_count} 个已存在的项目。",
            "imported": imported_count,
            "skipped": skipped_count
        }
        
    except Exception as e:
        import traceback
        raise HTTPException(status_code=400, detail=f"文件解析失败: {str(e)}\n{traceback.format_exc()}")

@app.post("/api/projects", response_model=schemas.ProjectResponse)
def create_project(project: schemas.ProjectCreate, db: Session = Depends(get_db)):
    return crud.create_project(db, project)

@app.get("/api/projects", response_model=List[schemas.ProjectResponse])
def read_projects(keyword: str = "", tags: str = "", db: Session = Depends(get_db)):
    tags_list = tags.split(",") if tags else []
    return crud.search_projects(db, keyword=keyword, tags=tags_list)

@app.get("/api/projects/{id}", response_model=schemas.ProjectResponse)
def read_project(id: uuid.UUID, db: Session = Depends(get_db)):
    project = crud.get_project(db, id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@app.put("/api/projects/{id}", response_model=schemas.ProjectResponse)
def update_project(id: uuid.UUID, updates: schemas.ProjectUpdate, db: Session = Depends(get_db)):
    # 获取原项目信息
    db_project = crud.get_project(db, id)
    if not db_project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # 检查是否修改了 end_date
    old_end_date = db_project.end_date
    new_end_date = updates.end_date if hasattr(updates, 'end_date') and updates.end_date is not None else None
    
    # 如果修改了 end_date 且不为空，检查是否提供了 delay_reason
    if new_end_date is not None and old_end_date != new_end_date:
        if not updates.delay_reason or updates.delay_reason.strip() == "":
            raise HTTPException(status_code=400, detail="修改结项时间必须提供延期原因")
        
        # 创建延期历史记录
        crud.create_delay_history(
            db, 
            project_id=id,
            old_end_date=old_end_date,
            new_end_date=new_end_date,
            reason=updates.delay_reason,
            changed_by="系统"  # 可以从请求中获取当前用户
        )
    
    project = crud.update_project(db, id, updates)
    return project


@app.get("/api/projects/{id}/delay-history", response_model=List[schemas.ProjectDelayHistoryResponse])
def get_project_delay_history(id: uuid.UUID, db: Session = Depends(get_db)):
    """获取项目延期历史"""
    project = crud.get_project(db, id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return crud.get_delay_history(db, id)

@app.put("/api/projects/{id}/complete", response_model=schemas.ProjectResponse)
def complete_project(id: uuid.UUID, db: Session = Depends(get_db)):
    project = crud.complete_project(db, id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@app.post("/api/projects/{id}/tags", response_model=schemas.ProjectResponse)
def add_project_tag(id: uuid.UUID, payload: dict, db: Session = Depends(get_db)):
    """添加标签到项目"""
    project = crud.get_project(db, id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    tag = payload.get("tag", "").strip()
    if not tag:
        raise HTTPException(status_code=400, detail="标签不能为空")
    
    # 确保标签以 # 开头
    if not tag.startswith("#"):
        tag = "#" + tag
    
    # 检查是否已存在
    current_tags = list(project.tags or [])
    if tag in current_tags:
        raise HTTPException(status_code=400, detail="标签已存在")
    
    current_tags.append(tag)
    project.tags = current_tags
    db.commit()
    db.refresh(project)
    return project

@app.delete("/api/projects/{id}/tags/{tag}", response_model=schemas.ProjectResponse)
def remove_project_tag(id: uuid.UUID, tag: str, db: Session = Depends(get_db)):
    """从项目中删除标签"""
    project = crud.get_project(db, id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # URL 解码标签
    from urllib.parse import unquote
    tag = unquote(tag)
    
    current_tags = list(project.tags or [])
    if tag not in current_tags:
        raise HTTPException(status_code=404, detail="标签不存在")
    
    current_tags.remove(tag)
    project.tags = current_tags
    db.commit()
    db.refresh(project)
    return project

# ---- 文件管理接口 ----

@app.get("/api/projects/{id}/files", response_model=List[schemas.ProjectFileResponse])
def get_project_files(id: uuid.UUID, db: Session = Depends(get_db)):
    """获取项目下的所有文件列表"""
    project = crud.get_project(db, id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return crud.get_project_files(db, id)

@app.post("/api/projects/{id}/files", response_model=schemas.ProjectFileResponse)
async def upload_project_file(
    id: uuid.UUID,
    file_type: str = Form(...),
    uploaded_by: str = Form("匿名"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    上传文件到项目资料池
    存储路径规范：uploads/{project_id}/{file_type}/{filename}
    """
    project = crud.get_project(db, id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # 验证并转换 file_type
    type_map = {
        "application": models.FileType.application,
        "ppt": models.FileType.ppt,
        "free_resource": models.FileType.free_resource,
    }
    ft = type_map.get(file_type)
    if not ft:
        raise HTTPException(status_code=400, detail=f"不支持的文件类型: {file_type}，可选: application, ppt, free_resource")

    # 获取原始文件名和扩展名
    original_name = file.filename or "unknown"
    ext = Path(original_name).suffix.lower()
    safe_filename = f"{uuid.uuid4().hex}{ext}"

    # 构建分层存储路径：uploads/{project_id}/{file_type}/
    project_dir = UPLOAD_DIR / str(id) / file_type
    project_dir.mkdir(parents=True, exist_ok=True)
    
    storage_path = project_dir / safe_filename
    relative_path = f"uploads/{id}/{file_type}/{safe_filename}"

    # 读取文件内容并保存
    content = await file.read()
    file_size = len(content)
    
    with open(storage_path, "wb") as buffer:
        buffer.write(content)

    # 保存到数据库
    file_data = schemas.ProjectFileCreate(
        file_type=ft,
        original_name=original_name
    )
    db_file = crud.add_project_file_v2(db, id, file_data, relative_path, file_size, uploaded_by)

    # 如果是结项PPT，自动更新项目状态
    if ft == models.FileType.ppt:
        tags = list(project.tags or [])
        tags = [t for t in tags if t not in ["#实施中"]]
        if "#待结项" not in tags:
            tags.append("#待结项")
        project.tags = tags
        project.status = models.ProjectStatus.pending_completion
        db.commit()

    return db_file

@app.get("/api/files/{file_id}/download")
def download_single_file(file_id: uuid.UUID, db: Session = Depends(get_db)):
    """单文件下载"""
    file_record = crud.get_file_by_id(db, file_id)
    if not file_record:
        raise HTTPException(status_code=404, detail="文件不存在")
    
    file_path = UPLOAD_DIR.parent / file_record.storage_path
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="文件已丢失")
    
    # RFC 5987 编码中文文件名
    encoded_filename = quote(file_record.original_name, safe='')
    
    return StreamingResponse(
        open(file_path, "rb"),
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}",
            "Content-Length": str(file_record.file_size)
        }
    )

@app.post("/api/files/download/batch")
def download_batch_files(file_ids: List[str], db: Session = Depends(get_db)):
    """
    批量下载文件（打包成ZIP）
    file_ids: 文件ID列表
    """
    if not file_ids or len(file_ids) == 0:
        raise HTTPException(status_code=400, detail="请选择要下载的文件")
    
    # 获取所有文件记录
    files_to_zip = []
    for fid in file_ids:
        try:
            file_record = crud.get_file_by_id(db, uuid.UUID(fid))
            if file_record:
                file_path = UPLOAD_DIR.parent / file_record.storage_path
                if file_path.exists():
                    files_to_zip.append({
                        "path": file_path,
                        "name": file_record.original_name
                    })
        except:
            continue
    
    if len(files_to_zip) == 0:
        raise HTTPException(status_code=404, detail="未找到可下载的文件")
    
    # 单文件直接返回
    if len(files_to_zip) == 1:
        file_info = files_to_zip[0]
        encoded_name = quote(file_info["name"], safe='')
        return StreamingResponse(
            open(file_info["path"], "rb"),
            media_type="application/octet-stream",
            headers={"Content-Disposition": f"attachment; filename*=UTF-8''{encoded_name}"}
        )
    
    # 多文件打包成ZIP（流式传输）
    def iter_zip():
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
            for file_info in files_to_zip:
                zf.write(file_info["path"], file_info["name"])
                buffer.seek(0)
                data = buffer.read()
                if data:
                    yield data
                buffer.seek(0)
                buffer.truncate()
        buffer.seek(0)
        remaining = buffer.read()
        if remaining:
            yield remaining

    # RFC 5987 编码中文文件名
    encoded_filename = quote("下载文件.zip", safe='')
    
    return StreamingResponse(
        iter_zip(),
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"}
    )

@app.delete("/api/files/{file_id}")
def delete_file(file_id: uuid.UUID, db: Session = Depends(get_db)):
    """删除文件"""
    file_record = crud.get_file_by_id(db, file_id)
    if not file_record:
        raise HTTPException(status_code=404, detail="文件不存在")
    
    # 删除物理文件
    file_path = UPLOAD_DIR.parent / file_record.storage_path
    if file_path.exists():
        file_path.unlink()
    
    # 删除数据库记录
    success = crud.delete_file(db, file_id)
    if not success:
        raise HTTPException(status_code=500, detail="删除失败")
    
    return {"message": "删除成功"}

# ---- 周期更新记录接口（原里程碑接口） ----

@app.get("/api/projects/{id}/milestones", response_model=List[schemas.MilestoneResponse])
def get_project_milestones(id: uuid.UUID, db: Session = Depends(get_db)):
    """获取项目的周期更新记录（里程碑）"""
    project = crud.get_project(db, id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return crud.get_milestones(db, id)

@app.post("/api/projects/{id}/milestones", response_model=schemas.MilestoneResponse)
def create_project_milestone(id: uuid.UUID, update: schemas.MilestoneCreate, db: Session = Depends(get_db)):
    """创建周期更新记录（里程碑）"""
    project = crud.get_project(db, id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return crud.create_milestone(db, id, update)

@app.delete("/api/milestones/{milestone_id}")
def delete_project_milestone(milestone_id: uuid.UUID, db: Session = Depends(get_db)):
    """删除周期更新记录（里程碑）"""
    success = crud.delete_milestone(db, milestone_id)
    if not success:
        raise HTTPException(status_code=404, detail="Milestone not found")
    return {"message": "删除成功"}

# ---- 二维码与权限沙盒 ----

@app.post("/api/projects/{id}/generate_qr")
def generate_qr(id: uuid.UUID, db: Session = Depends(get_db)):
    project = crud.get_project(db, id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    expire = datetime.utcnow() + timedelta(days=7)
    token = jwt.encode({"sub": str(id), "exp": expire}, JWT_SECRET, algorithm="HS256")
    url = f"/guest/project/{token}"
    return {"qr_url": url, "token": token}

@app.get("/api/guest/projects/{token}", response_model=schemas.ProjectResponse)
def guest_read_project(token: str, db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        project_id = uuid.UUID(payload.get("sub"))
        return read_project(project_id, db)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ---- AI 审批接口 ----

@app.get("/api/ai_actions/pending", response_model=List[schemas.AIPendingActionResponse])
def get_pending_actions(db: Session = Depends(get_db)):
    return crud.get_pending_actions(db)

@app.post("/api/ai_actions/{id}/approve", response_model=schemas.AIPendingActionResponse)
def approve_action(id: uuid.UUID, payload: dict, db: Session = Depends(get_db)):
    action = crud.approve_action(db, id, payload)
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")
    
    if action.action_type == models.ActionType.add_milestone:
        deadline_str = payload.get("deadline")
        deadline = datetime.fromisoformat(deadline_str) if deadline_str else None
        
        milestone_data = schemas.MilestoneCreate(
            title=payload.get("title", "未命名里程碑"),
            deadline=deadline
        )
        crud.create_milestone(db, action.project_id, milestone_data)
    
    return action

@app.delete("/api/ai_actions/{id}")
def delete_action(id: uuid.UUID, db: Session = Depends(get_db)):
    success = crud.delete_action(db, id)
    if not success:
        raise HTTPException(status_code=404, detail="Action not found")
    return {"message": "Deleted"}

# ---- 项目固化记录接口（Timeline Snapshot） ----

@app.post("/api/upload/images")
async def upload_images(files: List[UploadFile] = File(...)):
    """
    批量上传图片接口
    存储路径：uploads/images/{uuid}.{ext}
    返回：图片URL列表
    """
    # 确保图片目录存在
    images_dir = UPLOAD_DIR / "images"
    images_dir.mkdir(parents=True, exist_ok=True)
    
    uploaded_urls = []
    
    for file in files:
        if not file.content_type or not file.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail=f"文件 {file.filename} 不是图片格式")
        
        # 生成唯一文件名
        ext = Path(file.filename or "").suffix.lower() or ".jpg"
        if ext not in ['.jpg', '.jpeg', '.png', '.gif', '.webp']:
            ext = '.jpg'
        safe_filename = f"{uuid.uuid4().hex}{ext}"
        
        # 保存文件
        file_path = images_dir / safe_filename
        content = await file.read()
        
        with open(file_path, "wb") as buffer:
            buffer.write(content)
        
        # 返回相对URL
        uploaded_urls.append(f"/uploads/images/{safe_filename}")
    
    return {"image_urls": uploaded_urls}

@app.get("/api/projects/{id}/updates", response_model=List[schemas.ProjectUpdateResponse])
def get_project_updates(id: uuid.UUID, db: Session = Depends(get_db)):
    """获取项目的固化记录列表（按时间倒序）"""
    project = crud.get_project(db, id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return crud.get_project_updates(db, id)

@app.post("/api/projects/{id}/updates", response_model=schemas.ProjectUpdateResponse, status_code=201)
def create_project_update(id: uuid.UUID, update: schemas.ProjectUpdateCreate, db: Session = Depends(get_db)):
    """创建项目固化记录"""
    project = crud.get_project(db, id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # 验证：必须有内容或图片
    if not update.content.strip() and not update.image_urls:
        raise HTTPException(status_code=400, detail="汇报内容和图片不能同时为空")
    
    return crud.create_project_update(db, id, update)

# ---- AI 配置中心接口 (通义千问) ----

@app.get("/api/ai-configs", response_model=List[schemas.AIConfigListResponse])
def get_ai_configs(db: Session = Depends(get_db)):
    """获取AI配置列表（隐藏API Key）"""
    return crud.get_ai_configs(db)

@app.get("/api/ai-configs/{config_id}", response_model=schemas.AIConfigResponse)
def get_ai_config(config_id: uuid.UUID, db: Session = Depends(get_db)):
    """获取单个AI配置详情"""
    config = crud.get_ai_config(db, config_id)
    if not config:
        raise HTTPException(status_code=404, detail="Config not found")
    return config

@app.post("/api/ai-configs", response_model=schemas.AIConfigResponse)
def create_ai_config(config: schemas.AIConfigCreate, db: Session = Depends(get_db)):
    """创建AI配置"""
    return crud.create_ai_config(db, config)

@app.put("/api/ai-configs/{config_id}", response_model=schemas.AIConfigResponse)
def update_ai_config(config_id: uuid.UUID, updates: schemas.AIConfigUpdate, db: Session = Depends(get_db)):
    """更新AI配置"""
    config = crud.update_ai_config(db, config_id, updates)
    if not config:
        raise HTTPException(status_code=404, detail="Config not found")
    return config

@app.delete("/api/ai-configs/{config_id}")
def delete_ai_config(config_id: uuid.UUID, db: Session = Depends(get_db)):
    """删除AI配置"""
    success = crud.delete_ai_config(db, config_id)
    if not success:
        raise HTTPException(status_code=404, detail="Config not found")
    return {"message": "删除成功"}

@app.post("/api/ai-configs/{config_id}/activate")
def activate_ai_config(config_id: uuid.UUID, db: Session = Depends(get_db)):
    """激活指定AI配置"""
    config = crud.set_active_config(db, config_id)
    if not config:
        raise HTTPException(status_code=404, detail="Config not found")
    return config

@app.get("/api/ai-configs/active", response_model=schemas.AIConfigResponse)
def get_active_ai_config(db: Session = Depends(get_db)):
    """获取当前启用的AI配置"""
    config = crud.get_active_ai_config(db)
    if not config:
        raise HTTPException(status_code=404, detail="No active config found")
    return config

# ---- 数据导出接口 ----

@app.get("/api/projects/export/excel")
def export_projects_excel(
    keyword: str = "",
    tags: str = "",
    db: Session = Depends(get_db)
):
    """
    导出项目数据为Excel文件
    """
    try:
        # 查询项目数据
        tags_list = tags.split(",") if tags else []
        projects = crud.search_projects(db, keyword=keyword, tags=tags_list)
        
        # 构建DataFrame数据
        data = []
        for p in projects:
            data.append({
                "项目编号": str(p.id)[:8],
                "项目名称": p.title,
                "申报单位": p.department,
                "项目负责人": p.leader or "",
                "参与人员": "、".join(p.participants) if p.participants else "",
                "项目状态": p.status.value if p.status else "",
                "标签": " ".join(p.tags) if p.tags else "",
                "创建时间": p.created_at.strftime("%Y-%m-%d") if p.created_at else "",
            })
        
        df = pd.DataFrame(data)
        
        # 创建内存中的Excel文件
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name='项目清单', index=False)
            
            # 获取worksheet并调整列宽
            worksheet = writer.sheets['项目清单']
            for column in worksheet.columns:
                max_length = 0
                column_letter = column[0].column_letter
                for cell in column:
                    try:
                        if len(str(cell.value)) > max_length:
                            max_length = len(str(cell.value))
                    except:
                        pass
                adjusted_width = min(max_length + 2, 50)
                worksheet.column_dimensions[column_letter].width = adjusted_width
        
        output.seek(0)
        
        # 生成文件名
        filename = f"项目清单_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        
        # RFC 5987 编码中文文件名
        encoded_filename = quote(filename, safe='')
        
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"}
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导出失败: {str(e)}")


@app.get("/api/projects/export/zip")
def export_projects_zip(
    project_id: Optional[str] = Query(None, description="指定项目ID，不指定则导出所有"),
    tag: Optional[str] = Query(None, description="按标签筛选"),
    db: Session = Depends(get_db)
):
    """
    打包下载项目文件（流式传输，防止内存溢出）
    按项目名称自动创建文件夹结构
    """
    try:
        # 获取项目列表
        if project_id:
            try:
                pid = uuid.UUID(project_id)
                project = crud.get_project(db, pid)
                projects = [project] if project else []
            except:
                projects = []
        else:
            projects = crud.search_projects(db, keyword="", tags=[tag] if tag else [])
        
        if not projects:
            raise HTTPException(status_code=404, detail="未找到符合条件的项目")
        
        # 收集所有需要打包的文件
        files_to_zip = []
        for project in projects:
            project_files = crud.get_project_files(db, project.id)
            for f in project_files:
                file_path = UPLOAD_DIR / Path(f.file_url).name
                if file_path.exists():
                    # 安全的文件夹名称（移除非法字符）
                    safe_folder = re.sub(r'[<>:"/\\|?*]', '_', project.title)[:50]
                    files_to_zip.append({
                        "path": file_path,
                        "arcname": f"{safe_folder}/{f.file_type.value}/{f.original_name}"
                    })
        
        if not files_to_zip:
            raise HTTPException(status_code=404, detail="未找到可下载的文件")
        
        # 流式生成ZIP文件
        def iter_zip():
            """
            使用生成器流式输出ZIP文件，避免内存溢出
            """
            buffer = io.BytesIO()
            with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
                for file_info in files_to_zip:
                    # 逐个添加文件到ZIP
                    zf.write(file_info["path"], file_info["arcname"])
                    # 每添加一个文件就刷新缓冲区
                    buffer.seek(0)
                    data = buffer.read()
                    if data:
                        yield data
                    buffer.seek(0)
                    buffer.truncate()
            
            # 最后刷新剩余数据
            buffer.seek(0)
            remaining = buffer.read()
            if remaining:
                yield remaining
        
        # 生成文件名
        if project_id and len(projects) == 1:
            safe_name = re.sub(r'[<>:"/\\|?*]', '_', projects[0].title)[:30]
            filename = f"{safe_name}_文件包.zip"
        else:
            filename = f"项目文件包_{datetime.now().strftime('%Y%m%d_%H%M%S')}.zip"
        
        # RFC 5987 编码中文文件名
        encoded_filename = quote(filename, safe='')
        
        return StreamingResponse(
            iter_zip(),
            media_type="application/zip",
            headers={"Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"打包下载失败: {str(e)}")


@app.get("/api/projects/{id}/export/zip")
def export_single_project_zip(id: uuid.UUID, db: Session = Depends(get_db)):
    """
    导出单个项目的所有文件为ZIP
    """
    project = crud.get_project(db, id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    return export_projects_zip(project_id=str(id), db=db)


# ---- 外部协同门户 JWT 认证 ----

class PortalTokenPayload:
    """门户 JWT Token 数据结构"""
    def __init__(self, project_ids: List[str], exp: datetime, iat: datetime):
        self.project_ids = project_ids
        self.exp = exp
        self.iat = iat

def create_portal_token(project_ids: List[str], expires_days: int = 7) -> str:
    """
    创建外部协同门户 JWT Token
    """
    now = datetime.utcnow()
    payload = {
        "sub": "portal",  # 主题标识
        "project_ids": project_ids,  # 可访问的项目ID列表
        "iat": now,  # 签发时间
        "exp": now + timedelta(days=expires_days),  # 过期时间
        "type": "portal"  # Token 类型
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

def verify_portal_token(token: str) -> PortalTokenPayload:
    """
    验证门户 JWT Token
    """
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        
        # 验证 Token 类型
        if payload.get("type") != "portal":
            raise HTTPException(status_code=401, detail="无效的 Token 类型")
        
        return PortalTokenPayload(
            project_ids=payload.get("project_ids", []),
            exp=datetime.fromtimestamp(payload["exp"]),
            iat=datetime.fromtimestamp(payload["iat"])
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token 已过期")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="无效的 Token")

async def get_portal_auth(authorization: Optional[str] = Header(None)) -> PortalTokenPayload:
    """
    FastAPI 依赖：从请求头获取并验证门户 Token
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="缺少认证信息")
    
    # 支持 Bearer token 格式
    if authorization.startswith("Bearer "):
        token = authorization[7:]
    else:
        token = authorization
    
    return verify_portal_token(token)

@app.post("/api/portal/auth")
def portal_login(credentials: dict, db: Session = Depends(get_db)):
    """
    外部协同门户登录接口 - 极简模式：只输入姓名即可查看
    请求体: { "name": "姓名" }
    """
    name = credentials.get("name", "").strip()
    
    if not name:
        raise HTTPException(status_code=400, detail="姓名不能为空")
    
    # 查找该姓名关联的项目（通过负责人或参与人员匹配）
    all_projects = crud.search_projects(db, keyword="", tags=[])
    accessible_projects = []
    
    for project in all_projects:
        # 匹配姓名（模糊匹配）
        leader_match = project.leader and name in project.leader
        participant_match = any(name in str(p) for p in (project.participants or []))
        if leader_match or participant_match:
            accessible_projects.append(str(project.id))
    
    # 生成 JWT Token
    token = create_portal_token(accessible_projects, expires_days=7)
    
    return {
        "token": token,
        "expires_in": 7 * 24 * 3600,  # 7天，单位秒
        "project_ids": accessible_projects,
        "name": name
    }

@app.get("/api/portal/projects", response_model=List[schemas.ProjectResponse])
def get_portal_projects(auth: PortalTokenPayload = Depends(get_portal_auth), db: Session = Depends(get_db)):
    """
    获取当前门户用户可访问的项目列表
    """
    if not auth.project_ids:
        return []  # 没有可访问的项目
    
    projects = []
    for pid_str in auth.project_ids:
        try:
            project = crud.get_project(db, uuid.UUID(pid_str))
            if project:
                projects.append(project)
        except:
            continue
    
    return projects

@app.get("/api/portal/projects/{id}", response_model=schemas.ProjectResponse)
def get_portal_project_detail(id: uuid.UUID, auth: PortalTokenPayload = Depends(get_portal_auth), db: Session = Depends(get_db)):
    """
    获取单个项目详情（门户用户）
    """
    # 验证是否有权限访问该项目
    if str(id) not in auth.project_ids:
        raise HTTPException(status_code=403, detail="无权访问该项目")
    
    project = crud.get_project(db, id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    return project

@app.get("/api/portal/projects/{id}/files", response_model=List[schemas.ProjectFileResponse])
def get_portal_project_files(id: uuid.UUID, auth: PortalTokenPayload = Depends(get_portal_auth), db: Session = Depends(get_db)):
    """
    获取项目文件列表（门户用户）
    """
    if str(id) not in auth.project_ids:
        raise HTTPException(status_code=403, detail="无权访问该项目")
    
    return crud.get_project_files(db, id)

@app.get("/api/portal/projects/{id}/updates", response_model=List[schemas.ProjectUpdateResponse])
def get_portal_project_updates(id: uuid.UUID, auth: PortalTokenPayload = Depends(get_portal_auth), db: Session = Depends(get_db)):
    """
    获取项目固化记录（门户用户）
    """
    if str(id) not in auth.project_ids:
        raise HTTPException(status_code=403, detail="无权访问该项目")
    
    return crud.get_project_updates(db, id)


# ---- 标签分享链接功能 ----

class TagShareTokenPayload:
    """标签分享 Token 数据结构"""
    def __init__(self, tag: str, exp: datetime, iat: datetime):
        self.tag = tag
        self.exp = exp
        self.iat = iat

def create_tag_share_token(tag: str, expires_days: int = 7) -> str:
    """
    创建标签分享链接的 JWT Token
    """
    now = datetime.utcnow()
    payload = {
        "sub": "tag_share",
        "tag": tag,
        "iat": now,
        "exp": now + timedelta(days=expires_days),
        "type": "tag_share"
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

def verify_tag_share_token(token: str) -> TagShareTokenPayload:
    """
    验证标签分享 Token
    """
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        
        if payload.get("type") != "tag_share":
            raise HTTPException(status_code=401, detail="无效的 Token 类型")
        
        return TagShareTokenPayload(
            tag=payload.get("tag", ""),
            exp=datetime.fromtimestamp(payload["exp"]),
            iat=datetime.fromtimestamp(payload["iat"])
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="分享链接已过期")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="无效的分享链接")

@app.post("/api/tags/share")
def generate_tag_share_link(payload: dict, db: Session = Depends(get_db)):
    """
    生成标签分享链接
    请求体: { "tag": "#富钢", "expires_days": 7 }
    """
    tag = payload.get("tag", "").strip()
    expires_days = payload.get("expires_days", 7)
    
    if not tag:
        raise HTTPException(status_code=400, detail="标签不能为空")
    
    # 确保标签以 # 开头
    if not tag.startswith("#"):
        tag = "#" + tag
    
    # 验证标签是否存在（至少有一个项目使用此标签）
    all_projects = crud.search_projects(db, keyword="", tags=[tag])
    if not all_projects:
        raise HTTPException(status_code=404, detail="没有找到使用该标签的项目")
    
    # 生成 Token
    token = create_tag_share_token(tag, expires_days)
    
    # 构建分享链接
    share_url = f"/share/{token}"
    
    return {
        "token": token,
        "share_url": share_url,
        "tag": tag,
        "project_count": len(all_projects),
        "expires_in": expires_days * 24 * 3600
    }

@app.get("/api/share/{token}/projects", response_model=List[schemas.ProjectResponse])
def get_shared_tag_projects(token: str, db: Session = Depends(get_db)):
    """
    通过分享链接获取标签下的项目列表（免登录）
    """
    auth = verify_tag_share_token(token)
    
    # 搜索该标签下的所有项目
    projects = crud.search_projects(db, keyword="", tags=[auth.tag])
    
    return projects

@app.get("/api/share/{token}/tag")
def get_shared_tag_info(token: str, db: Session = Depends(get_db)):
    """
    获取分享链接的标签信息（免登录）
    """
    auth = verify_tag_share_token(token)
    
    # 统计项目数量
    projects = crud.search_projects(db, keyword="", tags=[auth.tag])
    
    return {
        "tag": auth.tag,
        "project_count": len(projects),
        "expires_at": auth.exp.isoformat()
    }
