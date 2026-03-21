# 后端技术路线

## 1. 文档范围

本文件只定义后端落地技术路线：

1. 推荐技术栈
2. 运行时架构
3. 任务队列与异步执行
4. API 与前端对接方式
5. 本地开发与部署基线

本文件不重复定义各业务阶段的提示词、表结构字段和产物格式。这些内容分别归属 `01` 到 `07` 文档。

---

## 2. 核心判断

先把结论说死，别绕：

1. 后端语言选 `Python 3.11`。
2. Web 框架选 `FastAPI`。
3. 模型调用选官方 `OpenAI Python SDK`，不把 `LangChain` 放进核心运行链路。
4. 数据库选 `PostgreSQL + pgvector`。
5. 缓存与任务队列中间件选 `Redis`。
6. 异步任务框架选 `ARQ`，不要一上来上 `Celery`。
7. 对前端暴露 `REST + SSE`，不要默认上 `WebSocket`。
8. 外部搜索、正文读取、文件转 Markdown 一律走 `MCP Gateway`，不要回退成手写网页清洗。
9. 文件资产先走本地文件系统，不引入 `S3 / MinIO`。
10. `context / embedding / svg` 三类模型配置必须完全拆开，不能共享 `base_url` 假设。
11. 模型网关默认对接 `/v1/chat/completions` 与 `/v1/embeddings`，并统一按流式接口组织上层调用。

原因很简单：

1. 你现在的业务不是“调一个模型返回字符串”，而是有明确状态机边界、确认闸门、页级上下文、重跑失配和任务追踪。
2. 这类系统的核心复杂度不在 prompt，而在状态、任务、幂等、回放和前端同步。
3. `LangChain` 在探索期有用，但放进核心运行时只会再包一层抽象，把模型、工具、上下文、重试和 tracing 搅在一起。
4. 这套系统已经有清晰业务文档，所以最稳的路线是：`FastAPI + OpenAI SDK + 自己的 Orchestrator + 自己的 MCP 路由层`。

`LangChain` 不是不能用，但只能放在：

1. 实验目录
2. Prompt 试验工具
3. 离线评测脚本

不要让它进入线上主链路。

---

## 3. 推荐技术栈

| 层 | 推荐方案 | 说明 |
|---|---|---|
| 语言 | `Python 3.11` | 稳定，AI 生态完整，异步支持成熟 |
| 包管理 | `uv + .venv` | 快，干净，适合从零重建 |
| Web | `FastAPI` | 路由、SSE、Pydantic、异步任务集成都够用 |
| 配置 | `pydantic-settings` | 从 `.env` 读取配置，统一类型校验 |
| ORM | `SQLAlchemy 2.x` | 数据模型清晰，可控，不玩花活 |
| 迁移 | `Alembic` | 表结构版本管理必须有 |
| 主库 | `PostgreSQL 16` | JSONB、事务、全文、扩展都够 |
| 向量 | `pgvector` | 先和主库放一起，少一个外部系统 |
| 缓存/队列 | `Redis` | 缓存、分布式锁、任务队列都能用 |
| 异步任务 | `ARQ` | 基于 Redis，异步原生，足够轻 |
| 文件存储 | 本地文件系统 | 背景图、上传附件、临时导出文件先落本地目录 |
| HTTP 客户端 | `httpx` | 统一调用 MCP、文件服务、模型外部接口 |
| 模型 SDK | `openai` | 上下文模型直接用官方 SDK |
| 日志 | `structlog` | 结构化日志，方便追查 agent_run |
| 序列化 | `orjson` | JSON 快且稳 |
| 认证 | 第一阶段可不做复杂鉴权 | 内部工具先别过度设计，后续再补 |

补一句最关键的：

1. 上下文模型走 `OpenAI SDK`
2. SVG 模型也走统一 `ModelGateway`
3. `context_model`、`embedding_model`、`svg_model` 必须拆开配置 `base_url / path / api_key / model`
4. `svg_model` 和 `context_model` 必须是两套角色，不共享会话策略
5. 模型调用接口统一按流式设计，项目层不要暴露阻塞式“整段返回”模型接口

