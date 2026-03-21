## 0. 需求同步约束

完成所有的前后端改造，同步目前统计出来与需求的差异，完成agent的功能，记住：

1. 项目现在是刚起步阶段，可以直接使用 .env 里面的测试环境数据
2. 项目显示刚起步，没有任何有价值的历史数据，发生数据库变更，可以直接进行清空数据库，不需要写特殊逻辑兼容所谓老版本
3. 禁止任何无意义的fallback，只会造成我最终验证的时候以为是正常的，实际上是完全错误的。
4. 无用的代码不需要保留，保证出版的代码是干净的
5. static下面是老版本的静态poc mock前端，但是里面已经有几个占位的agent消息是怎么展示的，这是ui确认过的，可以进行参考进行展示agent消息
6. 压缩消息也不能把这些条件压缩掉，要保证即使是多轮压缩的，我们的约束依然是清晰的

## 1. 文档使用方式

### 1.1 实现时必须怎么使用

后续任何实现、拆任务、代码评审，都必须同时回答下面 4 个问题：

1. 这个实现对应文档中的哪一个阶段、哪一个步骤、哪一个动作
2. 这个实现的输入是不是和文档一致
3. 这个实现有没有违反文档里的禁止行为
4. 这个实现完成后，状态变化是不是和文档一致

如果答不出来，说明实现又开始漂了。

---

## 2. 核心定义

## 2.1 项目主阶段

项目主阶段只用于描述当前主工作面，不是强制串行流水线。

允许的主阶段：

- `init`
- `outline`
- `search`
- `draft`
- `design`
- `export`

### 阶段语义

- `init`
  - 初始化需求补全与资料建立阶段

- `outline`
  - 锁死的大纲生成中阶段
  - 这是后台生成态，不是用户工作台

- `search`
  - 大纲生成后的第一个可交互工作台
  - 页面标题、要点修正，以及页面资料搜索，都从这里开始

- `draft`
  - 页面初稿工作台

- `design`
  - 页面设计稿工作台

- `export`
  - 导出阶段

## 2.2 页面级状态

每个页面必须单独维护以下状态：

- `outline_status`
- `search_status`
- `summary_status`
- `draft_status`
- `design_status`

每个状态至少支持：

- `empty`
- `ready`
- `running`
- `confirmed`
- `stale`
- `failed`

### 状态语义

- `empty`
  - 这个阶段的产物还不存在

- `ready`
  - 产物已生成，可继续使用，但还没有被用户确认

- `running`
  - 当前阶段正在执行

- `confirmed`
  - 用户已经确认该阶段产物可用

- `stale`
  - 该阶段产物存在，但其上游数据已改变，当前产物可能过期

- `failed`
  - 当前阶段执行失败，需要重试或人工修正

## 2.3 资料池定义

系统必须存在两类资料池，而且要彻底隔离：

- `init_corpus`
  - 项目级资料池
  - 只服务初始化问题补全和大纲生成

- `page_corpus`
  - 页面级资料池
  - 每个页面一个独立资料池
  - 只服务当前页面的搜索、summary、draft、design

### 强约束

- `init_corpus` 不能参与页面级向量召回
- 页面 A 的 `page_corpus` 不能参与页面 B 的向量召回
- 页面级正文不能因为“已经搜过了”就自动复用到别的页面
- 允许共用 URL 缓存，但不允许共用页面级向量检索池

这里必须分清：

- “网络抓取缓存”可以共用，目的是省钱
- “页面向量召回语义空间”不能共用，目的是防止页面职责混乱

## 2.4 固定项定义

初始化阶段必须采集的固定项：

- `page_count_target`
- `style_preset`

初始化阶段可选项：

- `background_asset`

### 强约束

- `style_preset` 是必填项
- `background_asset` 不是必填项
- 不能因为没背景图而阻塞大纲、搜索、draft、design 主流程

---

## 3. 全局行为约束

## 3.1 不允许“假 agent”

聊天框不是备注框。只要用户在聊天框输入内容，系统就必须做下面两件事中的至少一件：

1. 执行一个明确动作
2. 明确拒绝并告诉用户缺什么信息

禁止出现这种假反馈：

