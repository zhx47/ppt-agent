# 知识与研究设计

## 1. 业务范围

本文件定义知识层与研究层，只负责下面这些事情：

1. MCP 工具路由
2. 外部内容读取与 Markdown 归一化
3. 文档入库与分块
4. 向量化与混合检索
5. 初始化研究与页级研究
6. 引用生成

本文件不定义需求单、大纲、页面初稿和 SVG 设计的业务规则。

依赖文档：

- `01-project-workspace.md`

下游文档：

- `02-project-init.md`
- `04-outline.md`
- `05-page-draft.md`
- `06-svg-design.md`

---

## 2. 研究层目标

知识与研究层只输出四类东西：

1. 可复用的资料资产
2. 项目级初始化上下文
3. 可追溯的研究结论
4. 可引用的证据片段

这层不允许直接输出“仅可展示、不可复用”的临时结果。

---

## 3. 工具路由

### 3.1 内部工具语义

业务层只允许调用下面三个内部工具语义：

```text
search_web
read_url_markdown
convert_file_to_markdown
```

### 3.2 Provider 映射

第一版建议：

| 内部工具 | 默认 provider | 用途 |
|------|------|------|
| `search_web` | `bocha-mcp` | 搜索网页与候选来源 |
| `read_url_markdown` | `fetch-mcp` | 直接读取网页正文并转 Markdown |
| `read_url_markdown` | `jina-mcp` | 需要更强正文抽取时的替代读取器 |
| `read_url_markdown` | `firecrawl-mcp` | 深度抓取或整站资料采集 |
| `convert_file_to_markdown` | `markitdown-mcp` | PDF、Office、附件转 Markdown |

### 3.3 路由规则

工具路由按下面顺序执行：

1. 普通网页正文：优先 `fetch-mcp`
2. 网页正文质量不足：切到 `jina-mcp`
3. 需要批量采集或深度抓取：切到 `firecrawl-mcp`
4. 文件类资料：走 `markitdown-mcp`

---

## 4. 入库链路

### 4.1 标准链路

```text
search_web
  -> read_url_markdown
  -> normalize_markdown
  -> ingest_document
  -> chunk_document
  -> embed_chunks
  -> store_research_session
```

### 4.2 归一化规则

所有外部资料最终必须归一到：

1. `markdown_content`
2. `document_metadata`
3. `chunk_records`

禁止把下面这些内容当成长期资产：

1. 原始 HTML 清洗结果
2. 临时 snippet 拼接文本
3. 仅用于单次回答的未入库搜索结果

### 4.3 URL 读取规则

URL 正文读取只认 Markdown 正文，不做 HTML 元素级手工清洗。

正文读取成功的判定条件：

1. 有有效标题
2. 有非空 Markdown 正文
3. 正文长度达到最低阈值
4. 读取结果可进入缓存

---

## 5. 分块与向量化

### 5.1 分块策略

Markdown 文档按下面顺序切块：

1. 标题层级
2. 列表块
3. 表格块
4. 普通段落块

每个块都需要保留：

1. `section_path`
2. `chunk_index`
3. `content_md`
4. `content_for_embedding`

### 5.2 `content_for_embedding`

向量化文本建议拼接：

```text
title
section_path
content_md
```

这样能保留标题语义和章节位置信号。

### 5.3 检索策略

第一版采用混合检索：

1. 关键词召回
2. 向量召回
3. RRF 融合
4. MMR 去重
5. rerank

### 5.4 引用粒度

引用最小粒度是 chunk，不是整篇文档。

后续大纲、初稿、设计阶段只能引用：

1. 文档标题
2. URL
3. chunk 摘要
4. chunk 片段

---

## 6. 研究会话

### 6.1 会话作用域

研究会话分三类：

```text
project
page
ad_hoc
```

### 6.2 会话角色

研究会话还要区分角色：

```text
init_discovery
init_refine
page_research
page_refresh
ad_hoc
```

`scope_type` 决定作用范围，`session_role` 决定本次检索的用途。

### 6.3 初始化首次检索

初始化研究负责：

1. 快速摸清主题背景
2. 识别关键信息源
3. 产出需求补全所需摘要
4. 为页数推荐和补充问题提供素材

首次检索只允许宽搜，不要求一步搜准。

标准执行链路：

1. 从 `request_text` 生成宽查询
2. 用 `bocha-mcp` 获取互联网候选来源
3. 用正文读取 MCP 获取 Markdown 正文
4. 入库、分块、向量化
5. 生成 `init_discovery` 摘要

