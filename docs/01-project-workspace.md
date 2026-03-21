# 项目工作区设计

## 1. 业务范围

本文件定义项目级工作区，只负责下面四类能力：

1. 项目容器
2. 共享聊天线程
3. 阶段闸门与自动推进
4. Agent、工具、模型执行记录

本文件不定义需求补全、大纲、资料研究、页面初稿和 SVG 设计的业务细节。这些内容分别由对应阶段文档负责。

依赖文档：

- `README.md`

下游文档：

- `02-project-init.md`
- `03-knowledge-research.md`
- `04-outline.md`
- `05-page-draft.md`
- `06-svg-design.md`

---

## 2. 工作区目标

项目工作区是整条链路的根对象。所有阶段、页面、聊天、执行记录都挂在项目下面。

工作区必须满足：

1. 用户只面对一条共享聊天线程，而不是按页面拆出多个对话。
2. 系统可以自动推进阶段，但每个关键闸门都能停下来等确认。
3. 用户指定某一页修改时，系统能定位到页级范围，而不是重跑整个项目。
4. 所有自动动作都有可回溯的执行轨迹。
5. `init` 只使用项目级上下文；进入大纲确认后的页级处理后，系统必须切到页级主上下文。
6. 对于非强制动作，系统先给用户可选项，再按用户意愿执行。

---

## 3. 阶段模型

### 3.1 阶段枚举

项目只允许存在下面七个主阶段：

```text
init
outline
research
draft
design
export
done
```

### 3.2 闸门枚举

项目工作区只认下面五个确认闸门：

```text
requirements_confirm
outline_confirm
research_confirm
draft_confirm
design_confirm
```

### 3.3 自动推进规则

自动推进只允许发生在下面这些场景：

1. 项目创建后，自动进入 `init`
2. `requirements_confirm` 被确认后，自动进入 `outline`
3. `outline_confirm` 被确认后，自动进入 `research`
4. `research_confirm` 被确认后，自动进入 `draft`
5. `draft_confirm` 被确认后，自动进入 `design`
6. `design_confirm` 被确认后，自动进入 `export`

任何阶段都不允许“无闸门一路跑到底”。

### 3.4 局部重算边界

工作区只维护重算边界，不负责各阶段内部算法。

这里的“重算范围”表示一旦用户明确要求重跑，或下游输入已失配时的最小范围。

对非强制动作，Agent 必须先提出可选项，而不是直接执行。

| 用户动作 | 最小重算范围 |
|------|------|
| 修改项目需求目标或初始化补充答案 | `agent 提议：继续沿用当前上下文 / init(refine) -> outline -> research -> draft -> design` |
| 修改大纲结构 | `outline -> research -> draft -> design` |
| 修改单页标题或内容提纲 | `page_brief(self_check) -> Agent 提议是否 research(page) -> draft(page) -> design(page)` |
| 修改单页资料方向 | `research(page) -> draft(page) -> design(page)` |
| 修改单页内容规划 | `draft(page) -> design(page)` |
| 修改单页视觉表现 | `design(page)` |

---

## 4. 共享聊天规则

### 4.1 线程模型

每个项目默认只创建一条主线程：

```text
thread_role = main
```

这条线程承载：

1. 首条需求输入
2. 初始化阶段问答
3. 大纲确认
4. 页面研究调整
5. 页面初稿调整
6. 页面设计调整
7. 导出前确认

### 4.2 隐藏上下文作用域

用户只看到项目主线程，但系统内部必须维护两种上下文：

1. `project_context`
   只服务 `init` 和项目级 `outline`，输入范围是项目原始需求、初始化答案、项目级研究摘要。
2. `page_context`
   只服务单页标题与内容提纲修订，以及单页 `research / draft / design`，主输入范围是当前页标题、内容提纲、页级研究结果、页级最新指令。
   同时允许挂一个只读的 `cross_page_outline_view`，只用于跨页去重自检，不能替代当前页主上下文。

规则只有四条：