- “已记录你的要求”
- “系统会自行判断后续动作”

但前端和后端实际上什么都没做，或者没返回决策依据。

## 3.2 不允许“假智能判断”

任何写成“智能判断”“自动规划”“按需处理”的地方，都必须被展开成：

- 用了哪些输入
- 产出什么结构
- 允许做什么动作
- 什么情况下禁止执行

否则就是空话。

## 3.3 不允许强制回滚整条流程

如果用户在后期阶段修改了上游数据：

- 不允许删除现有 draft / design
- 不允许强制把项目主阶段切回更早阶段
- 只允许把受影响的下游产物标记为 `stale`
- 是否重跑，由用户动作或 router 建议触发

## 3.4 不允许自动搜索整份项目

除非用户点击批量执行按钮，或者 router 在一个明确的批处理动作里返回 `should_execute=true`，否则系统不能自动对所有页面执行搜索、summary、draft、design。

### 强约束

- 大纲生成结束后，直接进入搜索页，但不自动搜索
- 搜索页打开后，不自动搜索
- draft 页打开后，不自动生成初稿
- design 页打开后，不自动生成设计稿

---

## 4. `workspace.intent_router` 详细规范

## 4.1 Router 的角色

`workspace.intent_router` 不是内容生成器，也不是纯分类器。

它的唯一职责是：

1. 识别这条消息作用在哪
2. 识别这条消息到底想改什么
3. 判断当前数据够不够执行
4. 给出明确的动作计划
5. 给出下一步推荐

## 4.2 Router 输入

### 项目级通用输入

每次调用 router，必须至少传入：

- `project_id`
- `project_stage`
- `ui_surface`
  - `init`
  - `outline_loading`
  - `search`
  - `draft`
  - `design`
- `latest_user_message`
- `recent_messages`
- `project_request`
- `fixed_fields`
  - `page_count_target`
  - `style_preset`
  - `background_asset`
- `project_level_status_summary`
- `outline_state_snapshot`

### 页面级额外输入

如果当前消息是页面级消息，必须额外传入：

- `page_id`
- `page_title`
- `page_bullets`
- `page_section_title`
- `page_outline_status`
- `page_search_status`
- `page_summary_status`
- `page_draft_status`
- `page_design_status`
- `page_search_queries`
- `page_corpus_digest`
- `page_summary_digest`
- `current_artifact_staleness`
- `outline_full_snapshot`

### 为什么必须带 `outline_full_snapshot`

这是强约束。

页面级标题和要点修改不能只看当前页，否则一定会出现：

- 和其他页重复
- 和其他页职责冲突
- 同一章节内内容重叠

所以页面级结构修正必须同时带：

- 当前页
- 全体章节
- 全体页面标题
- 全体页面要点

## 4.3 Router 输出

Router 返回值必须是结构化对象，不能只是一句理由。

建议最小结构：

```json
{
  "scope_type": "project | page",
  "target_stage": "init | outline | search | draft | design | export",
  "target_page_id": "string | null",
  "intent_type": "string",
  "action_type": "string",
  "should_execute": true,
  "needs_clarification": false,
  "requires_confirmation": false,
  "missing_data": ["string"],
  "data_updates": {
    "question_patch": null,
    "answer_patch": null,
    "outline_patch": null,
    "page_patch": null,
    "summary_patch": null
  },
  "execution_plan": [
    {
      "step_code": "string",
      "step_name": "string",
      "reason": "string"
    }
  ],
  "next_recommendations": [
    {
      "code": "string",
      "label": "string",
      "reason": "string"
    }
  ],
  "reason": "string"
}
```

## 4.4 Router 允许输出的动作

必须至少支持：

- `init_refresh_search`
- `init_add_question`
- `init_update_question`
- `init_delete_question`
- `init_update_answer`
- `init_confirm_to_outline`
- `outline_generate`
- `page_update_outline_in_search`
- `page_generate_search_queries`
- `page_search_run`
- `page_search_refresh`
- `page_summary_generate`
- `page_summary_edit`
- `page_draft_generate`
- `page_design_generate`
- `project_batch_search`
- `project_batch_summary`
- `project_batch_draft`
- `project_batch_design`