### 6.4 初始化精确重检索

精确重检索负责：

1. 把用户补全答案转成检索约束
2. 生成真正供大纲使用的项目级上下文
3. 为后续页级研究提供项目级基线资料

这不是默认强制动作。

只有在用户明确要求时，或 Agent 判断当前上下文已不足以支撑下一阶段并先给出阻断原因与可选动作时，才进入该流程。

执行流程：

1. 读取 `request_text`
2. 读取最新确认中的补充答案
3. 生成更精确的查询计划
4. 再次调用 `bocha-mcp`
5. 读取正文、入库、召回、筛选来源
6. 输出 `outline_context_md`
7. 生成供后续阶段复用的 `citations`

### 6.5 页级研究

页级研究负责：

1. 把单页标题和内容提纲转成检索计划
2. 为该页选出最相关证据
3. 产出页级研究摘要和引用列表
4. 为初稿提供当前页唯一有效的资料上下文

页级研究以目标页主上下文为核心，同时允许挂载有限的只读跨页摘要视图。

规则如下：

1. 当前页的研究目标、摘要、引用选择必须围绕目标页自身完成。
2. 允许注入只读的 `cross_page_outline_view`，其中只包含其他页面的标题、内容提纲和摘要。
3. `cross_page_outline_view` 只用于重复检测、跨页边界检查和主线一致性自检。
4. 不允许把其他页的完整研究摘要、完整引用池和初稿内容直接混入当前页主上下文。
5. 当目标页采用新的 `page_brief_version` 后，旧研究会话只保留为历史记录，不再视为当前有效研究。

页级上下文至少包含：

1. 当前页 `title`
2. 当前页 `content_outline`
3. 当前页 `content_summary`
4. 项目级需求摘要
5. `outline_context_md`
6. 当前页最新用户指令
7. `cross_page_outline_view`

### 6.6 页级重检触发

下面任一条件发生时，Agent 应该优先向用户给出“是否重建研究会话”的建议，而不是直接重跑：

1. 页标题被修改
2. 页内容提纲被修改
3. 用户明确要求“重新检索”或“换个方向搜”
4. 用户否决当前页研究结果
5. 当前页研究摘要中的关键开放问题未解决

如果用户刚确认新的 `page_brief_version`，但暂时还没有要求继续出稿，系统只把当前研究会话标记为 `stale`，并提供三类动作：

1. 立即重建页级研究
2. 继续修改页面标题与内容提纲
3. 暂时保留当前状态，稍后再处理

如果用户要继续进入初稿，而当前研究会话与最新 `page_brief_version` 已不匹配，则页级重检变成强制前置动作。

重检只影响目标页，不影响其他页。

### 6.7 页级研究输出契约

```json
{
  "research_session": {
    "id": "uuid",
    "scope_type": "page",
    "session_role": "page_research | page_refresh",
    "page_id": "uuid",
    "page_brief_version_id": "uuid",
    "cross_page_outline_view": [
      {
        "page_id": "uuid",
        "title": "其他页标题",
        "content_summary": "其他页摘要"
      }
    ],
    "query_plan": [
      {
        "query": "字符串",
        "intent": "要找什么证据"
      }
    ],
    "summary_md": "页级研究摘要",
    "key_findings": [
      "结论1",
      "结论2"
    ],
    "overlap_risks": [
      {
        "page_id": "uuid",
        "risk_note": "与第 6 页的内容焦点过近"
      }
    ],
    "selected_sources": [
      {
        "source_document_id": "uuid",
        "chunk_id": "uuid",
        "title": "来源标题",
        "url": "https://...",
        "excerpt_md": "可引用片段"
      }
    ]
  }
}
```

---

## 7. Prompt 契约

### 7.1 `research.query_rewrite.system`

```text
你是 AI PPT 研究链路的查询改写器。你的任务是根据项目目标、阶段语境和当前作用范围，把原始检索意图改写成更适合搜索与检索系统的查询集合。

规则：
1. 只输出严格 JSON。
2. 输出 3 到 6 条查询。
3. 查询必须覆盖主题词、实体词、对比词和证据词。
4. 不要输出废话型自然语言长句。

输出格式：
{
  "queries": [
    {
      "query": "字符串",
      "intent": "解释这条查询的目的"
    }
  ]
}
```

### 7.2 `research.query_rewrite.user`

