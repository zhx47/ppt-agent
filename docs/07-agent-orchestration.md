# Agent 编排设计

## 1. 业务范围

本文件只定义端到端业务流程、Agent 作用域和重跑路径。

本文件不重复定义各阶段的提示词细节、表结构字段和产物格式，这些内容分别归属对应业务文档。

编排层只定义默认链路、阻断条件和可选动作，不把 Agent 写成无条件自动执行的流程机。除业务硬依赖外，下一步始终优先服从用户意愿。

依赖文档：

- `01-project-workspace.md`
- `02-project-init.md`
- `03-knowledge-research.md`
- `04-outline.md`
- `05-page-draft.md`
- `06-svg-design.md`

---

## 2. 作用域模型

系统只允许两种 Agent 作用域：

1. `project_scope`
   只用于 `init` 和整份 `outline`
2. `page_scope`
   只用于单页标题与内容提纲修订，以及单页 `research / draft / design` 的主上下文

切换规则只有四条：

1. 项目创建后，先进入 `project_scope`
2. `outline` 确认后，才允许创建页级 `page_scope`
3. 一个 `page_scope` 只服务一个 `page_id`
4. 页标题或内容提纲变化后，旧 `page_scope` 主上下文立即失效；只有在用户继续该页流程或存在下游硬依赖时，才重建匹配上下文

这里的“页级作用域”是主上下文隔离，不是信息孤岛。

系统允许为 `page_scope` 挂一个只读的 `cross_page_outline_view`，只用于跨页重复检测和主线一致性自检。

---

## 3. 端到端流程

### 3.1 项目初始化

默认起始链路如下：

1. 读取首页原始需求
2. 执行项目级首次检索
3. 生成页数推荐和补充问题
4. 等待用户回答与修正
5. Agent 提示可选动作：沿用当前上下文 / 执行精确重检 / 继续修改答案
6. 用户如选择精确重检，再执行项目级精确重检索
7. 产出当前生效的 `outline_context_md`
8. 打开 `requirements_confirm`

这一阶段只有项目级上下文，没有页级上下文。

如果用户继续修改答案，或明确表示暂时沿用当前上下文，系统停在当前确认点，不自动发起精确重检。

### 3.2 大纲生成

大纲阶段输入只允许来自三类信息：

1. `project.request_text`
2. 已确认的补充答案
3. `outline_context_md`

大纲确认后，系统必须立即完成两件事：

1. 创建页面实体
2. 为每一页创建首个 `page_brief_version`

### 3.3 页级检索

页级检索不是项目级检索的继续，而是独立的单页会话。

每一页的研究输入固定为：

1. 当前页 `title`
2. 当前页 `content_outline`
3. 当前页 `content_summary`
4. 项目需求摘要
5. `outline_context_md`
6. 当前页最新用户指令
7. `cross_page_outline_view`

系统在 `outline_confirm` 后默认进入页级研究编排，并为每个内容页创建待执行研究任务。Project Orchestrator 可以顺序自动拉起这些任务；但如果用户先提出页级修改、暂停或改研究方向，必须先响应用户，再决定是否执行原计划任务。

### 3.4 页级研究确认

页级研究完成后，系统默认停在研究确认，不直接进入初稿。此时必须允许下面三种用户动作：

1. 确认当前页资料方向
2. 要求目标页重新检索
3. 先修改目标页标题或内容提纲

如果用户要求修改当前页标题或内容提纲，系统先修订 `page_brief_version`，并在写入前执行跨页重复自检。

自检结果必须作为交互项返回给用户，用于确认采用、继续修改或放弃候选版本。

一旦用户确认采用新的 `page_brief_version`，当前页研究会话立刻标记为 `stale`，但是否马上重做该页研究仍由用户决定。只有在用户要继续进入 `draft`，且研究会话与当前 `page_brief_version` 不匹配时，页级重检才变成强制前置动作。

### 3.5 页面初稿

页面初稿只读取下面三类输入：

1. 当前页 `page_brief_version`
2. 当前页最新有效研究会话
3. 当前页最新用户指令

如果研究会话与当前 `page_brief_version` 不匹配，初稿阶段必须阻断，不能直接继续生成。

### 3.6 页面设计稿

设计稿阶段只读取：

