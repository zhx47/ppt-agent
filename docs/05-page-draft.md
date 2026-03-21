# 页面初稿设计

## 1. 业务范围

本文件定义页面初稿阶段，只负责下面这些事情：

1. 根据页面实体和页级研究生成页面初稿
2. 固定页面内容卡片与 Bento Grid 骨架
3. 生成带完整内容、简单样式的原始 SVG 初稿
4. 形成初稿确认闸门
5. 保存页级初稿版本

本文件不定义风格着色、背景图处理和 SVG 细节渲染。

依赖文档：

- `01-project-workspace.md`
- `03-knowledge-research.md`
- `04-outline.md`

下游文档：

- `06-svg-design.md`

---

## 2. 阶段目标

页面初稿阶段只解决三个问题：

1. 这一页讲什么
2. 这一页如何用 Bento Grid 承载内容
3. 这一页如何输出无项目风格的原始 SVG 初稿

初稿阶段完成后，页面应该已经明确：

1. 页面完整内容
2. 符合内容需求的 Bento 布局
3. 原始 SVG
4. 已吸收当前页研究资料后的表达结果

这一层可以带完整内容和中性、简单、服务排版的基础样式，但不允许注入项目风格、品牌风格和复杂装饰语言。

---

## 3. 初稿输出契约

### 3.1 模型输出规则

初稿模型的响应只认一个产物：

```text
<svg>...</svg>
```

规则只有四条：

1. 只接受单个完整 SVG 文档
2. 画布必须是 `1280x720`
3. 不接受 JSON、Markdown、解释文字和多段混合输出
4. 应用层只从响应中提取 SVG，不从响应中假设额外结构化字段

### 3.2 应用层提取规则

应用层处理初稿响应时，只做下面这些事情：

1. 提取第一个完整 `<svg>...</svg>` 片段
2. 校验 `width`、`height` 或 `viewBox` 是否符合 `1280x720`
3. 绑定运行时上下文中的 `project_id`、`page_id`、`page_brief_version_id`、`research_session_id`、`version_no`、`status`
4. 将提取结果保存到 `draft_svg_markup`
5. 如果未提取到合法 SVG，则本次运行失败，不创建伪造 JSON 数据

### 3.3 初稿确认条件

每页初稿只有在下面条件满足时才允许确认：

1. `draft_svg_markup` 非空
2. 输出为单个合法 SVG 文档
3. 画布为 `1280x720`
4. 页面内容完整，不是占位框和伪文案
5. 布局符合 Bento Grid 原则
6. 样式中性、简单、无项目风格注入
7. 绑定的页级研究会话处于最新有效状态

---

## 4. 阶段流程

### 4.1 输入

页面初稿只接受下面输入：

1. 当前生效的 `page_brief_version`
2. 当前页最新有效研究结果
3. 页级最新用户指令

如果目标页研究结果已失效，初稿阶段不允许直接运行，必须先回到页级研究。

### 4.2 执行步骤

1. 读取 `project_pages`
2. 读取 `project_page_brief_versions`
3. 读取目标页研究会话
4. 校验该研究会话是否对应当前 `page_brief_version`
5. 如不对应，则先阻断并要求重检
6. 调用初稿提示词
7. 从响应中提取 `draft_svg_markup`
8. 执行 SVG 合法性校验
9. 写入版本表
10. 写入初稿确认记录
11. 打开 `draft_confirm`

### 4.3 修订规则

用户修改初稿时，只允许重做目标页：

1. 创建目标页新的 draft 版本
2. 前一版本标记为 `superseded`
3. 该页 design 版本标记为 `stale`
4. 其他页不受影响

### 4.4 反向修改边界

用户在页级聊天中提出修改时，系统必须先判断修改落点：

1. 只改表达轻重、卡片组织、版面承载方式
   直接重做 `draft(page)`
2. 改页标题、改页内容提纲、改证据方向、改研究重点
   先创建新的 `page_brief_version`
   再执行 `research(page)`
   最后执行 `draft(page)`

---

## 5. Prompt 契约

### 5.1 `draft.page_generate.system`

系统提示词固定使用下列原文，不追加任何角色定义、规则补丁和输出格式说明：