## 4.5 Router 动作语义解释

### `page_update_outline_in_search`

这不是搜索动作。

它只负责：

- 修改当前页标题
- 修改当前页要点
- 新增/删除要点
- 调整页面结构

执行后必须：

- 更新 `outline_state`
- 标记受影响的 `summary` / `draft` / `design` 为 `stale`

禁止行为：

- 不允许在这个动作里直接调用 Bocha
- 不允许顺手自动重搜

### `page_generate_search_queries`

这不是联网搜索。

它只负责把当前页结构化需求翻译成一组可直接提交给 Bocha 的搜索词集合。

输入必须来自：

- 当前页标题
- 当前页要点
- 当前页所在章节
- 全量大纲快照
- 用户补充限制

输出必须包含：

- `page_search_queries`
- 每条 query 的用途说明

禁止行为：

- 不允许抓正文
- 不允许写入 `page_corpus`

### `page_search_run`

这才是正式搜索动作。

它负责：

1. 读取 `page_search_queries`
2. 调用 Bocha
3. 获取正文
4. chunk + embedding
5. 写入当前页 `page_corpus`

禁止行为：

- 不允许从别的页面资料池召回
- 不允许顺手生成 draft / design

### `page_search_refresh`

这是重跑当前页搜索。

它的语义是：

- 用最新结构和最新搜索词集合，覆盖或替换当前页旧资料池

执行前必须明确：

- 是覆盖当前页旧资料，还是保留并追加

默认行为：

- 默认覆盖，不做混合追加

### `page_summary_generate`

这不是搜索。

它只负责：

- 只从当前页 `page_corpus` 做向量召回
- 生成详实 `summary`

禁止行为：

- 不允许联网
- 不允许修改标题和要点

### `page_summary_edit`

这是对 summary 的编辑动作，不是重搜动作。

执行后：

- 更新 `summary`
- 标记相关 draft / design 为 `stale`

禁止行为：

- 不自动重搜
- 不自动重生 draft

---

## 5. 初始化阶段详细规范

## 5.1 阶段目标

初始化阶段必须完成以下目标：

1. 建立项目级 `init_corpus`
2. 快速生成首轮页数推荐
3. 快速生成首轮智能问题
4. 允许用户补全和修正问题、答案、固定项
5. 在数据满足条件后进入大纲生成

## 5.2 初始化阶段步骤总览

初始化阶段按默认主链路分成 7 个步骤：

- I1：创建项目
- I2：生成初始化搜索词
- I3：Bocha 搜索
- I4：基于 Bocha 摘要快速生成问题
- I5：抓正文并建立 `init_corpus`
- I6：用户填写固定项与问题答案
- I7：用户通过按钮或聊天触发大纲生成

## 5.3 I1 创建项目

### 目标

建立项目主记录和初始上下文。

### 输入

- `request_text`

### 处理

- 创建项目记录
- 保存原始需求
- 写入第一条用户消息

### 输出

- `project_request`
- `project_id`

### 允许行为

- 自动进入 I2

### 禁止行为

- 此时不能生成问题
- 此时不能生成大纲

## 5.4 I2 生成初始化搜索词

### 目标

把原始需求翻译成第一轮可搜索的项目级查询集合。

### 输入

- `request_text`

### 处理

- 调用项目级 `research.query_rewrite`
- 生成 3 到 6 条初始化查询

### 输出

- `init_search_queries`

### 允许行为

- 每条 query 允许附带一个“查询目的”

### 禁止行为

- 不能在这里生成智能问题
- 不能在这里做向量召回

## 5.5 I3 Bocha 搜索

### 目标

拿到可供快速问题生成的首轮搜索结果。

### 输入

- `init_search_queries`

### 处理

- 调用 Bocha
- 去重 URL
- 保存每条结果的基础元信息

### 输出

- `init_search_results`

每条搜索结果至少包含：

- `query_text`
- `search_rank`
- `title`
- `url`
- `bocha_summary`

### 允许行为

- 先只拿摘要，不等全文

### 禁止行为

- 不能在这里做页面级操作

## 5.6 I4 基于 Bocha 摘要快速生成首轮问题