```text
任务：为研究会话生成查询集合。

输入数据(JSON)：
{
  "scope_type": "{{scope_type}}",
  "session_role": "{{session_role}}",
  "request_text": "{{request_text}}",
  "requirement_answers": {{requirement_answers_json}},
  "project_goal": "{{project_goal}}",
  "outline_context_md": "{{outline_context_md}}",
  "page_title": "{{page_title}}",
  "page_outline": {{page_outline_json}},
  "cross_page_outline_view": {{cross_page_outline_view_json}},
  "latest_instruction": "{{latest_instruction}}",
  "recent_citations": {{recent_citations_json}}
}
```

### 7.3 `research.page_query_plan.system`

```text
你是 AI PPT 页级研究规划器。你的任务是根据单页标题、内容提纲、项目需求和项目级初始化上下文，生成这一页的研究计划。

规则：
1. 只输出严格 JSON。
2. 至少给出 3 条查询计划。
3. 每条计划都要说明要验证的结论或要补齐的证据。
4. 查询计划必须服务当前页，不要跑题。

输出格式：
{
  "query_plan": [
    {
      "query": "字符串",
      "intent": "这一条要解决什么问题"
    }
  ]
}
```

### 7.4 `research.page_query_plan.user`

```text
任务：为目标页生成查询计划。

输入数据(JSON)：
{
  "project": {
    "title": "{{project_title}}",
    "goal_summary": "{{goal_summary}}",
    "requirement_summary": "{{requirement_summary}}",
    "outline_context_md": "{{outline_context_md}}"
  },
  "page": {
    "page_id": "{{page_id}}",
    "page_brief_version_id": "{{page_brief_version_id}}",
    "title": "{{page_title}}",
    "content_outline": {{content_outline_json}},
    "summary": "{{page_summary}}"
  },
  "cross_page_outline_view": {{cross_page_outline_view_json}},
  "latest_instruction": "{{latest_instruction}}",
  "previous_research": {{previous_research_json}}
}
```

### 7.5 `research.summary.system`

```text
你是 AI PPT 研究总结器。你的任务是根据已选来源和片段，生成可直接给需求补全、大纲或页面初稿使用的研究摘要。

规则：
1. 只输出严格 JSON。
2. 摘要必须忠于来源，不得编造事实。
3. 摘要必须显式区分结论、证据和待补充问题。

输出格式：
{
  "summary_md": "研究摘要",
  "key_findings": ["结论1", "结论2"],
  "open_questions": ["待补充问题"]
}
```

### 7.6 `research.summary.user`

```text
任务：根据已选来源生成研究摘要。

输入数据(JSON)：
{
  "scope_type": "{{scope_type}}",
  "research_goal": "{{research_goal}}",
  "selected_sources": {{selected_sources_json}}
}
```

---

## 8. 表结构设计

### 8.1 `bocha_search_cache`

作用：缓存搜索结果。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | uuid | 主键 |
| `query_key` | varchar | 标准化查询键 |
| `query_text` | text | 原始查询 |
| `provider` | varchar | `bocha-mcp` |
| `result_json` | jsonb | 搜索结果 |
| `result_count` | integer | 结果数 |
| `expires_at` | timestamptz | 过期时间 |
| `created_at` | timestamptz | 创建时间 |

### 8.2 `url_content_cache`

作用：缓存 URL 对应的 Markdown 正文。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | uuid | 主键 |
| `normalized_url` | varchar | 标准化 URL |
| `provider` | varchar | 读取 provider |
| `title` | varchar | 标题 |
| `markdown_content` | text | 正文 Markdown |
| `metadata_json` | jsonb | 附加元数据 |
| `content_hash` | varchar | 内容哈希 |
| `status` | varchar | `ready / failed` |
| `expires_at` | timestamptz | 过期时间 |
| `created_at` | timestamptz | 创建时间 |
| `updated_at` | timestamptz | 更新时间 |

### 8.3 `source_collections`

作用：项目级资料集合。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | uuid | 主键 |
| `project_id` | uuid | 所属项目 |
| `collection_type` | varchar | `project_knowledge` |
| `title` | varchar | 集合标题 |
| `created_at` | timestamptz | 创建时间 |

### 8.4 `source_documents`

作用：归一化后的资料文档。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | uuid | 主键 |
| `collection_id` | uuid | 所属集合 |
| `source_type` | varchar | `url / file / text` |
| `source_uri` | varchar | 原始地址或文件标识 |
| `url_cache_id` | uuid | URL 缓存引用 |
| `title` | varchar | 文档标题 |
| `markdown_content` | text | 文档正文 |
| `metadata_json` | jsonb | 附加元数据 |
| `content_hash` | varchar | 正文哈希 |
| `status` | varchar | `ready / failed` |
| `created_at` | timestamptz | 创建时间 |