这是业务硬要求，不是实现偏好。

---

## 4. 为什么不用 LangChain 做核心

这是个真问题，不是宗教问题。

不推荐把 `LangChain` 放进线上主链路，原因只有三条：

1. 你已经有非常明确的业务边界：`init / outline / research / draft / design`，再叠一层通用 agent 框架只会让边界变模糊。
2. 你已经决定使用 `MCP` 做工具路由，`LangChain` 不会替你减少 MCP 集成复杂度，反而会再加一层工具抽象。
3. 你需要的是“可追溯的项目状态机 + 可回放任务 + 页级失配重跑”，不是“快速把 LLM 串起来”。

推荐做法：

1. 核心运行时只保留 `OpenAI SDK + 自己的 Prompt Builder + 自己的 Tool Router + 自己的 DB 状态`
2. `LangChain` 如果后面要用，只放到 `experiments/` 或 `eval/` 目录

一句话总结：

`LangChain` 适合验证想法，不适合承载你现在这套明确到页级版本的生产链路。

---

## 5. 运行时架构

### 5.1 总体结构

后端建议拆成六层：

1. `API Layer`
   负责 REST、SSE、上传签名、参数校验、鉴权入口。
2. `Application Layer`
   负责用例编排，例如“提交需求答案”“确认大纲”“触发单页重检”。
3. `Orchestration Layer`
   负责 `Project Orchestrator / Stage Runner / Page Runner / Page Context Builder`。
4. `Domain Services`
   负责研究、需求单、大纲、初稿、设计稿、导出等业务服务。
5. `Infrastructure Layer`
   负责数据库、Redis、本地文件存储、MCP、模型网关。
6. `Worker Layer`
   负责异步执行和重试，不直接暴露 HTTP。

### 5.2 模型层

模型层必须抽成统一网关：

```text
ModelGateway
  -> ContextModelClient
  -> SvgModelClient
  -> EmbeddingModelClient
```

约束如下：

1. `ContextModelClient` 负责需求补全、查询改写、研究总结、大纲、页级 brief 修订、路由判断。
2. `SvgModelClient` 负责 `draft` 和 `design` 两类 SVG 输出。
3. `EmbeddingModelClient` 只负责向量化。
4. `context_model` 和 `svg_model` 默认请求 `/v1/chat/completions`。
5. 模型网关统一暴露流式异步迭代器；即使底层有结构化输出需求，上层也只消费流式事件。
6. `context_model` 可以在流式输出结束后做 JSON 组装与校验。
7. `svg_model` 调用只接受文本输出，应用层只提取 `<svg>...</svg>`。
8. `embedding_model` 默认请求 `/v1/embeddings`。

推荐把模型配置抽成三组：

```text
context_llm
embedding_llm
svg_llm
```

每组都独立拥有：

1. `base_url`
2. `api_key`
3. `model`
4. `path`
5. `timeout_seconds`

其中：

1. `context` 和 `svg` 的 `path` 固定是 `/chat/completions`
2. `embedding` 的 `path` 固定是 `/embeddings`
3. `context` 和 `svg` 必须开启流式

### 5.3 MCP 工具层

MCP 工具层必须单独抽象，不要把 provider 逻辑散在业务代码里：

```text
McpGateway
  -> search_web(tool=bocha)
  -> read_url_markdown(tool=fetch/jina/firecrawl)
  -> convert_file_to_markdown(tool=markitdown)
```

路由原则：

1. 业务层只认内部语义，不认 provider 名。
2. provider 切换只发生在 `McpGateway`。
3. URL 命中缓存时直接返回缓存正文，不重复抓取。

### 5.4 事件层

事件层不要和 HTTP 返回绑死。

推荐做法：

1. 任务写库
2. 任务写事件表
3. SSE 从事件表或 Redis pub/sub 推送给前端
4. 前端断线后，允许按 `last_event_id` 续读

