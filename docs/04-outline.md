# 大纲生成设计

## 1. 业务范围

本文件定义大纲阶段，只负责下面这些事情：

1. 基于已确认需求生成 PPT 大纲
2. 创建章节与页面实体
3. 为每一页创建初始标题与内容提纲版本
4. 形成大纲确认闸门
5. 保存大纲版本

本文件不定义资料研究、页面初稿和 SVG 设计。

依赖文档：

- `01-project-workspace.md`
- `02-project-init.md`
- `03-knowledge-research.md`

下游文档：

- `03-knowledge-research.md`
- `05-page-draft.md`

---

## 2. 阶段目标

大纲阶段的目标是把项目需求转成明确的演示结构。

阶段完成时，系统必须产出：

1. 一份可确认的大纲 JSON
2. 章节列表
3. 页面列表
4. 每页的标题、角色、内容提纲和顺序
5. 每页当前可供研究使用的 `page_brief`

大纲一旦确认，就成为后续页级研究和初稿的页面骨架。

---

## 3. 大纲输出契约

大纲必须使用下面这个 JSON 结构：

```json
{
  "ppt_outline": {
    "cover": {
      "title": "引人注目的主标题",
      "sub_title": "副标题",
      "content": []
    },
    "table_of_contents": {
      "title": "目录",
      "content": ["第一部分标题", "第二部分标题"]
    },
    "parts": [
      {
        "part_title": "第一部分：章节标题",
        "pages": [
          {
            "title": "页面标题1",
            "content": ["要点1", "要点2"]
          },
          {
            "title": "页面标题2",
            "content": ["要点1", "要点2"]
          }
        ]
      }
    ],
    "end_page": {
      "title": "总结与展望",
      "content": []
    }
  }
}
```

### 3.1 页面角色映射

系统按固定规则把大纲映射为页面角色：

1. `cover` -> `cover`
2. `table_of_contents` -> `toc`
3. `parts[].pages[]` -> `content`
4. `end_page` -> `end`

### 3.2 页面编号规则

页面编号由系统生成，不由模型直接输出：

```text
page-01
page-02
page-03
...
```

### 3.3 大纲确认条件

大纲只有在下面条件满足时才允许确认：

1. 章节顺序完整
2. 页面数量与需求单目标一致或在可接受误差内
3. 每页都有 `title`
4. 每页都有 `content`

### 3.4 页面简报

页面研究和页面初稿不直接读取整份大纲 JSON，而是只读取目标页当前生效的 `page_brief`。

`page_brief` 只包含：

1. `title`
2. `content_outline`
3. `content_summary`

当页级 `title` 或 `content_outline` 被重新处理时，系统允许注入其他页面的标题与摘要，只用于重复自检，不用于直接复用内容。

### 3.5 单页修订边界

大纲确认后，仍允许在页级范围修订单页标题和内容提纲。

规则如下：

1. 修改单页标题或内容提纲，不重做整份大纲
2. 系统为目标页创建新的 `page_brief_version`
3. 在写入前，先用其他页面的标题和内容摘要做重复自检
4. 如果发现明显重复，先把风险提示给用户确认或修改
5. 只有在用户确认采用新版本后，才更新该页当前生效 `page_brief_version`
6. 确认采用新版本后，只将该页下游研究、初稿、设计状态标记为 `stale`
7. 是否立即重建该页研究，由用户决定；如果用户要继续进入初稿，则必须先补齐与当前 `page_brief_version` 匹配的研究
8. 章节顺序、页数目标、章节结构变化才触发整份大纲重做

---

## 4. 阶段流程

### 4.1 输入

大纲阶段只接受下面三类输入：

1. 已确认需求单
2. `outline_context_md`
3. 项目级补充指令

### 4.2 执行步骤

1. 读取需求确认结果
2. 读取需求单中当前选定的 `outline_context_md`
3. 调用大纲生成提示词
4. 解析 `ppt_outline`
5. 写入大纲版本
6. 写入章节实体
7. 写入页面实体
8. 为每个页面创建首个 `page_brief_version`
9. 打开 `outline_confirm` 闸门

