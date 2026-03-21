# 项目初始化设计

## 1. 业务范围

本文件定义项目初始化阶段，只负责下面这些动作：

1. 接收首页需求并启动初始化流程
2. 执行项目级首次背景检索
3. 生成页数推荐
4. 生成补充问题
5. 在用户需要时执行精确重检索
6. 收集风格选择和背景上传
7. 形成需求确认闸门

本文件不定义资料入库算法、向量检索、大纲结构、页面初稿和 SVG 设计细节。

依赖文档：

- `01-project-workspace.md`
- `03-knowledge-research.md`
- `06-svg-design.md`

下游文档：

- `04-outline.md`

---

## 2. 阶段目标

初始化阶段的目标只有一个：

把“模糊需求”收敛成“可执行需求单”。

阶段完成时，系统必须拿到下面六类结果：

1. 项目主题
2. 页数目标
3. 风格选择
4. 背景资源
5. 影响后续结构的补充答案
6. 供大纲使用的当前初始化上下文

如果这六类信息不完整，就不允许进入大纲阶段。

这里的 `outline_context_md` 是当前选定、供大纲使用的项目级上下文，不要求必须来自精确重检索。

系统必须支持基于最新答案发起精确重检索，但默认可以继续沿用首次检索生成的有效上下文。除非当前上下文已经无法支撑大纲生成，否则 Agent 只能把“重新精确调研”作为建议动作，不能静默替用户执行。

---

## 3. 初始化流程

### 3.1 自动启动与首次检索

当项目被创建后，初始化阶段立即执行：

1. 读取首页原始需求
2. 创建一次 `scope_type = project, session_role = init_discovery` 的研究会话
3. 用原始需求通过 `bocha-mcp` 执行首次互联网检索
4. 读取候选网页正文并入库
5. 生成首次背景调研摘要和初始 `outline_context_md`
6. 基于首次摘要生成页数推荐
7. 基于首次摘要生成补充问题
8. 组装需求确认表单
9. 打开 `requirements_confirm` 闸门

### 3.2 答案回填后的可选精确重检索

初始化阶段必须支持围绕答案回填继续调研，但是否立即执行由用户决定。

当下面任一条件发生时，系统应该把“是否执行精确重检索”作为可选项提给用户：

1. 用户修改首页原始需求
2. 用户修改任一补充问题答案
3. 用户补充了新的项目级约束
4. 用户对当前背景调研不满意

如果用户明确要求“重新调研”或“按新的方向再搜”，则精确重检索变成明确执行动作。

Agent 在这一节点至少要提供三种选项：

1. 继续沿用当前上下文，直接进入下一步
2. 按最新答案执行精确重检索
3. 继续修改答案，不立刻检索

当用户选择执行精确重检索时，流程如下：

1. 读取最新 `request_text`
2. 读取当前需求单里的全部答案
3. 创建新的 `scope_type = project, session_role = init_refine` 研究会话
4. 用 `request_text + answers + latest_instruction` 生成精确查询集合
5. 再次调用 `bocha-mcp` 搜索互联网资料
6. 读取正文、入库、召回并筛选来源
7. 生成 `outline_context_md`
8. 回写需求单摘要和大纲上下文

如果用户选择不重检，则保留当前有效的 `outline_context_md` 继续使用。

如果用户继续修改答案，则保持需求单未确认状态，等待下一次用户选择。

### 3.3 固定字段

初始化表单固定包含三块：

1. 页数确认
2. 风格确认
3. 背景上传

其中：

1. 页数确认由 AI 推荐 3 个候选项，外加 1 个自定义输入
2. 风格确认不由 AI 生成，只从预置风格列表里选择
3. 背景上传不由 AI 生成，只负责接收资源

### 3.4 AI 补充字段

除固定字段外，AI 还要生成 2 到 4 个补充问题。

补充问题只允许覆盖下面这类信息：

1. 受众
2. 决策目标
3. 重点方向
4. 是否需要竞品或对标信息
5. 证据偏好
6. 页面密度偏好

每个问题都必须提供：

1. 3 个候选项
2. 1 个自定义输入入口

### 3.5 阶段出口

初始化阶段只有一个出口：

```text
requirements_confirm = confirmed
```

出口成立后才能进入 `outline`。

出口成立前必须保证：

1. 最新 `init_discovery` 已完成
2. 当前选定的 `outline_context_md` 已生成
3. 用户已明确当前是否需要继续精确重检索

---

## 4. 表单契约

### 4.1 需求单输出结构