### 目标

快速给用户第一版可选项，不要求等全文向量化完成。

### 输入

- `request_text`
- `init_search_results[].bocha_summary`

### 处理

- 基于 Bocha 摘要快速生成：
  - 页数推荐
  - 智能问题

### 输出

- `page_count_options`
- `ai_questions`

### 行为限定

- 这一步只允许使用 Bocha 摘要
- 不要求正文全文
- 不要求向量召回

### 禁止行为

- 不能把这一步写成“基于全文证据推导问题”
- 不能冒充已经做了 `init_corpus` 召回

## 5.7 I5 抓正文并建立 `init_corpus`

### 目标

把初始化搜索结果转成后续可检索的项目级正文资料池。

### 输入

- `init_search_results`

### 处理

- 获取正文
- 正文清洗
- chunk 切分
- embedding
- 写入 `init_corpus`

### 输出

- `init_corpus`
- `init_corpus_digest`

### 行为限定

- `init_corpus` 只服务：
  - 初始化问题修正
  - 大纲生成

### 禁止行为

- 不能把 `init_corpus` 直接给页面级 summary 用
- 不能把 `init_corpus` 混进 `page_corpus`

## 5.8 I6 用户填写固定项与问题答案

### 目标

收集进入大纲生成前必须明确的结构化数据。

### 输入

- `page_count_options`
- `ai_questions`

### 处理

- 用户选择 `page_count_target`
- 用户选择 `style_preset`
- 用户可选上传 `background_asset`
- 用户回答智能问题

### 输出

- `fixed_fields`
- `answers`

### 行为限定

- `style_preset` 必填
- `background_asset` 可空

### 禁止行为

- 不能因为没有背景图阻塞流程

## 5.9 I7 初始化阶段聊天动作

初始化阶段聊天允许 4 类动作。

### A. 重新做项目级搜索

适用场景：

- 用户新增重要约束
- 用户觉得首轮资料跑偏

执行：

- 重生 `init_search_queries`
- 重跑 Bocha 搜索
- 可选重建 `init_corpus`

禁止行为：

- 不允许直接跳过搜索、只改结果展示

### B. 新增或修改智能问题

这是强约束动作。

执行前必须：

- 先从 `init_corpus` 做向量召回

然后才能：

- 新增问题
- 修改问题
- 生成新的候选项

### 为什么必须先检索 `init_corpus`

因为首轮问题生成可以快，但聊天中新增/修改问题如果不看正文证据，就没有实际意义，只是在空想。

### C. 删除智能问题

执行：

- 从问题集合删除目标问题
- 若有对应答案，一并解绑

### D. 修改答案

执行：

- 更新 `answers`

行为限定：

- 修改答案不强制自动重搜
- router 只负责给建议，不负责偷偷帮用户重跑

## 5.10 初始化阶段完成条件

满足以下条件，才允许进入大纲生成：

- `page_count_target` 已确定
- `style_preset` 已确定
- 当前保留的问题都已有答案
- `init_corpus` 已建立

### 明确删除的旧流程

这里明确删除：

- `init.requirement_summary`
- `outline_context_md`
- 任何“再写一层需求确认摘要才让大纲吃”的流程

大纲生成直接使用：

- 原始需求
- 固定项
- 问题答案
- `init_corpus` 召回结果

---

## 6. 大纲生成阶段详细规范

## 6.1 阶段定位

大纲阶段不是工作台，是锁死的生成态。

### 强约束

- 没有聊天框
- 没有页面级编辑
- 没有章节级编辑
- 没有“先看大纲再点下一步”的单独中间页

系统行为只有一件事：

- 后台生成总体大纲

生成完成后：

- 前端直接进入搜索页
- 搜索页默认不自动搜索

## 6.2 大纲生成步骤总览

- O1：聚合大纲输入
- O2：基于 `init_corpus` 做大纲召回
- O3：生成大纲
- O4：落库章节、页面标题、页面要点
- O5：切换到搜索页

## 6.3 O1 聚合大纲输入

### 输入

- `request_text`
- `page_count_target`
- `style_preset`
- `background_asset`
- `answers`

### 处理