```text
内容页的便当网格 (Bento Grid) 布局
这是一种灵活的网格系统，其布局应由内容本身的需求驱动，而非僵硬的模板。通过组合不同尺寸的卡片，创造出动态且视觉有趣的布局。
- 核心原则:
    - 灵活性: 卡片数量不固定。可以是 1, 2, 3, 4, 5 或更多个，取决于如何更好地呈现信息。
    - 层级感: 使用卡片尺寸建立视觉层级。最重要的信息放在最大的卡片上。
    - 留白: 在所有卡片之间保持至少 20px 的间距。
- 布局组合示例:
    - 单一焦点: 一张大卡片覆盖大部分区域 (w=1200, h=580)。适用于单一、有力的信息或详细的图表。
    - 两栏布局:
        - 50/50 对称: 两张等宽的卡片。
        - 非对称: 一张较宽的卡片（如 2/3 宽度）用于主内容，一张较窄的（1/3 宽度）用于辅助信息、数据或图片。
    - 三栏布局: 三张等宽的卡片，适合并列比较三项内容。
    - 主次结合: 一张大的居中卡片，两侧各一张小的垂直卡片。
    - 顶部英雄式: 顶部一张宽幅“英雄”卡片，下方是 2-4 个较小的等宽卡片网格。
    - 混合网格 (自由度最高): 自由混合各种尺寸的卡片，例如一个中等方块、两个小的水平矩形和一个垂直矩形。这种方式可以极大地适应不同内容的需求。
```

### 5.2 `draft.page_generate.user`

```text
任务：生成目标页初稿。

要求：
1. 根据输入内容生成完整页面内容，不要只给骨架占位。
2. 使用系统提示词中的 Bento Grid 原则组织版面。
3. 只输出单个完整 `<svg>...</svg>` 文档，不要输出 JSON、Markdown 和解释文字。
4. 画布必须是 `1280x720`。
5. 初稿可以有基础样式，但只能是中性、简单、服务排版的基础样式；不得注入 `style_pack`、品牌风格、复杂装饰和强视觉主题。
6. 必须优先使用当前页研究结果中的证据和结论。
7. 不要编造 research 中没有的事实。

输入数据(JSON)：
{
  "canvas": {
    "width": 1280,
    "height": 720
  },
  "page_brief": {
    "page_id": "{{page_id}}",
    "page_code": "{{page_code}}",
    "page_brief_version_id": "{{page_brief_version_id}}",
    "title": "{{title}}",
    "content_outline": {{content_outline_json}},
    "content_summary": "{{content_summary}}"
  },
  "research": {
    "research_session_id": "{{research_session_id}}",
    "summary_md": "{{summary_md}}",
    "selected_sources": {{selected_sources_json}}
  },
  "latest_instruction": "{{latest_instruction}}"
}
```

### 5.3 `draft.page_revise.system`

```text
复用 `draft.page_generate.system` 的同一固定原文，不新增系统提示词。
```

### 5.4 `draft.page_revise.user`

```text
任务：根据最新修改意见修订页面初稿。

要求：
1. 继续遵守系统提示词中的 Bento Grid 原则。
2. 只输出单个完整 `<svg>...</svg>` 文档，不要输出 JSON、Markdown 和解释文字。
3. 修订后的 SVG 仍然只能使用中性、简单、无项目风格的基础样式。
4. 必须继续服从当前页最新有效研究结果。
5. 如果修改要求本质上在改页标题、内容提纲或证据方向，本次修订应被上游拦截到页级研究，不在初稿阶段直接处理。
6. 不要引入与 research 冲突的新事实。
7. 画布必须保持 `1280x720`。

输入数据(JSON)：
{
  "current_draft_svg": "{{current_draft_svg}}",
  "page_brief": {{page_brief_json}},
  "research": {{research_json}},
  "latest_instruction": "{{latest_instruction}}"
}
```

---

## 6. 表结构设计

### 6.1 `project_page_draft_versions`

作用：保存页级初稿版本。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | uuid | 主键 |
| `project_id` | uuid | 所属项目 |
| `page_id` | uuid | 所属页面 |
| `version_no` | integer | 版本号 |
| `status` | varchar | `draft / pending_confirmation / confirmed / superseded` |
| `page_brief_version_id` | uuid | 对应页标题与内容提纲版本 |
| `research_session_id` | uuid | 对应页级研究会话 |
| `draft_svg_markup` | text | 原始 SVG 初稿 |
| `created_by_agent_run_id` | uuid | 创建运行 |
| `created_at` | timestamptz | 创建时间 |
| `updated_at` | timestamptz | 更新时间 |

### 6.2 `project_draft_confirmations`

作用：记录初稿确认状态。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | uuid | 主键 |
| `project_id` | uuid | 所属项目 |
| `page_id` | uuid | 所属页面 |
| `draft_version_id` | uuid | 对应初稿版本 |
| `status` | varchar | `pending / confirmed / rejected` |
| `confirmed_by_message_id` | uuid | 确认消息 |
| `note_md` | text | 备注 |
| `created_at` | timestamptz | 创建时间 |
| `updated_at` | timestamptz | 更新时间 |

---

## 7. 完成判定

页面初稿阶段的完成判定分两层：

1. 页级完成：目标页最新 `project_draft_confirmations.status = confirmed`
2. 阶段完成：所有活动页都已确认，且 `draft_confirm = confirmed`

完成后，目标页才允许进入 SVG 设计阶段。