这样前端不会因为一次 SSE 断线就丢状态。

---

## 6. 任务队列路线

### 6.1 为什么要队列

这套系统不适合把所有事情塞进一次 HTTP 请求：

1. 搜索、正文读取、入库、向量化本来就慢
2. 大纲、页级研究、初稿、设计稿都是长任务
3. 需要重试、取消、回放、串行与并行控制

所以必须上队列。

### 6.2 为什么选 ARQ

第一阶段推荐 `ARQ`，不推荐 `Celery`。

原因：

1. 你的任务类型不复杂，主要是异步 IO，不是 CPU 密集型离线批处理。
2. `ARQ` 基于 `Redis`，接入简单，和 `FastAPI` 的 async 风格一致。
3. 现在系统真正复杂的是业务编排，不是消息中间件。

等你真遇到下面这些问题，再考虑更重的东西：

1. 队列规模明显分层
2. 任务编排跨多服务
3. 需要复杂定时调度
4. 需要严格工作流回放

在那之前，不要上 `Celery` 或 `Temporal`。

### 6.3 队列拆分

建议至少拆成五类任务：

| 队列 | 任务类型 | 并发建议 |
|---|---|---|
| `orchestrator` | 路由、阶段推进、确认后续动作判断 | 低并发，保证顺序 |
| `research` | 搜索、正文读取、入库、召回、研究总结 | 中并发 |
| `embedding` | 文档切块和向量化 | 中并发，和 research 解耦 |
| `render` | draft/design SVG 生成 | 低并发，受模型速率限制 |
| `export` | 导出 SVG/PDF/PPT 包 | 低并发 |

### 6.4 任务设计原则

每个任务都必须有：

1. `job_id`
2. `project_id`
3. `target_scope`
4. `target_page_id`
5. `trigger_message_id`
6. `idempotency_key`

必须遵守：

1. 同一 `project_id + page_id + stage + version` 的重复任务要能去重
2. Worker 只做执行，不做最终业务判断
3. 业务判断统一回到 `Orchestrator`
4. 失败任务要能重试，但不能重试出脏数据

### 6.5 典型链路

#### 项目初始化

```text
POST /projects
  -> 保存 project + 首条 user message
  -> enqueue orchestrator.init_bootstrap
  -> orchestrator 创建 init_discovery research job
  -> research worker 搜索/读取/入库/摘要
  -> orchestrator 生成需求单
  -> SSE 推送 init.waiting_confirmation
```

#### 单页修改标题与内容提纲

```text
POST /projects/{id}/messages
  -> router 识别 scope=page + revise_outline
  -> enqueue page_brief_revise
  -> 生成候选 brief + self_check
  -> 等用户确认
  -> 确认后标记当前 research stale
  -> 用户若要求继续 draft，则再 enqueue page_research
```

#### 设计稿生成

```text
POST /pages/{page_id}/design/confirm 或聊天触发
  -> 校验当前 draft 已确认
  -> enqueue design job
  -> 读取 draft_svg + style_pack + background_asset
  -> 生成 design svg
  -> SSE 推送 design.page_completed
```

---

## 7. 存储与基础设施

### 7.1 数据库

数据库只用一个主库：

1. `PostgreSQL`
2. 开 `pgvector`
3. 开全文检索索引

第一阶段不要引入独立向量库。

理由：

1. 当前数据量不会大到需要单独上 Milvus / Weaviate / Qdrant
2. 业务表、检索表、任务表本来就强关联
3. 一个库更容易做事务和追查

### 7.2 文件存储

第一阶段不用对象存储，直接走本地文件系统。

本地文件系统只放这几类文件：

1. 背景图
2. 用户上传附件
3. 导出临时文件
4. 可选的 SVG 快照文件

说明：

1. 版本元数据继续放数据库
2. `draft_svg_markup` 和 `design_svg_markup` 第一阶段可以直接放库
3. 背景图和上传附件落到本地目录，例如 `storage/uploads/`、`storage/backgrounds/`
4. 导出文件生成后先落到 `storage/exports/`，再通过 API 直接下载
5. 如果后面要做多机部署，再把文件层替换成对象存储，不影响上层 API

