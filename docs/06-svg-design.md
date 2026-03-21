# SVG 设计稿设计

## 1. 业务范围

本文件定义 SVG 设计阶段，只负责下面这些事情：

1. 风格预设包
2. 背景资源
3. 基于原始 SVG 和风格包的页面设计稿生成
4. 基于原始 SVG 和风格包的页面设计稿编辑
5. 最终导出

本文件不负责需求补全、大纲、页级研究和页面初稿结构。

依赖文档：

- `01-project-workspace.md`
- `05-page-draft.md`
- `03-knowledge-research.md`

---

## 2. 渲染边界

### 2.1 固定画布

SVG 设计稿统一使用：

```text
width = 1280
height = 720
viewBox = 0 0 1280 720
```

### 2.2 安全区

建议安全区：

```text
left = 48
right = 48
top = 40
bottom = 40
usable_area = 1184 x 640
```

### 2.3 设计阶段能改什么

设计阶段的直接输入固定为 `draft_svg_markup + style_pack + background_asset`。

其中 `draft_svg_markup` 来自上游已确认的页面初稿，它已经固化了内容、布局和基础排版。设计阶段做的是风格注入，不是重新出稿。

设计阶段只允许影响：

1. 配色
2. 背景处理
3. 装饰元素
4. 卡片表面细节
5. 图表着色
6. 视觉强调方式

设计阶段不允许改：

1. 原始 SVG 的文本内容
2. 卡片数量
3. 卡片顺序
4. 卡片外部占位框的位置与尺寸
5. 字体家族和字号层级
6. 页面主布局关系

这些内容已经在页面初稿阶段锁定。设计模型只能在既有 SVG 骨架上完成样式注入，不能把设计阶段重新做成一次页面策划。

---

## 3. 风格预设包

### 3.1 `style_pack` 结构

```json
{
  "style_pack": {
    "style_id": "minimalism",
    "style_name": "极简主义",
    "design_philosophy": "少即是多，内容为王",
    "mood_keywords": ["克制", "精致", "专注", "高级"],
    "palette": {
      "background": "#FFFFFF",
      "surface": "#F5F5F5",
      "text_primary": "#333333",
      "text_secondary": "#666666",
      "accent_primary": "#002FA7",
      "accent_secondary": null
    },
    "chart_palette": ["#002FA7", "#666666", "#F5F5F5"],
    "background_treatment": [
      "纯色背景优先",
      "避免纹理和渐变"
    ],
    "decoration_language": [
      "细线",
      "小色块",
      "线性图形"
    ],
    "color_usage_rules": [
      "强调色面积不超过 10%"
    ],
    "do_rules": [
      "保持明显留白"
    ],
    "dont_rules": [
      "不要阴影",
      "不要复杂特效"
    ]
  }
}
```

### 3.2 预设风格

#### `minimalism`

```text
设计哲学：少即是多，内容为王。
情绪：克制、精致、专注、高级。
配色：白底、炭黑正文、中灰辅助说明、克莱因蓝作为极少量强调。
背景：纯色白底优先，允许浅灰弱分区。
装饰：只允许细线、小色块、轻量线性图形。
图表：优先低彩度图表，只保留必要重点色。
禁忌：不要渐变、不要阴影、不要纹理、不要高噪声装饰。
```

#### `consulting`

```text
设计哲学：专业可信、结论先行、证据支撑。
情绪：专业、权威、严谨、可信赖。
配色：海军蓝为主，浅蓝灰为卡片底，浅蓝为辅助图形色，橙色只用于关键数据。
背景：白底优先，局部允许浅蓝灰分区。
装饰：可用短色条、边框、分隔线和标题前色块，但必须克制。
图表：按 #003366、#005A9E、#ADD8E6、#FF8C00、#95A5A6 顺序着色。
禁忌：不要娱乐化配色，不要滥用橙色，不要炫技特效。
```

#### `tech-dark`

```text
设计哲学：技术未来感，但表达清晰高于炫技。
情绪：科技、前卫、未来感、冷静。
配色：深黑和暗灰为背景，白和浅灰为正文，荧光青为主强调，科技紫为次强调，霓虹粉只能极少量点缀。
背景：深色纯底或轻微暗色渐变优先。
装饰：允许轻量发光、霓虹线条、渐变边框和未来感几何图形。
图表：高对比配色，但荧光色总面积控制在 20% 以内。
禁忌：不要多色霓虹混战，不要过度发光，不要让装饰压过内容。
```