### 8.5 `source_chunks`

作用：文档分块和向量记录。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | uuid | 主键 |
| `source_document_id` | uuid | 所属文档 |
| `chunk_index` | integer | 块顺序 |
| `section_path` | varchar | 章节路径 |
| `content_md` | text | 块内容 |
| `content_for_embedding` | text | 向量化文本 |
| `embedding` | vector | 向量字段 |
| `token_count` | integer | token 数 |
| `created_at` | timestamptz | 创建时间 |

### 8.6 `project_research_sessions`

作用：记录一次研究会话。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | uuid | 主键 |
| `project_id` | uuid | 所属项目 |
| `scope_type` | varchar | `project / page / ad_hoc` |
| `session_role` | varchar | `init_discovery / init_refine / page_research / page_refresh / ad_hoc` |
| `page_id` | uuid | 页级研究目标页 |
| `page_brief_version_id` | uuid | 页级研究对应的页标题与提纲版本 |
| `based_on_session_id` | uuid | 重检时引用的上一会话 |
| `research_goal` | text | 研究目标 |
| `cross_page_outline_snapshot_json` | jsonb | 其他页面标题与摘要的只读快照 |
| `query_plan_json` | jsonb | 查询计划 |
| `summary_md` | text | 研究摘要 |
| `key_findings_json` | jsonb | 关键结论 |
| `overlap_risks_json` | jsonb | 跨页重复风险 |
| `open_questions_json` | jsonb | 待补充问题 |
| `status` | varchar | `queued / running / completed / failed / confirmed` |
| `confirmed_by_message_id` | uuid | 确认消息 |
| `context_snapshot_json` | jsonb | 本次检索使用的上下文快照 |
| `created_by_agent_run_id` | uuid | 创建运行 |
| `created_at` | timestamptz | 创建时间 |
| `updated_at` | timestamptz | 更新时间 |

### 8.7 `project_research_sources`

作用：记录研究会话最终采用的来源。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | uuid | 主键 |
| `research_session_id` | uuid | 所属研究会话 |
| `source_document_id` | uuid | 来源文档 |
| `chunk_id` | uuid | 引用块 |
| `rank_no` | integer | 排名 |
| `excerpt_md` | text | 引用片段 |
| `relevance_score` | numeric | 相关性分 |
| `usage_note` | text | 使用说明 |
| `is_pinned` | boolean | 是否被人工保留 |

### 8.8 `retrieval_runs`

作用：记录一次检索执行。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | uuid | 主键 |
| `project_id` | uuid | 所属项目 |
| `research_session_id` | uuid | 关联研究会话 |
| `query_text` | text | 执行查询 |
| `retrieval_mode` | varchar | `keyword / vector / hybrid` |
| `status` | varchar | `running / completed / failed` |
| `created_at` | timestamptz | 创建时间 |

### 8.9 `retrieval_candidates`

作用：记录召回候选项。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | uuid | 主键 |
| `retrieval_run_id` | uuid | 所属检索 |
| `source_document_id` | uuid | 来源文档 |
| `chunk_id` | uuid | 来源块 |
| `score_vector` | numeric | 向量分 |
| `score_keyword` | numeric | 关键词分 |
| `score_final` | numeric | 融合分 |
| `selected` | boolean | 是否入选 |

### 8.10 `citations`

作用：保存后续阶段复用的引用对象。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | uuid | 主键 |
| `project_id` | uuid | 所属项目 |
| `source_document_id` | uuid | 来源文档 |
| `chunk_id` | uuid | 来源块 |
| `title` | varchar | 来源标题 |
| `url` | varchar | 来源 URL |
| `excerpt_md` | text | 引用片段 |
| `citation_label` | varchar | 展示标签 |
| `created_at` | timestamptz | 创建时间 |

---

## 9. 完成判定

知识与研究层本身没有“项目完成”概念，它只在每次研究会话层面完成。

会话完成的条件：

1. `project_research_sessions.status = completed`
2. 已有至少 1 条 `project_research_sources`
3. 已生成 `summary_md`

如果该会话被下游阶段使用，还需要满足：

4. 对应的页标题与内容提纲版本仍然未失效

页级研究被确认后，后续阶段才允许消费该研究结果。
