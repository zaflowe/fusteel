# 调度台（原AI调度台）深度重构与视觉调整

将调度台界面去过度包装的 AI 描述，回归业务本质，并在左半区重构引入“项目固化历史流”，方便管理者直接在看板宏观监控所有项目现场动态。

## User Review Required

> [!WARNING]
> **数据库表结构调整**：需要在现有的 `project_updates` 表中新增 `remark` 字段来记录备注。由于您使用的是 SQLite，我们将提供自动化 `ALTER TABLE` 脚本直接完成升级，以保证历史数据不受影响。

> [!IMPORTANT]
> **文案配置化**：我们将会新建 `src/config/site.ts` 存放全局导航与标题常量。如果有遗漏需抽离的文案，欢迎在审批阶段提出补充。

## Proposed Changes

### 后端 API 与 数据库更新 (Backend & DB)

#### [MODIFY] `backend/app/models.py`
- 修改 `ProjectUpdate` 模型，增加 `remark = Column(String, nullable=True, comment="备注")` 字段。

#### [NEW] 数据库升级脚本
- （系统自动执行）：在 SQLite 数据库对 `project_updates` 表执行 `ALTER TABLE ADD COLUMN remark VARCHAR;`。

#### [MODIFY] `backend/app/schemas.py`
- 更新 `ProjectUpdateResponse`，加入对 `remark` 的支持。
- 新增 `HistoryItemResponse`，在 `ProjectUpdateResponse` 基础上增加外键级联的项目快照（`project_id`, `project_title`）。
- 新增 `HistoryUpdateRequest`，用于 PATCH 备注更新请求。

#### [MODIFY] `backend/app/crud.py`
- 新增 `get_all_history(db)`：联表查询 `project_updates` 和 `projects`，按 `created_at desc` 排序。
- 新增 `update_history_remark(db, update_id, remark)`：更新指定历史记录的备注信息。

#### [MODIFY] `backend/app/main.py`
- 新增端点 `GET /api/history` 获取时间流全量历史记录。
- 新增端点 `PATCH /api/history/{id}` 供前端随时修改备注。

---

### 前端重构 (Frontend Restructure)

#### [NEW] `frontend/src/config/site.ts`
- 将各类平台展示标题（如 `"调度台"`, `"调度审批中枢"` 等）提炼集中存放，使平台后续文字变更一劳永逸。

#### [MODIFY] `frontend/src/components/Header.tsx`
- 引入 `site.ts` 配置，将之前硬编码的“AI 调度台”替换为配置变量渲染。

#### [MODIFY] `frontend/src/app/ai-scheduler/page.tsx`
- **标题&描述去伪存真**：删除冗杂噱头，标题改为“调度审批中枢”，副标题去 AI 化。
- **页面布局栅格化**：由原来的瀑布流布局切换为 `grid-cols-1 lg:grid-cols-2` 的双栏布局。
- **左侧：项目固化历史流 (Feed)**：
  - 加载刚才增加的 `GET /api/history` 接口数据。
  - 核心要素渲染：提供指向详情页（`/project/{project_id}`）的快捷路由；采用 Next.js `link` 确保无刷体验。
  - 图片渲染与交互：增加 CSS 响应式 `loading="lazy"` 支持，点击调起内联或覆盖全屏的 Lightbox 灯箱预览。
  - 备注模块：展示已有的 remark，并提供直观 Input 与 “保存” 小按钮，提交时执行 `PATCH`，展示 Loading 反馈态（Toast）。
- **右侧：待办动作卡片流 (Actions)**：
  - 维持原来的 AI Pending Actions 流，但视觉上将其作为“右半区子模块”展现。

## Open Questions

> [!TIP]
> 1. Lightbox 灯箱预览采用前端标准的 `Dialog / Modal` 弹出层实现即可，还是您有特定的样式引用要求？
> 2. 调度台左侧历史流水线，获取的“项目固化历史纪录”是否需要限定数量？（默认先做为取最新的 50 条，避免前端过度渲染拖慢性能，您意下如何？）

## Verification Plan

### Automated Tests
1. 重启后检查 FastAPI Swagger 接口表是否成功暴露 `/api/history` 与对应 `PATCH` 且可用。

### Manual Verification
1. 返回浏览器刷新，直接观察导航与“调度审批中枢”名称是否应用常量脱敏。
2. 在该页面左侧，寻找一条拥有现场照片的历史进展卡片，点击照片触发灯箱扩大查看。
3. 在任意卡片下方尝试输入纯文字备注并保存，查看页面是否友好 Toast 提示，且该数据在刷新页面后依然持有。