```json
{
  "requirement_form": {
    "project_id": "uuid",
    "status": "pending_confirmation",
    "init_discovery_session_id": "uuid",
    "init_refine_session_id": "uuid",
    "active_outline_context_source": "discovery | refine",
    "summary_md": "需求摘要",
    "outline_context_md": "供大纲使用的当前初始化上下文摘要",
    "outline_context_citations": [
      {
        "citation_id": "uuid",
        "title": "来源标题",
        "url": "https://..."
      }
    ],
    "fixed_items": {
      "page_count": {
        "question_code": "page_count",
        "recommended_options": [
          {
            "option_code": "A",
            "label": "10 页",
            "page_count": 10,
            "reason": "适合高层首次沟通"
          }
        ],
        "allow_custom": true
      },
      "style_preset": {
        "question_code": "style_preset",
        "preset_ids": ["minimalism", "consulting", "tech-dark", "swiss-style", "brand-blue"]
      },
      "background_asset": {
        "question_code": "background_asset",
        "allow_upload": true,
        "required": false
      }
    },
    "ai_questions": [
      {
        "question_code": "audience_focus",
        "label": "这份 PPT 更要打动谁",
        "description": "受众会影响结构、证据和表达力度。",
        "options": [
          { "option_code": "A", "label": "业务负责人" },
          { "option_code": "B", "label": "技术负责人" },
          { "option_code": "C", "label": "管理层混合" }
        ],
        "allow_custom": true
      }
    ],
    "suggested_actions": [
      "继续沿用当前上下文",
      "按最新答案重新精确检索",
      "继续修改答案"
    ]
  }
}
```

### 4.2 需求确认条件

需求单只有在下面条件全部满足时才允许确认：

1. 已选择页数目标
2. 已选择风格预设
3. AI 补充问题全部有答案或显式跳过
4. 当前选定的 `outline_context_md` 非空
5. 对“是否继续精确重检索”已有明确结论

背景上传可以为空。

### 4.3 答案修订规则

用户在 `requirements_confirm` 前修改答案时，不做原地覆盖：

1. 当前需求单版本标记为 `draft`
2. 保留已填写答案
3. Agent 提示可选动作：沿用当前上下文 / 精确重检 / 继续补答案
4. 只有在用户明确选择精确重检时，才触发新的 `init_refine`
5. 如果发生精确重检，用新检索结果重写 `summary_md` 和 `outline_context_md`
6. 重新等待确认

---

## 5. Prompt 契约

### 5.1 `init.page_count_recommend.system`

```text
你是 AI PPT 项目的页数规划器。你的任务是根据项目主题、目标受众、首次背景调研摘要和表达复杂度，给出 3 个不同强度的页数推荐方案。

规则：
1. 只输出严格 JSON。
2. 必须输出 3 个候选项，分别适合“简洁版”“标准版”“展开版”。
3. 每个候选项都要包含 page_count、label、reason。
4. 推荐必须覆盖封面、目录、正文和收尾页。
5. 不要输出风格、背景、字体、版式建议。

输出格式：
{
  "options": [
    {
      "option_code": "A",
      "label": "简洁版",
      "page_count": 10,
      "reason": "适合首次沟通和快速决策"
    }
  ]
}
```

### 5.2 `init.page_count_recommend.user`

```text
任务：基于项目需求和首次背景调研，为 PPT 生成 3 个页数推荐选项。

输入数据(JSON)：
{
  "project": {
    "title": "{{title}}",
    "request_text": "{{request_text}}"
  },
  "init_discovery": {
    "summary_md": "{{summary_md}}"
  },
  "constraints": {
    "must_include": ["cover", "toc", "content", "ending"]
  }
}
```

### 5.3 `init.extra_questions.system`

```text
你是 AI PPT 项目的需求补全顾问。你的任务是根据首次背景调研结果，生成会影响后续大纲、研究和页面结构的补充问题。

规则：
1. 只输出严格 JSON。
2. 生成 2 到 4 个问题。
3. 每个问题都必须提供恰好 3 个候选项，且每个候选项的 `label` 必须是用户可直接理解和选择的具体内容，禁止输出“选项A / 选项B / 选项C”这类占位词。
4. 每个问题都必须允许用户自定义补充。
5. 不要生成页数、风格、背景相关问题。
6. 不要生成寒暄类废话问题。

输出格式：
{
  "questions": [
    {
      "question_code": "audience_focus",
      "label": "这份 PPT 更要打动谁",
      "description": "一句话说明问题价值",
      "options": [
        { "option_code": "A", "label": "管理层决策者" },
        { "option_code": "B", "label": "业务负责人" },
        { "option_code": "C", "label": "一线执行团队" }
      ],
      "allow_custom": true
    }
  ]
}
```

