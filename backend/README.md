# 技改项目智能中枢 - Backend API

## 1. 环境准备与依赖安装
1. 确保已安装 **Python 3.10+** (并将 python 添加到环境变量)。
2. 确保已安装 **Docker Desktop**（用于秒级启动本地 PostgreSQL 数据库）。
3. 进入 `backend` 目录，创建虚拟环境并安装所有依赖项：
   ```bash
   cd "d:\1工作文件夹\富钢工作文件\01工作文件\02 我的工作\管理创新与技术改造\companyhub\backend"
   python -m venv venv
   
   # Windows 加载虚拟环境:
   venv\Scripts\activate
   
   # 安装所需第三方库:
   pip install -r requirements.txt
   ```

## 2. 启动本地 PostgreSQL 数据库
1. 确保 Docker Engine 正在运行。
2. 在 `backend` 目录下，运行以下命令启动容器：
   ```bash
   docker-compose up -d
   ```
   *附注：上述命令将会在本地 `5432` 端口启动名为 `companyhub` 的 PostgreSQL 数据库，账号为 `myuser`，密码为 `mypassword`。FastAPI 启动时会自动连接并在其中建表。*

## 3. 启动 FastAPI 后端服务
1. 确保仍然处于虚拟环境中 (`(venv)` 标识)。
2. 在 `backend` 目录下，运行以下命令启动应用程序：
   ```bash
   uvicorn app.main:app --reload
   ```

## 4. 可视化测试与验证验证
FastAPI 自带了极具交互性的 Swagger UI (OpenAPI) 文档，您无需编写前端即可对其全量端点进行测试！

服务启动后，打开浏览器访问以下地址：
👉 **http://127.0.0.1:8000/docs**

### 验证流示例 (在 UI 中按顺序列操作):
1. **新增项目并入库**：
   展开 `POST /api/projects` 接口，点击右上角的 **Try it out**。
   填入极简请求体，例如：
   ```json
   {
     "title": "测试自动化项目",
     "department": "涂层厂",
     "tags": ["#自动化"],
     "status": "执行中"
   }
   ```
   点击下方的 **Execute**。在黑色的 Response body 区域应当返回刚创建成功且带 UUID ID 的记录。复制该 ID。

2. **多维搜索与信息获取**：
   展开 `GET /api/projects` 接口，点击 **Try it out**。在 `keyword` 填入 `自动化`，或在 `tags` 填入 `#自动化`，点击 **Execute** 看看是否能成功搜索出上述项目。

3. **测试“极简结项”动作**：
   展开 `PUT /api/projects/{id}/complete` 接口，点击 **Try it out**。将第一步复制的 `id` 黏贴进参数框，点击 **Execute**，观察 `status` 字段是否翻转成了 `已结项`。

4. **测试“动态二维码 (权限沙盒)”签发**：
   展开 `POST /api/projects/{id}/generate_qr`。同样传入项目 ID 执行，应当会返回一串 `token`，该 token 即作为只读 / 沙盒访问该项目的唯一令牌（有效期1周）。