- 形成大纲生成输入对象

### 输出

- `outline_generation_input`

### 禁止行为

- 不能在这里做页面级资料召回

## 6.4 O2 基于 `init_corpus` 做大纲召回

### 输入

- `outline_generation_input`
- `init_corpus`

### 处理

- 用项目级 query rewrite 生成大纲用搜索词
- 只在 `init_corpus` 内做向量召回

### 输出

- `outline_selected_citations`
- `outline_research_evidence`

### 强约束

- 只允许查 `init_corpus`
- 不允许查任何 `page_corpus`

## 6.5 O3 生成大纲

### 输入

- `outline_generation_input`
- `outline_research_evidence`

### 处理

- 调用 `outline.generate`

### 输出

- 章节
- 页面标题
- 页面要点

## 6.6 O4 大纲落库

### 处理

- 创建或刷新页面实体
- 建立 `outline_state`
- 为每个页面建立初始 outline 版本

### 输出

- `outline_state`
- `page_outline_versions`

## 6.7 O5 进入搜索页

### 行为

- 项目主阶段切到 `search`
- 前端自动跳转到搜索页

### 强约束

- 不自动触发页面搜索
- 不自动触发 summary
- 不自动触发 draft

---

## 7. 搜索阶段详细规范

## 7.1 阶段目标

搜索阶段负责 4 件事：

1. 承接大纲生成后的第一个可交互工作台
2. 允许用户先修改当前页面标题和要点
3. 建立每个页面独立的 `page_corpus`
4. 基于当前页 `page_corpus` 生成当前页详实 `summary`

## 7.2 搜索阶段的默认打开行为

用户刚进入搜索页时：

- 系统展示当前页面标题、要点和当前状态
- 系统展示页面级聊天框
- 系统展示批量按钮

### 强约束

- 默认不自动搜索
- 默认不自动生成 summary
- 用户可以先改标题和要点

## 7.3 搜索阶段页面结构修正动作

这些动作都发生在搜索页，不发生在独立大纲页。

允许动作：

- 改当前页标题
- 改当前页要点
- 增加要点
- 删除要点
- 删除当前页
- 新增页面
- 调整页面所属章节
- 调整页面顺序

### 输入

- 当前页信息
- 全量大纲快照
- 用户消息

### 处理

- 提取结构化 patch
- 做重复要点检测
- 更新 `outline_state`

### 输出

- 新的页面结构

### 强约束

- 只要涉及标题和要点修改，就必须带全量大纲快照
- 不允许只用当前页信息做修改

### 禁止行为

- 不允许在同一个动作里顺手联网搜索

## 7.4 搜索前语料扩展定义

这里必须写清楚，避免以后又出现“检索计划”这种空词。

搜索前语料扩展的本质是：

- 把当前页结构化需求翻译成 3 到 6 条可直接提交给 Bocha 的搜索词集合

它不是：

- 独立 planner 系统
- 独立资料池
- 联网搜索本身

### 输入

- 当前页标题
- 当前页要点
- 当前页所在章节
- 全量大纲快照
- 用户新增限制

### 处理目标

生成 `page_search_queries`。

每条 query 都必须回答一件事：

- 这条 query 想补哪类信息

常见信息类型：

- 定义类
- 数据类
- 时间趋势类
- 对比类
- 案例类
- 证据类

### 输出

- `page_search_queries`

每条 query 至少包含：

- `query_text`
- `query_purpose`

### 允许行为

- 用户可以只让系统先生成搜索词，不立刻联网

### 禁止行为

- 不能把“搜索词集合”写成含糊的“检索计划”

## 7.5 单页正式搜索

### 目标

为当前页建立独立资料池。

### 输入

- `page_search_queries`

### 处理

1. 调用 Bocha
2. 去重 URL
3. 抓正文
4. 清洗正文
5. chunk + embedding
6. 写入当前页 `page_corpus`

### 输出

- `page_search_results`
- `page_corpus`
- `page_corpus_digest`

### 强约束

- 当前页搜索结果只写入当前页 `page_corpus`
- 不写入项目共享向量池
- 不写入其他页面资料池

### 禁止行为