### 7.3 Redis

Redis 只做三件事：

1. 任务队列
2. 短期缓存
3. 分布式锁

不要把业务事实状态放 Redis。

业务事实状态必须在 PostgreSQL。

---

## 8. 推荐目录结构

建议从一开始就按模块拆，不要把所有代码堆在 `main.py`：

```text
backend/
  pyproject.toml
  .env.example
  app/
    api/
      deps.py
      routers/
        projects.py
        messages.py
        requirements.py
        outline.py
        pages.py
        research.py
        draft.py
        design.py
        exports.py
        events.py
    core/
      config.py
      db.py
      redis.py
      logging.py
      security.py
    schemas/
      common.py
      project.py
      message.py
      requirement.py
      outline.py
      page.py
      research.py
      draft.py
      design.py
      export.py
    models/
      project.py
      workspace.py
      knowledge.py
      outline.py
      draft.py
      design.py
    services/
      orchestrator/
        project_orchestrator.py
        stage_runner.py
        page_runner.py
        page_context_builder.py
      project_service.py
      requirement_service.py
      knowledge_service.py
      research_service.py
      outline_service.py
      draft_service.py
      design_service.py
      export_service.py
    gateways/
      model_gateway.py
      mcp_gateway.py
      file_storage_gateway.py
      event_gateway.py
    prompts/
      init/
      outline/
      research/
      draft/
      design/
      workspace/
    workers/
      orchestrator.py
      research.py
      embedding.py
      render.py
      export.py
    repositories/
      project_repo.py
      message_repo.py
      requirement_repo.py
      research_repo.py
      outline_repo.py
      page_repo.py
      draft_repo.py
      design_repo.py
    utils/
      svg.py
      markdown.py
      retry.py
      ids.py
      time.py
  alembic/
  tests/
  scripts/
```

原则只有一个：

业务模块按阶段拆，基础设施统一下沉，不要反过来按“模型调用/数据库调用/工具调用”横切把业务打散。

---

## 9. 本地开发基线

### 9.1 Python 环境

本地统一使用 `.venv`：

```bash
uv venv .venv
source .venv/bin/activate
uv sync
```

如果第一阶段还没写 `pyproject.toml`，就先：

```bash
uv venv .venv
source .venv/bin/activate
uv pip install fastapi uvicorn sqlalchemy alembic pydantic-settings psycopg[binary] redis arq httpx openai structlog orjson python-multipart sse-starlette
```

### 9.2 本地依赖

本地建议用 `docker compose` 拉起：

1. `postgres`
2. `redis`

MCP 服务有两种开发方式：

1. 本地单独启动 MCP server，再由后端通过 HTTP 或 stdio 调用
2. MCP 网关服务化，后端统一调 HTTP

第一阶段推荐第二种，更稳定。

### 9.3 网页正文 MCP 启动方案

网页正文读取建议保留三路：

1. `fetch`：轻量、低成本、本地兜底
2. `jina`：正文转 Markdown 质量高，适合默认主读
3. `firecrawl`：复杂页面、深抓、站点级抓取兜底

推荐做法不是让业务代码直接连三套协议，而是统一在 `McpGateway` 后面挂三个可访问地址。

#### 方案 A：最省事的三路接法

1. `jina`
   直接使用远程 MCP：`https://mcp.jina.ai/v1`
2. `firecrawl`
   本地起 Streamable HTTP：`http://localhost:3000/mcp`
3. `fetch`
   本地起一个桥接服务，把 stdio fetch server 暴露成 HTTP/SSE URL

这样后端永远只认 URL，不认底层是远程还是本地。

#### `jina` 启动

如果直接用官方远程服务，不需要本地启动。

如果要本地自托管，按官方仓库开发方式：

```bash
git clone https://github.com/jina-ai/MCP.git
cd MCP
npm install
npm run start
```