#### `swiss-style`

```text
设计哲学：功能主义、平面冲击、几何秩序。
情绪：大胆、现代、有力、艺术化。
配色：黑、白、信号红形成主张力，黄和蓝只能偶发点缀。
背景：允许大面积纯色块、黑白反转和硬边切分。
装饰：几何图形、大色块、粗线条、强对比留白。
图表：优先单色系或双色系，不允许花色混杂。
禁忌：不要渐变、不要阴影、不要柔和拟态、不要多圆角处理。
```

#### `brand-blue`

```text
设计哲学：品牌一致性、现代专业、稳定输出。
情绪：专业、可信、现代、统一。
配色：品牌蓝为主，紫蓝为次，青蓝为小面积点缀，背景以浅灰或纯白为主。
背景：白底或浅灰底优先，重要区域允许品牌蓝到紫蓝的轻量渐变。
装饰：品牌色条、轻量渐变、线性图形、小面积几何点缀。
图表：按 #016BFF、#565BFF、#2ECCF7、#A5D8FF、#C4B5FD 顺序着色，基准色为 #E5E5E5。
禁忌：不要引入额外颜色，不要让渐变覆盖整页，不要做花哨动效。
```

---

## 4. 背景资源

### 4.1 使用原则

背景资源只作为底层氛围，不得破坏正文可读性。

### 4.2 作用范围

背景资源支持：

```text
global
cover_only
section_only
page_only
```

### 4.3 应用规则

1. 正文页优先降低背景存在感
2. 封面和章节过渡页允许更强背景存在感
3. 背景透明度和蒙层由设计模型决定，但正文对比度必须达标

---

## 5. 阶段流程

### 5.1 生成流程

1. 读取目标页最新已确认的初稿版本
2. 读取其中的 `draft_svg_markup`
3. 读取项目已选 `style_pack`
4. 读取可用背景资源
5. 组装 `draft_svg_markup + style_pack + background_asset`
6. 调用 SVG 设计提示词
7. 写入设计版本
8. 打开 `design_confirm`

### 5.2 编辑流程

用户要求改视觉时：

1. 读取目标页最新设计版本
2. 读取对应初稿版本中的 `draft_svg_markup`
3. 读取风格包和背景资源
4. 调用 SVG 编辑提示词
5. 生成新的 design 版本
6. 前一版本标记为 `superseded`

---

## 6. Prompt 契约

### 6.1 `design.svg_generate.system`

```text
你是 AI PPT 的 SVG 风格增强模型。输入会提供一份已经完成内容和布局的原始 SVG，以及项目选定的风格包和背景资源。你的任务是在不改动原始 SVG 的内容、布局、层级和阅读顺序的前提下，只通过视觉语言进行二次设计，把它丰富为最终设计稿。

规则：
1. 只输出单个完整的 <svg>...</svg> 文档。
2. 画布必须严格保持 `1280x720` 和原始 `viewBox`。
3. 不允许修改任何标题、正文、数字、标签和引用文案。
4. 不允许改变任何卡片容器、图表主体、正文块和主信息元素的位置、尺寸、顺序与主次关系。
5. 不允许删除原始 SVG 中承载信息的元素，也不允许新增会改变信息含义的新内容。
6. 不允许改变字体家族、字号层级和文本框布局。
7. 允许基于 `style_pack` 丰富背景、颜色、描边、填充、图表配色、分隔、局部装饰和细节层次。
8. 背景资源只能做底层氛围处理，不能压住正文。
9. 如果风格表达与内容可读性冲突，优先保留内容可读性和原始布局。
10. 不要输出 Markdown、代码围栏和解释文字。
```

### 6.2 `design.svg_generate.user`

```text
任务：生成目标页最终 SVG 设计稿。

输入数据(JSON)：
{
  "draft_svg": "{{draft_svg_markup}}",
  "canvas_constraints": {
    "width": 1280,
    "height": 720,
    "view_box": "0 0 1280 720"
  },
  "style_pack": {{style_pack_json}},
  "background_asset": {{background_asset_json}},
  "preserve_rules": {
    "keep_content": true,
    "keep_layout": true,
    "keep_typography_hierarchy": true
  }
}
```

### 6.3 `design.svg_edit.system`