1. 一个页级 Agent 不直接共享其他页的完整研究与草稿上下文。
2. 页级 Agent 可以读取其他页面的标题、内容提纲和页面摘要，只用于重复检测与一致性自检。
3. 当页标题或内容提纲被修改时，原页级主上下文立即失效。
4. 页级上下文失效后，系统先将其标记为 `stale`；只有在用户明确要求继续某一步，或下游阶段存在硬依赖时，才重建匹配的 `page_context`。

### 4.3 页级消息表达

页级修改仍然发送到项目主线程，但消息必须带作用范围：

```json
{
  "scope_type": "page",
  "target_page_id": "page-07",
  "message_text": "第 7 页把重点改成行业机会，不要再讲背景。"
}
```

项目级消息使用：

```json
{
  "scope_type": "project",
  "target_page_id": null,
  "message_text": "页数缩短到 12 页，整体改成更偏决策汇报。"
}
```

### 4.4 工作区必须保留的消息属性

每条消息至少需要带上：

1. `stage`
2. `scope_type`
3. `target_page_id`
4. `role`
5. `content_md`
6. `structured_payload_json`

这样后续路由器才能判断：

1. 这是项目级还是页级请求
2. 用户想改哪个阶段
3. 是否需要直接执行重算
4. 是否应该先进入确认闸门
5. 这是用户明确要求执行，还是只是在讨论可选动作

---

## 5. 运行角色

工作区只定义通用运行角色，不定义阶段内部生成细节。

### 5.1 Project Orchestrator

职责：

1. 读取项目状态
2. 解析最新用户消息
3. 判断作用范围
4. 判断是否可以自动推进
5. 创建对应 `agent_run`
6. 区分“强制动作”和“可选动作”
7. 可选动作先返回可选项，等待用户确认

### 5.2 Stage Runner

职责：

1. 执行某个阶段的单次任务
2. 写入阶段产物
3. 创建或更新检查点
4. 推送阶段事件

### 5.3 Page Runner

职责：

1. 在页级范围执行研究、初稿或设计任务
2. 在页级范围执行单页标题与内容提纲修订
3. 不影响其他页的已确认结果
4. 只回写目标页版本
5. 运行前注入目标页当前 `page_context`

### 5.4 Page Context Builder

职责：

1. 根据当前页标题、内容提纲、研究摘要和最近页级消息生成 `page_context`
2. 发现页标题或内容提纲变化时，标记旧上下文失效
3. 为页级研究、初稿、设计提供统一上下文快照
4. 组装只读 `cross_page_outline_view` 供重复检测使用
5. 只负责构建上下文快照，不负责决定是否立刻重跑，由 `Project Orchestrator` 根据用户意愿和阶段依赖判断

---

## 6. Prompt 契约

项目工作区只保留两个通用提示词：消息路由和下一步决策。

### 6.1 `workspace.intent_router.system`

```text
你是 AI PPT 项目工作区的消息路由器。你的任务不是生成内容，而是判断最新一条用户消息应该作用到哪个范围、哪个阶段，以及是否需要创建新的执行任务。

判断原则：
1. 先判断消息作用范围：project 或 page。
2. 如果是 page，必须尽量识别 target_page_id；无法识别时返回 needs_clarification=true。
3. 再判断消息意图：clarify_requirements、confirm_checkpoint、revise_outline、run_research、revise_draft、edit_design、export_project、general_chat。
4. 不要编造页面编号；识别不到就明确返回无法识别。
5. 识别该消息是在“明确要求执行”还是“讨论可选动作”。
6. 输出严格 JSON，不要解释文字。

输出格式：
{
  "scope_type": "project | page",
  "target_stage": "init | outline | research | draft | design | export | none",
  "target_page_id": "string | null",
  "intent_type": "clarify_requirements | confirm_checkpoint | revise_outline | run_research | revise_draft | edit_design | export_project | general_chat",
  "execution_mode": "execute_now | discuss_options",
  "needs_clarification": true,
  "requires_confirmation": false,
  "reason": "一句话说明判断依据"
}
```

### 6.2 `workspace.intent_router.user`