- 不允许把页面 A 的搜索结果写给页面 B

## 7.6 单页 summary 生成

### 目标

从当前页资料池生成当前页详实摘要。

### 输入

- 当前页 `page_corpus`
- 当前页标题
- 当前页要点

### 处理

1. 只在当前页 `page_corpus` 内做向量召回
2. 生成当前页 `summary`

### 输出

- `page_selected_citations`
- `page_summary`

### 强约束

- `summary` 只能来自当前页资料池
- 不允许混用其他页资料池
- 不允许混用 `init_corpus`

## 7.7 搜索阶段聊天动作明确定义

### 动作 A：重新生成当前页搜索词集合

执行内容：

- 只重算 `page_search_queries`

不执行：

- 不联网
- 不抓正文
- 不生成 summary

### 动作 B：重跑当前页搜索

执行内容：

- 使用当前最新 `page_search_queries` 重新联网搜索
- 更新当前页 `page_corpus`

不执行：

- 不自动生成 draft
- 不自动生成 design

### 动作 C：覆盖当前页旧资料

执行内容：

- 清空当前页旧 `page_corpus`
- 再重新执行单页正式搜索

### 动作 D：只重生成 summary

执行内容：

- 不联网
- 不重抓正文
- 只基于当前页 `page_corpus` 重新生成 summary

### 动作 E：修改标题和要点后是否自动搜索

默认规则：

- 不自动搜索
- 只更新结构化页面数据
- 把当前页 `summary`、`draft`、`design` 标为 `stale`

是否立即重搜，由：

- 用户点击
- 或 router 明确返回 `should_execute=true`

## 7.8 搜索阶段批量执行

搜索阶段允许批量按钮，但语义必须固定。

### 批量搜索按钮

执行内容：

- 对每个页面独立执行：
  - 若该页 `page_corpus` 为空，先生成搜索词，再搜索
  - 若该页结构已变且资料过期，重跑搜索
  - 若该页资料已可用且未过期，跳过

### 批量 summary 按钮

执行内容：

- 对每个页面独立执行：
  - 若该页已有有效资料池，则生成或重生 summary
  - 若该页资料池为空，则跳过

### 强约束

- 批量执行允许并发
- 但每个页面上下文必须独立

---

## 8. 初稿阶段详细规范

## 8.1 阶段目标

初稿阶段负责：

1. 基于当前页 `summary` 生成当前页 draft
2. 允许用户在不强制回滚流程的前提下修改当前页内容

## 8.2 单页 draft 生成

### 输入

- 当前页标题
- 当前页要点
- 当前页 summary
- 当前页 selected citations

### 处理

- 调用 `draft.page_generate`

### 输出

- `draft_svg`

### 强约束

- 当前页 draft 只能使用当前页 `summary`
- 不允许从别的页面借 summary

## 8.3 初稿阶段聊天动作

允许：

- 修改标题
- 修改要点
- 编辑 summary
- 重跑当前页搜索
- 只重生成 summary
- 直接重生成 draft

### 行为限定

- 修改标题和要点后，不自动重搜
- 编辑 summary 后，不自动重生 draft
- 只把 draft / design 标为 `stale`

## 8.4 初稿阶段批量执行

允许“批量生成 draft”按钮。

### 执行规则

- 只处理 `summary_status` 为 `ready` / `confirmed` / `stale` 的页面
- 如果 summary 为空，跳过
- 允许并发

---

## 9. 设计稿阶段详细规范

## 9.1 阶段目标

设计稿阶段负责：

1. 基于当前页 draft 生成设计稿
2. 保持风格统一
3. 允许用户做局部修正，但不强制回滚

## 9.2 单页 design 生成

### 输入

- 当前页 draft SVG
- `style_preset`
- 可选 `background_asset`

### 处理

- 调用 `design.svg_generate`

### 输出

- `design_svg`

### 强约束

- 没有 `style_preset` 不能生成 design
- 没有背景图也可以生成 design

## 9.3 设计稿阶段聊天动作

允许：

- 直接重生成设计稿
- 修改标题
- 修改要点
- 修改 summary
- 重跑当前页搜索
- 重生成 draft

### 行为限定