```text
你是 AI PPT 的 SVG 设计稿编辑模型。输入会提供当前设计稿 SVG、对应的原始 SVG、风格包、背景资源和用户修改要求。你的任务是在不改动原始 SVG 的内容与布局的前提下，对当前设计稿做局部视觉迭代。

规则：
1. 只输出单个完整的 <svg>...</svg> 文档。
2. 必须保留 `1280x720` 画布和原始 `viewBox`。
3. 未被要求修改的部分尽量不动。
4. 不允许修改原始 SVG 的文本内容、卡片数量、卡片顺序、卡片位置与尺寸。
5. 不允许改变字体家族、字号层级和整体布局关系。
6. 修改后的视觉语言必须继续服从风格包。
7. 背景和装饰不得压住正文，不得降低图表和文字可读性。
8. 不要输出解释文字。
```

### 6.4 `design.svg_edit.user`

```text
任务：根据用户修改要求编辑目标页 SVG。

输入数据(JSON)：
{
  "draft_svg": "{{draft_svg_markup}}",
  "current_svg": "{{current_svg}}",
  "style_pack": {{style_pack_json}},
  "background_asset": {{background_asset_json}},
  "edit_instruction": "{{edit_instruction}}"
}
```

---

## 7. 表结构设计

### 7.1 `style_presets`

作用：保存风格预设包。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | uuid | 主键 |
| `style_id` | varchar | 预设编码 |
| `style_name` | varchar | 风格名 |
| `design_philosophy` | text | 设计哲学 |
| `mood_keywords_json` | jsonb | 情绪关键词 |
| `palette_json` | jsonb | 配色 |
| `chart_palette_json` | jsonb | 图表配色 |
| `background_treatment_json` | jsonb | 背景处理规则 |
| `decoration_language_json` | jsonb | 装饰语言 |
| `color_usage_rules_json` | jsonb | 颜色使用规则 |
| `do_rules_json` | jsonb | 推荐做法 |
| `dont_rules_json` | jsonb | 禁止做法 |
| `is_active` | boolean | 是否启用 |

### 7.2 `project_background_assets`

作用：保存项目背景资源。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | uuid | 主键 |
| `project_id` | uuid | 所属项目 |
| `file_name` | varchar | 文件名 |
| `storage_path` | varchar | 存储路径 |
| `mime_type` | varchar | MIME 类型 |
| `width` | integer | 资源宽度 |
| `height` | integer | 资源高度 |
| `usage_scope` | varchar | `global / cover_only / section_only / page_only` |
| `meta_json` | jsonb | 附加信息 |
| `created_at` | timestamptz | 创建时间 |

### 7.3 `project_page_design_versions`

作用：保存页级设计稿版本。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | uuid | 主键 |
| `project_id` | uuid | 所属项目 |
| `page_id` | uuid | 所属页面 |
| `draft_version_id` | uuid | 来源初稿版本 |
| `style_preset_id` | uuid | 使用风格 |
| `background_asset_id` | uuid | 使用背景 |
| `version_no` | integer | 版本号 |
| `status` | varchar | `draft / pending_confirmation / confirmed / superseded / exported` |
| `svg_markup` | text | SVG 原文 |
| `preview_path` | varchar | 预览路径 |
| `created_by_agent_run_id` | uuid | 创建运行 |
| `created_at` | timestamptz | 创建时间 |
| `updated_at` | timestamptz | 更新时间 |

### 7.4 `project_design_edits`

作用：保存设计编辑记录。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | uuid | 主键 |
| `project_id` | uuid | 所属项目 |
| `page_id` | uuid | 所属页面 |
| `from_design_version_id` | uuid | 编辑前版本 |
| `to_design_version_id` | uuid | 编辑后版本 |
| `instruction_md` | text | 编辑指令 |
| `created_by_message_id` | uuid | 来源消息 |
| `created_at` | timestamptz | 创建时间 |

### 7.5 `project_exports`

作用：保存最终导出记录。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | uuid | 主键 |
| `project_id` | uuid | 所属项目 |
| `export_type` | varchar | `svg_zip / pptx / html_preview / pdf` |
| `storage_path` | varchar | 导出路径 |
| `status` | varchar | `queued / completed / failed` |
| `created_by_agent_run_id` | uuid | 导出运行 |
| `created_at` | timestamptz | 创建时间 |

---

## 8. 完成判定

设计阶段完成的条件：

1. 所有活动页都有已确认的 `project_page_design_versions`
2. 项目工作区中的 `design_confirm = confirmed`
3. 至少生成一种导出产物

满足后，项目进入 `done`。