### 4.3 修订规则

用户要求改大纲时：

1. 创建新版本，不覆盖前一版本
2. 重新计算章节和页面结构
3. 标记前一版本为 `superseded`
4. 下游研究、初稿、设计版本按页受影响范围失效

### 4.4 单页标题与内容提纲修订

用户在共享聊天里针对单页提出修改时：

1. 识别 `target_page_id`
2. 读取当前 `page_brief_version`
3. 调用单页修订提示词
4. 生成新的 `page_brief_version`
5. 运行跨页重复自检
6. 将自检结果和候选版本返回给用户确认或继续修改
7. 确认采用后，再更新 `project_pages.current_brief_version_id`
8. 确认采用后，再将该页研究、初稿、设计上下文标记为 `stale`
9. Agent 提供后续选项：立即重检 / 继续调整 / 暂不处理

---

## 5. Prompt 契约

### 5.1 `outline.generate.system`

```text
你是 AI PPT 项目的大纲架构师。你的任务是根据项目主题、需求确认结果和当前选定的初始化上下文，生成一份逻辑清晰、适合演示表达的 PPT 大纲。

规则：
1. 只输出严格 JSON。
2. 输出必须使用 [PPT_OUTLINE] 和 [/PPT_OUTLINE] 包裹。
3. 大纲必须包含封面、目录、正文章节和收尾页。
4. 正文章节必须围绕明确的主线展开。
5. 每页 content 只保留该页的核心要点，不要输出长段落。
6. 结果必须符合固定 JSON 结构。

输出格式：
[PPT_OUTLINE]
{
  "ppt_outline": {
    "cover": {
      "title": "字符串",
      "sub_title": "字符串",
      "content": []
    },
    "table_of_contents": {
      "title": "目录",
      "content": ["字符串"]
    },
    "parts": [
      {
        "part_title": "字符串",
        "pages": [
          {
            "title": "字符串",
            "content": ["字符串"]
          }
        ]
      }
    ],
    "end_page": {
      "title": "字符串",
      "content": []
    }
  }
}
[/PPT_OUTLINE]
```

### 5.2 `outline.generate.user`

```text
任务：根据项目需求和当前选定的初始化上下文生成 PPT 大纲。

输入数据(JSON)：
{
  "project": {
    "title": "{{project_title}}",
    "request_text": "{{request_text}}",
    "page_count_target": "{{page_count_target}}"
  },
  "requirements": {
    "summary_md": "{{summary_md}}",
    "answers": {{answers_json}}
  },
  "outline_context": {
    "summary_md": "{{outline_context_md}}",
    "selected_citations": {{selected_citations_json}}
  }
}
```

### 5.3 `outline.revise.system`

```text
你是 AI PPT 项目的大纲修订器。你的任务是在保留项目主题和已确认需求边界的前提下，根据最新修改意见生成新的大纲版本。

规则：
1. 只输出严格 JSON。
2. 继续使用 [PPT_OUTLINE] 和 [/PPT_OUTLINE] 包裹。
3. 修订必须优先响应最新指令。
4. 不要输出解释文字。
```

### 5.4 `outline.revise.user`

```text
任务：根据最新修改意见生成新的大纲版本。

输入数据(JSON)：
{
  "latest_outline": {{latest_outline_json}},
  "latest_instruction": "{{latest_instruction}}",
  "requirements": {{requirements_json}},
  "outline_context": {{outline_context_json}}
}
```

### 5.5 `outline.page_brief_revise.system`

```text
你是 AI PPT 项目的单页标题与内容提纲修订器。你的任务是在不改变整份大纲章节结构的前提下，根据目标页当前内容、项目需求和最新页级指令，生成新的页面标题与内容提纲版本。

规则：
1. 只输出严格 JSON。
2. 只能修改目标页，不要输出其他页。
3. 必须输出 `title`、`content_outline`、`content_summary`。
4. 需要结合其他页面的标题和摘要做重复自检。
5. 修改结果必须服务当前项目主线。
6. 不要输出解释文字。

输出格式：
{
  "page_brief": {
    "title": "字符串",
    "content_outline": ["字符串"],
    "content_summary": "字符串"
  },
  "self_check": {
    "risk_level": "low | medium | high",
    "overlap_pages": [
      {
        "page_id": "uuid",
        "reason": "与目标页重复的原因"
      }
    ],
    "suggestion": "一句话修改建议"
  }
}
```