```text
任务：根据项目状态、页面索引和最新对话，判断最新一条用户消息的作用范围和执行意图。

输入数据(JSON)：
{
  "project_state": {
    "project_id": "{{project_id}}",
    "current_stage": "{{current_stage}}",
    "latest_checkpoint_code": "{{latest_checkpoint_code}}",
    "active_page_id": "{{active_page_id}}"
  },
  "page_index": {{page_index_json}},
  "recent_messages": {{recent_messages_json}},
  "latest_user_message": "{{latest_user_message}}"
}
```

### 6.3 `workspace.next_action.system`

```text
你是 AI PPT 项目工作区的下一步决策器。你的任务是根据项目状态和最新阶段产物，判断系统应该自动执行、等待用户确认，还是请求补充信息。

判断原则：
1. 只有在没有开放闸门且输入条件满足时，才允许 auto_run。
2. 如果阶段产物已经生成但尚未确认，必须 wait_user。
3. 如果关键输入缺失，必须 request_clarification。
4. 如果动作不是业务强制且用户没有明确要求执行，必须 wait_user 并返回可选项。
5. 用户意愿优先于系统默认建议，但不能违反输入匹配和阶段依赖。
6. 输出严格 JSON，不要解释文字。

输出格式：
{
  "decision": "auto_run | wait_user | request_clarification",
  "next_stage": "init | outline | research | draft | design | export | none",
  "next_action": "string",
  "checkpoint_code": "string | null",
  "message_to_user": "string",
  "optional_actions": ["string"]
}
```

### 6.4 `workspace.next_action.user`

```text
任务：判断项目下一步动作。

输入数据(JSON)：
{
  "project_state": {{project_state_json}},
  "open_checkpoint": {{open_checkpoint_json}},
  "latest_stage_output": {{latest_stage_output_json}},
  "latest_user_reply": "{{latest_user_reply}}"
}
```

---

## 7. 表结构设计

### 7.1 `projects`

作用：项目根对象。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | uuid | 主键 |
| `title` | varchar | 项目标题 |
| `request_text` | text | 首条需求原文 |
| `status` | varchar | `active / blocked / completed / failed` |
| `current_stage` | varchar | 主阶段枚举 |
| `latest_checkpoint_code` | varchar | 最新待确认闸门 |
| `active_page_id` | uuid | 当前活动页，可空 |
| `page_count_target` | integer | 已确认页数 |
| `selected_style_preset_id` | uuid | 选中的风格预设 |
| `selected_background_asset_id` | uuid | 选中的背景资源 |
| `created_at` | timestamptz | 创建时间 |
| `updated_at` | timestamptz | 更新时间 |

### 7.2 `project_threads`

作用：项目共享聊天线程。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | uuid | 主键 |
| `project_id` | uuid | 所属项目 |
| `thread_role` | varchar | `main` |
| `status` | varchar | `open / archived` |
| `last_message_id` | uuid | 最后一条消息 |
| `created_at` | timestamptz | 创建时间 |
| `updated_at` | timestamptz | 更新时间 |

### 7.3 `project_messages`

作用：保存主线程里的所有消息。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | uuid | 主键 |
| `project_id` | uuid | 所属项目 |
| `thread_id` | uuid | 所属线程 |
| `role` | varchar | `user / assistant / tool / system` |
| `stage` | varchar | 产生消息时所在阶段 |
| `scope_type` | varchar | `project / page` |
| `target_page_id` | uuid | 页级消息关联页 |
| `content_md` | text | 消息正文 |
| `structured_payload_json` | jsonb | 结构化消息体 |
| `citations_json` | jsonb | 引用列表 |
| `created_at` | timestamptz | 创建时间 |

### 7.4 `project_checkpoints`

作用：记录阶段闸门。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | uuid | 主键 |
| `project_id` | uuid | 所属项目 |
| `checkpoint_code` | varchar | 闸门编码 |
| `stage` | varchar | 所属阶段 |
| `status` | varchar | `pending / confirmed / rejected / obsolete` |
| `summary_md` | text | 待确认摘要 |
| `payload_json` | jsonb | 待确认内容 |
| `source_message_id` | uuid | 触发消息 |
| `confirmed_by_message_id` | uuid | 确认消息 |
| `created_at` | timestamptz | 创建时间 |
| `updated_at` | timestamptz | 更新时间 |