- 上游内容变了，只标记 `stale`
- 不自动回滚项目主阶段

## 9.4 设计稿阶段批量执行

允许“批量生成 design”按钮。

### 执行规则

- 只处理 `draft_status` 为 `ready` / `confirmed` / `stale` 的页面
- 允许并发

---

## 10. 前端行为规范

## 10.1 总体要求

前端不能只靠轮询和静态消息列表，必须具备 agent 过程可视化。

必须实现：

- SSE 或等价流式事件机制
- router 决策展示
- 执行步骤展示
- 阶段状态展示
- 下一步推荐展示

## 10.2 初始化页

必须展示：

- Bocha 搜索结果摘要
- 页数推荐
- 智能问题列表
- 风格选择
- 背景图上传入口，可选
- 项目级聊天框
- 推荐动作

## 10.3 大纲生成态

这是锁死加载态，只需要展示：

- 当前正在生成大纲
- 当前步骤进度
- 完成后自动跳转到搜索页

### 强约束

- 没有聊天框
- 没有编辑按钮

## 10.4 搜索页

搜索页必须展示：

- 当前页标题
- 当前页要点
- 当前页结构状态
- 当前页搜索词集合
- 当前页资料状态
- 当前页 summary 状态
- 页面级聊天框
- 搜索按钮
- summary 按钮
- 批量按钮

## 10.5 初稿页

初稿页必须展示：

- 当前页 draft 预览
- 当前页标题/要点/summary 摘要
- 页面级聊天框
- 单页生成按钮
- 批量生成按钮

## 10.6 设计页

设计页必须展示：

- 当前页 design 预览
- 风格信息
- 页面级聊天框
- 单页生成按钮
- 批量生成按钮

---

## 11. 老代码改造清单

这一节直接对应工程改造。

## 11.1 数据模型改造

重点文件：

- `backend/app/models/entities.py`
- `backend/app/core/db.py`

### 必改 A：拆分资料池

当前问题：

- 资料池是全项目共享的

目标改造：

- `SourceCollection` 必须支持：
  - `init_knowledge`
  - `page_knowledge`
- `page_knowledge` 必须带 `page_id`

### 必改 B：细化页面状态

当前问题：

- 状态太少，不能表示 `stale`

目标改造：

- 增加：
  - `outline_status`
  - `search_status`
  - `summary_status`
- 所有状态支持 `stale`

### 必改 C：移除 `init.requirement_summary`

当前问题：

- 初始化流程还依赖二次总结

目标改造：

- 删除相关 prompt
- 删除相关字段依赖
- 初始化阶段直接保留结构化数据和 `init_corpus` 召回结果

### 必改 D：页面结构必须有版本化实体

当前问题：

- 标题和要点可能只通过 prompt 临时覆盖

目标改造：

- 页面标题和要点必须版本化落库

## 11.2 Prompt 改造

重点文件：

- `backend/app/services/prompt_contracts.py`
- `backend/app/services/generation.py`

### 必改 A：把“初始化快速问题生成”和“问题修正”拆开

新增：

- `init.fast_question_generate`
  - 只吃 Bocha 摘要
- `init.question_refine_with_retrieval`
  - 必须吃 `init_corpus` 召回结果

### 必改 B：删除 `init.requirement_summary`

这是硬删除，不是弱化。

### 必改 C：页面搜索词生成要单独定义

新增：

- `page.search_query_expand`

它的输出必须是：

- 3 到 6 条可直接提交给 Bocha 的搜索词
- 每条 query 的用途说明

不能继续用“检索计划”这种含糊词。

### 必改 D：页面结构修正 prompt 必须带全局大纲

不带全局大纲，就不允许执行标题/要点修正。

## 11.3 ResearchService 改造

重点文件：

- `backend/app/services/research.py`

### 必改 A：初始化问题生成分两段

第一段：

- 基于 Bocha 摘要快速生成问题

第二段：

- 聊天增改问题时，先检索 `init_corpus`

### 必改 B：页面级搜索池隔离

目标：

- 每页建立独立 `page_corpus`
- 每页召回只查自己

### 必改 C：搜索和 summary 拆成两个独立动作

当前问题：