官方 README 给出的推荐远程端点是 `/v1`。本地开发服务通常也保持同样语义；实际本地暴露路径以启动日志为准，接入层建议统一反代成你自己的固定地址，例如：

```text
http://localhost:3102/v1
```

#### `firecrawl` 启动

官方仓库支持本地 Streamable HTTP 模式：

```bash
HTTP_STREAMABLE_SERVER=true FIRECRAWL_API_KEY=fc-xxxx npx -y firecrawl-mcp
```

启动后使用：

```text
http://localhost:3000/mcp
```

#### `fetch` 启动

`fetch` 这类 server 默认更偏 stdio，本地最简单的运行方式是：

```bash
uvx mcp-server-fetch
```

但如果你的后端坚持三路都只接 URL，就不要让业务层直接碰 stdio。推荐加一层 transport bridge，把 stdio server 转成 HTTP/SSE 地址。

可以用现成 bridge，也可以自己做一个极薄代理。一个可行做法是使用 stdio -> SSE 桥，例如：

```bash
npx -y supergateway \
  --stdio "uvx mcp-server-fetch" \
  --port 3101 \
  --baseUrl http://localhost:3101 \
  --ssePath /sse \
  --messagePath /message
```

这样 `fetch` 就能被统一接成一个 URL 型 MCP 服务。

如果你不想多一个 bridge 进程，也可以让 `McpGateway` 单独对 `fetch` 保留 stdio 适配，而对 `jina/firecrawl` 走 HTTP。这是工程上更简单、也更稳的方案。

### 9.4 配置文件

必须提供：

1. `.env.example`
2. `app/core/config.py`
3. 启动前配置校验

不要把配置散在代码里。

---

## 10. 环境变量建议

下面这批变量够你起项目了：

```dotenv
APP_ENV=local
APP_HOST=0.0.0.0
APP_PORT=8000
APP_DEBUG=true

API_PREFIX=/api/v1
CORS_ORIGINS=http://localhost:5173

DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/ppt
REDIS_URL=redis://localhost:6379/0

FILE_STORAGE_ROOT=./storage
UPLOAD_DIR=./storage/uploads
BACKGROUND_DIR=./storage/backgrounds
EXPORT_DIR=./storage/exports

CONTEXT_LLM_BASE_URL=https://api.openai.com/v1
CONTEXT_LLM_API_KEY=
CONTEXT_LLM_MODEL=gpt-5
CONTEXT_LLM_PATH=/chat/completions
CONTEXT_LLM_STREAM=true
CONTEXT_LLM_TIMEOUT_SECONDS=120

EMBEDDING_BASE_URL=https://api.openai.com/v1
EMBEDDING_API_KEY=
EMBEDDING_MODEL=text-embedding-3-large
EMBEDDING_PATH=/embeddings
EMBEDDING_TIMEOUT_SECONDS=60

SVG_LLM_BASE_URL=https://api.openai.com/v1
SVG_LLM_API_KEY=
SVG_LLM_MODEL=gpt-5
SVG_LLM_PATH=/chat/completions
SVG_LLM_STREAM=true
SVG_LLM_TIMEOUT_SECONDS=180

MCP_BOCHA_URL=https://mcp.bochaai.com/sse
MCP_BOCHA_AUTH_HEADER=Bearer sk-xxxx
MCP_FETCH_URL=
MCP_JINA_URL=https://mcp.jina.ai/v1
MCP_JINA_AUTH_HEADER=Bearer jina_xxx
MCP_FIRECRAWL_URL=
MCP_MARKITDOWN_URL=

MAX_RESEARCH_CONCURRENCY=4
MAX_RENDER_CONCURRENCY=2
EVENT_STREAM_REPLAY_LIMIT=200
```

说明：