### 5.4 `init.extra_questions.user`

```text
任务：根据项目需求和首次背景调研生成补充问题。

输入数据(JSON)：
{
  "project": {
    "title": "{{title}}",
    "request_text": "{{request_text}}"
  },
  "init_discovery": {
    "summary_md": "{{summary_md}}"
  },
  "page_count_recommendation": {{page_count_recommendation_json}}
}
```

### 5.5 `init.requirement_summary.system`

```text
你是 AI PPT 项目的需求确认总结器。你的任务是把初始化阶段收集到的信息整理成一段可确认摘要，并整理出当前选定、供大纲阶段直接使用的初始化上下文。

规则：
1. 输出严格 JSON。
2. 摘要只保留会影响后续生成的关键信息。
3. 不要重复原始需求里的冗余废话。
4. 必须输出 `outline_context_md`，它只保留与大纲生成直接相关的检索结论和证据方向。

输出格式：
{
  "summary_md": "需求确认摘要",
  "outline_context_md": "供大纲使用的初始化上下文",
  "ready_for_outline": true
}
```

### 5.6 `init.requirement_summary.user`

```text
任务：整理初始化阶段结果，输出需求确认摘要。

输入数据(JSON)：
{
  "request_text": "{{request_text}}",
  "page_count_target": "{{page_count_target}}",
  "selected_style_preset_id": "{{selected_style_preset_id}}",
  "background_asset_selected": "{{background_asset_selected}}",
  "answers": {{answers_json}},
  "active_outline_context": {
    "context_source": "{{context_source}}",
    "summary_md": "{{summary_md}}",
    "selected_citations": {{selected_citations_json}}
  }
}
```

---

## 6. 表结构设计

### 6.1 `project_requirement_forms`

作用：保存一次初始化需求单。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | uuid | 主键 |
| `project_id` | uuid | 所属项目 |
| `form_version` | integer | 版本号 |
| `status` | varchar | `draft / pending_confirmation / confirmed / superseded` |
| `init_discovery_session_id` | uuid | 首次检索研究会话 |
| `init_refine_session_id` | uuid | 精确重检索研究会话，可空 |
| `active_outline_context_source` | varchar | `discovery / refine` |
| `summary_md` | text | 需求确认摘要 |
| `outline_context_md` | text | 供大纲使用的初始化上下文 |
| `created_by_agent_run_id` | uuid | 生成需求单的运行 |
| `confirmed_by_message_id` | uuid | 触发确认的消息 |
| `created_at` | timestamptz | 创建时间 |
| `updated_at` | timestamptz | 更新时间 |

### 6.2 `project_requirement_questions`

作用：保存需求单中的问题定义。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | uuid | 主键 |
| `form_id` | uuid | 所属需求单 |
| `question_code` | varchar | 问题编码 |
| `question_group` | varchar | `fixed / ai_generated` |
| `question_type` | varchar | `choice_with_custom / preset_select / file_upload_optional` |
| `label` | varchar | 问题标题 |
| `description` | text | 说明 |
| `display_order` | integer | 显示顺序 |
| `is_required` | boolean | 是否必填 |
| `meta_json` | jsonb | 扩展配置 |

### 6.3 `project_requirement_options`

作用：保存问题候选项。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | uuid | 主键 |
| `question_id` | uuid | 所属问题 |
| `option_code` | varchar | `A / B / C` |
| `label` | varchar | 选项标题 |
| `value_json` | jsonb | 结构化值 |
| `reason_text` | text | 推荐理由 |
| `display_order` | integer | 顺序 |

### 6.4 `project_requirement_answers`

作用：保存用户回答。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | uuid | 主键 |
| `form_id` | uuid | 所属需求单 |
| `question_id` | uuid | 所属问题 |
| `selected_option_id` | uuid | 选中的候选项 |
| `custom_text` | text | 自定义填写内容 |
| `answer_json` | jsonb | 结构化回答 |
| `answered_by_message_id` | uuid | 对应消息 |
| `created_at` | timestamptz | 创建时间 |

---

## 7. 完成判定

初始化阶段完成的唯一判定条件：

1. 最新版本的 `project_requirement_forms.status = confirmed`
2. 项目工作区中的 `requirements_confirm = confirmed`

满足后，项目进入 `outline`。