- 搜索和 summary 耦合太死

目标：

- 支持只搜资料
- 支持只重生 summary

## 11.4 Orchestrator 改造

重点文件：

- `backend/app/services/orchestrator.py`

### 必改 A：移除自动串行推进

删除当前行为：

- 大纲完成后自动搜索
- research 全确认后自动 draft
- draft 全确认后自动 design

目标行为：

- 大纲完成后直接进入搜索页，但不自动搜索
- 其他阶段只在用户动作或 router 明确决策下执行

### 必改 B：message job 改成动作执行器

当前问题：

- 大多数消息只是写一条回复

目标改造：

- `run_message_job()` 直接消费 router 的 `action_type` 和 `execution_plan`
- 真正更新结构化数据或触发任务

### 必改 C：上游变化只标 `stale`

目标：

- 统一依赖分析
- 标记受影响下游产物为 `stale`
- 不强制回滚主阶段

## 11.5 API 改造

重点文件：

- `backend/app/api/routes/projects.py`
- `backend/app/api/routes/requirements.py`
- `backend/app/api/routes/outline.py`
- `backend/app/api/routes/pages.py`

### 必改 A：补齐流式事件接口

前端必须能接收：

- router 决策
- 执行步骤
- 状态变化
- 最终结果

### 必改 B：补齐结构化 patch 接口

建议至少增加：

- 初始化问题增删改接口
- 初始化答案更新接口
- 页面结构 patch 接口
- 页面搜索词生成接口
- 页面 summary patch 接口

## 11.6 前端改造

重点文件：

- `src/lib/ppt-api.ts`
- `src/components/ProjectStart.tsx`
- `src/components/Editor.tsx`
- `src/App.tsx`

### 必改 A：接入 SSE

不能再只靠 3 秒轮询。

### 必改 B：搜索页必须展示搜索词集合

这点必须加，不然用户不知道系统到底搜了什么。

### 必改 C：outline 只保留加载态

删除“单独大纲工作页”概念。

### 必改 D：页面级聊天必须带足上下文

至少带：

- 当前页 ID
- 当前页标题
- 当前页要点
- 当前页阶段
- 当前页状态摘要
- 全量大纲快照

---

## 12. 推荐实施顺序

### Phase 1：先改数据结构

- 拆资料池
- 引入 `stale`
- 页面结构版本化
- 删掉 `init.requirement_summary`

### Phase 2：重写 router 契约

- 把“分类器”改成“动作决策器”

### Phase 3：重做初始化问题链路

- Bocha 摘要快速出题
- `init_corpus` 检索驱动问题修正

### Phase 4：重做大纲和搜索边界

- `outline` 改成锁死生成态
- 大纲完成后直接进搜索页
- 搜索页不自动搜索
- 页面结构修正全部放到搜索页

### Phase 5：重做页面搜索链路

- 页面搜索词生成
- 页面独立资料池
- 搜索和 summary 拆开

### Phase 6：重做 draft / design 状态机

- 只标 `stale`
- 不强制回滚

### Phase 7：前端接事件流并展示动作过程

- 把 agent 过程可视化

---

## 13. 最终验收标准

只有同时满足下面这些条件，才算实现到位。

### 初始化阶段验收

- 首轮问题基于 Bocha 摘要快速生成
- 聊天增改问题前会先检索 `init_corpus`
- 风格必填，背景可空
- `init.requirement_summary` 不再存在

### 大纲阶段验收

- `outline` 是锁死生成态
- 没有聊天框
- 大纲完成后直接进入搜索页

### 搜索阶段验收

- 搜索页默认不自动搜索
- 用户能先改标题和要点
- 页面搜索词集合可见
- 每页资料池独立
- 每页召回只查自己
- 搜索和 summary 可以分开执行

### Draft / Design 阶段验收

- 支持单页和批量执行
- 上游变化只标 `stale`
- 不强制回滚项目主阶段

### Agent 验收

- 聊天输入会触发明确动作或明确拒绝
- 前端能看到 router 决策
- 前端能看到执行步骤
- 前端能看到下一步推荐

如果任何一条不满足，就说明系统还不是我们要的 agent 工作区。