1. `CONTEXT_LLM_*`、`EMBEDDING_*`、`SVG_LLM_*` 必须完全拆开，即使第一阶段碰巧指向同一家供应商。
2. `CONTEXT_LLM_BASE_URL`、`SVG_LLM_BASE_URL`、`EMBEDDING_BASE_URL` 不允许默认假设相同。
3. `CONTEXT_LLM_PATH` 与 `SVG_LLM_PATH` 走 `/chat/completions`，`EMBEDDING_PATH` 走 `/embeddings`。
4. `CONTEXT_LLM_STREAM` 与 `SVG_LLM_STREAM` 必须保持 `true`。
5. 所有模型调用都要求流式；如果底层 SDK 某个结构化工具不支持原生流式，就在网关层做增量缓冲，不向上暴露同步调用。
6. 远程 MCP 的鉴权头也必须走环境变量，例如 `MCP_BOCHA_AUTH_HEADER`、`MCP_JINA_AUTH_HEADER`。
7. 所有 MCP 地址和鉴权信息都是基础设施配置，不允许写死在业务代码里。

---

## 11. API 路线

### 11.1 总原则

API 只分三类：

1. 资源接口
2. 对话接口
3. 事件接口

规则很重要：

1. 所有“显式 UI 动作”走资源接口
2. 所有“用户自然语言编辑意图”走对话接口
3. 所有“进度更新、任务完成、确认提醒”走事件接口

不要把一切都塞到聊天接口里。

### 11.2 对话接口

共享聊天只有一个主入口：

```text
POST /api/v1/projects/{project_id}/messages
GET  /api/v1/projects/{project_id}/messages
```

发送消息体建议：

```json
{
  "scope_type": "project | page",
  "target_page_id": "uuid | null",
  "content_md": "用户消息正文",
  "attachments": []
}
```

这个接口只负责：

1. 保存消息
2. 触发路由判断
3. enqueue 对应任务

它不应该在一个请求里同步跑完整个 Agent。

### 11.3 事件接口

推荐用 SSE：

```text
GET /api/v1/projects/{project_id}/events/stream
```

事件体建议：

```json
{
  "event_id": "uuid",
  "event_type": "research.page_completed",
  "project_id": "uuid",
  "stage": "research",
  "scope_type": "page",
  "target_page_id": "uuid",
  "agent_run_id": "uuid",
  "payload": {},
  "created_at": "2026-03-20T10:00:00Z"
}
```

前端用途：

1. 初始化页进度提示
2. 搜索完成提示
3. 初稿完成提示
4. 设计稿完成提示
5. 闸门确认提醒

SSE 足够，因为当前场景是“前端提交动作，后端持续推送状态”，不是实时协同编辑。

---

## 12. 面向静态 Demo 的接口映射

下面按当前仓库里的前端页面来对齐。

### 12.1 首页 `Home`

对应组件：

- [Home.tsx](/Users/zhx/data/IdeaProjects/own/ppt/src/components/Home.tsx)

需要接口：

| 接口 | 用途 |
|---|---|
| `GET /api/v1/projects?order=updated_at.desc&limit=20` | 最近项目列表 |
| `POST /api/v1/projects` | 创建项目，并保存首页首条需求 |

`POST /projects` 请求体建议：

```json
{
  "title": "可空，由后端自动生成",
  "request_text": "生成一份关于 2024 年人工智能发展趋势的报告"
}
```

返回值至少包含：

1. `project_id`
2. `current_stage`
3. `latest_checkpoint_code`

### 12.2 初始化页 `ProjectStart`

对应组件：

- [ProjectStart.tsx](/Users/zhx/data/IdeaProjects/own/ppt/src/components/ProjectStart.tsx)

这个页面要的不是一个接口，而是一组状态：

1. 左侧参考资料
2. 右侧共享聊天
3. 当前需求单
4. 当前初始化进度

需要接口：