1. `draft_svg_markup`
2. `style_pack`
3. `background_asset`

设计阶段不再拥有修改标题、内容提纲和证据方向的权限。

---

## 4. 用户修改如何路由

### 4.1 项目级消息

下面这些请求属于项目级：

1. 改项目目标
2. 改页数
3. 改整体受众
4. 改是否要竞品分析
5. 改整份大纲章节结构

项目级修改会影响多页，因此必须回到 `project_scope`。

但是否立即执行精确检索、是否立即重跑后续阶段，仍然由用户意愿决定；Agent 只能给建议，不能擅自推进非强制动作。

### 4.2 页级消息

下面这些请求属于页级：

1. 某一页资料方向不对
2. 某一页标题不对
3. 某一页内容提纲不对
4. 某一页初稿布局要调整
5. 某一页视觉需要优化

页级消息始终先定位 `target_page_id`，再进入对应 `page_scope`。

### 4.3 路由原则

用户消息进入系统后，按下面顺序判断：

1. 是项目级还是页级
2. 改的是需求、标题提纲、研究、初稿还是设计
3. 这是明确执行指令，还是在讨论可选动作
4. 是否需要先重建上下文
5. 是否需要回退到更上游阶段

---

## 5. 重跑矩阵

| 触发动作 | 建议链路 |
|---|---|
| 修改初始化答案 | `Agent 提议：沿用当前上下文 / init_refine -> outline -> page_research -> draft -> design` |
| 修改整份大纲 | `outline -> page_research -> draft -> design` |
| 修改单页标题 | `page_brief(self_check) -> 标记当前 research stale -> Agent 提议：立即 page_research / 继续改 brief / 暂不执行` |
| 修改单页内容提纲 | `page_brief(self_check) -> 标记当前 research stale -> Agent 提议：立即 page_research / 继续改 brief / 暂不执行` |
| 修改单页研究方向 | `page_research -> draft -> design` |
| 修改单页版面承载 | `draft -> design` |
| 修改单页视觉风格 | `design` |

系统必须选择最小重跑范围，不能为了省事重跑整项目。

这张表表示建议链路，不代表 Agent 可以绕过用户直接执行所有非强制步骤。

---

## 6. 页级上下文注入契约

每次页级 `research / draft / design` 调用前，都必须先组装 `page_context`：

```json
{
  "project": {
    "project_id": "uuid",
    "requirement_summary": "字符串",
    "outline_context_md": "字符串"
  },
  "page": {
    "page_id": "uuid",
    "page_code": "page-07",
    "page_brief_version_id": "uuid",
    "title": "页面标题",
    "content_outline": ["要点1", "要点2"],
    "content_summary": "页面摘要"
  },
  "cross_page_outline_view": [
    {
      "page_id": "uuid",
      "title": "其他页标题",
      "content_summary": "其他页摘要"
    }
  ],
  "research": {
    "research_session_id": "uuid",
    "summary_md": "页级研究摘要",
    "selected_citations": []
  },
  "draft": {
    "draft_version_id": "uuid",
    "draft_svg_markup": "<svg>...</svg>"
  },
  "latest_instruction": "用户针对该页的最新要求"
}
```

注入规则：

1. `research` 阶段不注入 `draft`
2. `draft` 阶段必须注入最新有效 `research`
3. `design` 阶段必须注入最新有效 `draft`
4. 允许注入其他页面的只读标题与摘要视图，但不允许混入其他页的完整研究与草稿上下文

---

## 7. 阶段闸门

系统按下面顺序停顿：

1. `requirements_confirm`
2. `outline_confirm`
3. `research_confirm`
4. `draft_confirm`
5. `design_confirm`

其中：

1. `requirements_confirm` 和 `outline_confirm` 是项目级闸门
2. `research_confirm`、`draft_confirm`、`design_confirm` 在执行上是页级产物汇总后的项目级闸门

---

## 8. 落地原则

只有三条，够用了：

1. 项目级问题在项目级解决，页级问题在页级解决，不要混作用域。
2. 研究必须先于初稿，初稿必须先于设计，不要跳阶段。
3. 标题和内容提纲一旦变化，旧研究立即失配；继续出稿前必须补齐与当前 `page_brief_version` 匹配的研究，不要拿旧资料硬拼新页面。