### 5.6 `outline.page_brief_revise.user`

```text
任务：根据最新页级指令修订目标页标题与内容提纲。

输入数据(JSON)：
{
  "project": {
    "title": "{{project_title}}",
    "requirement_summary": "{{requirement_summary}}"
  },
  "page": {
    "page_id": "{{page_id}}",
    "page_code": "{{page_code}}",
    "page_brief_version_id": "{{page_brief_version_id}}",
    "title": "{{title}}",
    "content_outline": {{content_outline_json}},
    "content_summary": "{{content_summary}}"
  },
  "cross_page_outline_view": {{cross_page_outline_view_json}},
  "outline_context": {
    "summary_md": "{{outline_context_md}}"
  },
  "latest_instruction": "{{latest_instruction}}"
}
```

---

## 6. 表结构设计

### 6.1 `project_outline_versions`

作用：保存大纲版本。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | uuid | 主键 |
| `project_id` | uuid | 所属项目 |
| `version_no` | integer | 版本号 |
| `status` | varchar | `draft / pending_confirmation / confirmed / superseded` |
| `outline_json` | jsonb | 标准大纲 JSON |
| `summary_md` | text | 大纲摘要 |
| `created_by_agent_run_id` | uuid | 生成该版本的运行 |
| `confirmed_by_message_id` | uuid | 确认消息 |
| `created_at` | timestamptz | 创建时间 |
| `updated_at` | timestamptz | 更新时间 |

### 6.2 `project_outline_sections`

作用：保存章节实体。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | uuid | 主键 |
| `outline_version_id` | uuid | 所属大纲版本 |
| `part_index` | integer | 章节顺序 |
| `part_title` | varchar | 章节标题 |
| `summary_md` | text | 章节摘要 |
| `created_at` | timestamptz | 创建时间 |

### 6.3 `project_pages`

作用：保存页面实体。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | uuid | 主键 |
| `project_id` | uuid | 所属项目 |
| `outline_version_id` | uuid | 来源大纲版本 |
| `section_id` | uuid | 所属章节 |
| `current_brief_version_id` | uuid | 当前生效页面简报版本 |
| `page_code` | varchar | 页面编码，如 `page-07` |
| `page_order` | integer | 页顺序 |
| `page_role` | varchar | `cover / toc / content / end` |
| `title` | varchar | 页面标题 |
| `content_outline_json` | jsonb | 内容提纲数组 |
| `content_summary` | text | 页面摘要 |
| `status` | varchar | `active / stale / removed` |
| `created_at` | timestamptz | 创建时间 |
| `updated_at` | timestamptz | 更新时间 |

### 6.4 `project_page_brief_versions`

作用：保存页级标题与内容提纲版本。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | uuid | 主键 |
| `project_id` | uuid | 所属项目 |
| `page_id` | uuid | 所属页面 |
| `version_no` | integer | 版本号 |
| `status` | varchar | `draft / pending_confirmation / active / superseded` |
| `title` | varchar | 页面标题 |
| `content_outline_json` | jsonb | 内容提纲 |
| `content_summary` | text | 页面摘要 |
| `self_check_json` | jsonb | 与其他页面的重复自检结果 |
| `created_by_agent_run_id` | uuid | 创建运行 |
| `created_by_message_id` | uuid | 来源消息 |
| `created_at` | timestamptz | 创建时间 |

---

## 7. 完成判定

大纲阶段完成的唯一判定条件：

1. 最新版本的 `project_outline_versions.status = confirmed`
2. 项目工作区中的 `outline_confirm = confirmed`

确认后，页级研究才允许启动。