| 接口 | 用途 |
|---|---|
| `GET /api/v1/projects/{id}` | 项目当前状态 |
| `GET /api/v1/projects/{id}/requirements/form` | 当前需求单 |
| `GET /api/v1/projects/{id}/research-sessions/init-discovery` | 初始化首次研究摘要 |
| `GET /api/v1/projects/{id}/research-sessions/{session_id}/sources` | 左侧参考资料列表 |
| `POST /api/v1/projects/{id}/requirements/answers:batch` | 批量提交需求单答案 |
| `POST /api/v1/projects/{id}/requirements/confirm` | 确认需求单 |
| `POST /api/v1/projects/{id}/assets/backgrounds` | 通过 multipart 直传背景图 |
| `GET /api/v1/projects/{id}/events/stream` | 初始化过程实时进度 |
| `POST /api/v1/projects/{id}/messages` | 继续补充需求、要求重检、调整答案 |

注意：

1. 页数、风格、背景上传这种明确 UI 行为，直接走资源接口。
2. “方向偏向竞品”“重新搜一轮”“页数想再缩一点”这种自然语言，走聊天接口。

### 12.3 编辑页通用状态 `Editor`

对应组件：

- [Editor.tsx](/Users/zhx/data/IdeaProjects/own/ppt/src/components/Editor.tsx)

编辑页进入后，前端至少要先拉这些数据：

| 接口 | 用途 |
|---|---|
| `GET /api/v1/projects/{id}` | 顶部项目信息、当前阶段 |
| `GET /api/v1/projects/{id}/pages` | 左侧页列表与状态 |
| `GET /api/v1/projects/{id}/outline/storyboard` | 便利贴/大纲视图 |
| `GET /api/v1/projects/{id}/messages` | 右侧共享聊天历史 |
| `GET /api/v1/projects/{id}/events/stream` | 实时更新 |

### 12.4 搜索视图

搜索视图展示的是“目标页当前研究会话”。

需要接口：

| 接口 | 用途 |
|---|---|
| `GET /api/v1/projects/{id}/pages/{page_id}/research` | 当前页研究摘要、查询、引用、来源 |
| `POST /api/v1/projects/{id}/pages/{page_id}/research/confirm` | 确认当前页研究结果 |
| `POST /api/v1/projects/{id}/pages/{page_id}/research/rerun` | 显式要求重新研究 |

如果用户通过聊天说“第 10 页换个方向搜”，仍然走：

```text
POST /api/v1/projects/{id}/messages
```

### 12.5 初稿视图

初稿视图展示“目标页当前 draft 版本”。

需要接口：

| 接口 | 用途 |
|---|---|
| `GET /api/v1/projects/{id}/pages/{page_id}/draft` | 当前页初稿 SVG 与版本信息 |
| `POST /api/v1/projects/{id}/pages/{page_id}/draft/confirm` | 确认当前页初稿 |

注意：

1. 如果用户只是点开某页初稿，不应该重新生成。
2. 如果用户要修改布局承载方式，既可以走聊天，也可以提供显式“重新生成初稿”按钮。

### 12.6 设计稿视图

设计稿视图展示“目标页当前 design 版本”。

需要接口：

| 接口 | 用途 |
|---|---|
| `GET /api/v1/projects/{id}/pages/{page_id}/design` | 当前页设计稿 SVG |
| `POST /api/v1/projects/{id}/pages/{page_id}/design/confirm` | 确认当前页设计稿 |
| `POST /api/v1/projects/{id}/exports` | 创建导出任务 |
| `GET /api/v1/projects/{id}/exports/{export_id}/download` | 导出完成后直接下载文件 |

### 12.7 便利贴 / Storyboard 视图

这个视图不是聊天，它是显式结构编辑。

需要接口：

| 接口 | 用途 |
|---|---|
| `GET /api/v1/projects/{id}/outline/storyboard` | 读取章节与内容页树 |
| `PATCH /api/v1/projects/{id}/outline/storyboard` | 拖拽排序、增删章节、增删内容页 |
| `POST /api/v1/projects/{id}/outline/confirm` | 确认大纲 |

不要把拖拽排序走聊天接口，那是找死。

---

## 13. 推荐接口清单

为了后续编码不发散，第一阶段建议只做下面这批：

### 13.1 项目与工作区