### 7.5 `agent_runs`

作用：记录一次自动任务执行。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | uuid | 主键 |
| `project_id` | uuid | 所属项目 |
| `thread_id` | uuid | 所属线程 |
| `run_type` | varchar | `router / init / outline / research / draft / design / export` |
| `target_scope` | varchar | `project / page` |
| `target_page_id` | uuid | 页级运行目标页 |
| `status` | varchar | `queued / running / completed / failed / canceled` |
| `input_json` | jsonb | 输入快照 |
| `output_json` | jsonb | 输出摘要 |
| `started_at` | timestamptz | 开始时间 |
| `finished_at` | timestamptz | 结束时间 |

### 7.6 `agent_steps`

作用：记录一次运行内部步骤。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | uuid | 主键 |
| `agent_run_id` | uuid | 所属运行 |
| `seq_no` | integer | 顺序号 |
| `step_code` | varchar | 步骤编码 |
| `step_name` | varchar | 步骤名 |
| `status` | varchar | `running / completed / failed / skipped` |
| `input_json` | jsonb | 输入 |
| `output_json` | jsonb | 输出 |
| `error_message` | text | 错误信息 |
| `started_at` | timestamptz | 开始时间 |
| `finished_at` | timestamptz | 结束时间 |

### 7.7 `tool_runs`

作用：记录工具层调用。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | uuid | 主键 |
| `agent_run_id` | uuid | 所属运行 |
| `tool_name` | varchar | 内部工具名 |
| `tool_provider` | varchar | 实际 provider |
| `scope_type` | varchar | `project / page` |
| `target_page_id` | uuid | 页级目标页 |
| `request_json` | jsonb | 请求参数 |
| `response_json` | jsonb | 响应结果 |
| `cache_hit` | boolean | 是否命中缓存 |
| `status` | varchar | `running / completed / failed` |
| `started_at` | timestamptz | 开始时间 |
| `finished_at` | timestamptz | 结束时间 |

### 7.8 `model_runs`

作用：记录模型调用。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | uuid | 主键 |
| `agent_run_id` | uuid | 所属运行 |
| `model_role` | varchar | `context / svg` |
| `prompt_key` | varchar | 提示词键 |
| `prompt_version` | varchar | 提示词版本 |
| `input_json` | jsonb | 输入快照 |
| `output_text` | text | 原始输出 |
| `output_json` | jsonb | 结构化输出 |
| `token_usage_json` | jsonb | token 统计 |
| `status` | varchar | `completed / failed` |
| `started_at` | timestamptz | 开始时间 |
| `finished_at` | timestamptz | 结束时间 |

### 7.9 `project_page_contexts`

作用：保存每一页当前可注入的独享上下文快照。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | uuid | 主键 |
| `project_id` | uuid | 所属项目 |
| `page_id` | uuid | 所属页面 |
| `page_brief_version_id` | uuid | 当前页标题与内容提纲版本 |
| `research_session_id` | uuid | 当前页研究会话 |
| `draft_version_id` | uuid | 当前页初稿版本 |
| `design_version_id` | uuid | 当前页设计版本 |
| `context_snapshot_json` | jsonb | 注入模型的页级上下文快照 |
| `cross_page_outline_snapshot_json` | jsonb | 其他页面标题与摘要的只读快照 |
| `status` | varchar | `ready / stale / rebuilding` |
| `updated_at` | timestamptz | 更新时间 |

---

## 8. 事件流

项目工作区统一对外发送下面这些事件：

```text
project.created
init.started
init.waiting_confirmation
outline.started
outline.waiting_confirmation
research.started
research.page_requeued
research.page_completed
research.waiting_confirmation
draft.started
draft.page_completed
draft.waiting_confirmation
design.started
design.page_completed
design.waiting_confirmation
export.started
project.completed
project.failed
```

页级事件必须带 `target_page_id`。

---

## 9. 完成判定

项目工作区完成的标志不是“所有任务都跑过一次”，而是：

1. `design_confirm` 已确认
2. `export` 已完成
3. `projects.status = completed`

否则项目始终视为仍在进行中。
