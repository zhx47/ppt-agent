# PPT Agent Backend

## 启动

项目当前直接复用仓库根目录的 `.env`。

推荐命令：

```bash
PYTHONPATH=backend .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
```

默认接口前缀：

```text
/api/v1
```

## 当前能力

已实现的主链路：

1. 创建项目
2. 初始化研究与需求单生成
3. 需求确认后生成大纲与页面实体
4. 大纲确认后生成页级研究
5. 研究确认后生成初稿 SVG
6. 初稿确认后生成设计稿 SVG
7. 设计确认后导出 PPTX

## 关键接口

```text
GET    /api/v1/projects
POST   /api/v1/projects
GET    /api/v1/projects/{project_id}
GET    /api/v1/projects/{project_id}/messages
POST   /api/v1/projects/{project_id}/messages
GET    /api/v1/projects/{project_id}/events/stream

GET    /api/v1/projects/{project_id}/requirements/form
POST   /api/v1/projects/{project_id}/requirements/answers:batch
POST   /api/v1/projects/{project_id}/requirements/confirm
POST   /api/v1/projects/{project_id}/assets/backgrounds
GET    /api/v1/projects/{project_id}/research-sessions/init-discovery
GET    /api/v1/projects/{project_id}/research-sessions/{session_id}/sources

GET    /api/v1/projects/{project_id}/outline
GET    /api/v1/projects/{project_id}/outline/storyboard
PATCH  /api/v1/projects/{project_id}/outline/storyboard
POST   /api/v1/projects/{project_id}/outline/confirm

GET    /api/v1/projects/{project_id}/pages
GET    /api/v1/projects/{project_id}/pages/{page_id}
GET    /api/v1/projects/{project_id}/pages/{page_id}/research
POST   /api/v1/projects/{project_id}/pages/{page_id}/research/rerun
POST   /api/v1/projects/{project_id}/pages/{page_id}/research/confirm
GET    /api/v1/projects/{project_id}/pages/{page_id}/draft
POST   /api/v1/projects/{project_id}/pages/{page_id}/draft/confirm
GET    /api/v1/projects/{project_id}/pages/{page_id}/design
POST   /api/v1/projects/{project_id}/pages/{page_id}/design/confirm
POST   /api/v1/projects/{project_id}/exports
GET    /api/v1/projects/{project_id}/exports/{export_id}
GET    /api/v1/projects/{project_id}/exports/{export_id}/download
```