```text
GET    /api/v1/projects
POST   /api/v1/projects
GET    /api/v1/projects/{project_id}
GET    /api/v1/projects/{project_id}/events/stream
GET    /api/v1/projects/{project_id}/messages
POST   /api/v1/projects/{project_id}/messages
```

### 13.2 初始化

```text
GET    /api/v1/projects/{project_id}/requirements/form
POST   /api/v1/projects/{project_id}/requirements/answers:batch
POST   /api/v1/projects/{project_id}/requirements/confirm
POST   /api/v1/projects/{project_id}/assets/backgrounds
GET    /api/v1/projects/{project_id}/research-sessions/init-discovery
GET    /api/v1/projects/{project_id}/research-sessions/{session_id}/sources
```

### 13.3 大纲与页面

```text
GET    /api/v1/projects/{project_id}/outline
GET    /api/v1/projects/{project_id}/outline/storyboard
PATCH  /api/v1/projects/{project_id}/outline/storyboard
POST   /api/v1/projects/{project_id}/outline/confirm
GET    /api/v1/projects/{project_id}/pages
GET    /api/v1/projects/{project_id}/pages/{page_id}
```

### 13.4 页级研究

```text
GET    /api/v1/projects/{project_id}/pages/{page_id}/research
POST   /api/v1/projects/{project_id}/pages/{page_id}/research/rerun
POST   /api/v1/projects/{project_id}/pages/{page_id}/research/confirm
```

### 13.5 页级初稿与设计稿

```text
GET    /api/v1/projects/{project_id}/pages/{page_id}/draft
POST   /api/v1/projects/{project_id}/pages/{page_id}/draft/confirm
GET    /api/v1/projects/{project_id}/pages/{page_id}/design
POST   /api/v1/projects/{project_id}/pages/{page_id}/design/confirm
POST   /api/v1/projects/{project_id}/exports
GET    /api/v1/projects/{project_id}/exports/{export_id}
GET    /api/v1/projects/{project_id}/exports/{export_id}/download
```

---

## 14. 编码顺序

后端实现顺序建议如下：

1. `core/config + db + redis + logging`
2. `projects / messages / events` 基础工作区接口
3. `Project Orchestrator + ARQ worker` 最小可运行链路
4. `McpGateway + Knowledge ingest + pgvector`
5. `init` 相关接口和 worker
6. `outline + storyboard`
7. `page research`
8. `draft svg`
9. `design svg`
10. `export`

顺序不能反。

如果你先写 draft/design，而工作区、消息路由、队列、研究会话还没落地，那就是在给未来制造垃圾代码。

---

## 15. 外部参考

这里列当前技术路线唯一需要关心的外部参考：

1. OpenAI 官方 Chat Completions 说明：
   https://help.openai.com/en/articles/7232945-how-can-i-use-the-chatgpt-api
2. OpenAI 官方从 Completions 迁移到 Chat Completions 说明：
   https://help.openai.com/en/articles/7042661-moving-from-completions-to-chat-completions-in-the-openai-api
3. OpenAI 官方 Structured Outputs 说明：
   https://openai.com/index/introducing-structured-outputs-in-the-api/
4. OpenAI 官方 Agents SDK 文档：
   https://platform.openai.com/docs/guides/agents-sdk/
5. Jina 官方 MCP 仓库：
   https://github.com/jina-ai/MCP
6. Firecrawl 官方 MCP 仓库：
   https://github.com/firecrawl/firecrawl-mcp-server
7. 官方 MCP Python SDK：
   https://github.com/modelcontextprotocol/python-sdk
8. MCP Fetch Server 实现：
   https://github.com/ExactDoug/mcp-fetch

这些参考只用来确认四件事：

1. OpenAI 生态当前主流是 Chat Completions / Responses，而不是旧版 legacy Completions
2. 结构化输出能力可以继续保留
3. 官方或主流 MCP 服务已经支持远程 HTTP 或本地启动
4. 官方有 Agents SDK，但本项目第一阶段不把它作为核心运行时

后一点是工程判断，不是文档原句。
