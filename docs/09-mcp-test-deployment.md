# MCP 测试环境部署

## 1. 文档范围

本文件只定义测试环境中的 MCP 启动、持久化和故障切换策略：

1. 哪些 MCP 必须启动
2. 哪些 MCP 是可选冗余
3. 如何在测试环境长期运行
4. 后端如何配置和回退

本文件不重复定义业务检索策略和文档入库逻辑。这些内容归属：

1. `03-knowledge-research.md`
2. `08-backend-technical-roadmap.md`

---

## 2. 核心判断

直接说结论：

1. `bocha` 是项目级互联网搜索入口，建议单独配置。
2. 网页正文读取 MCP 不需要三套全开才能工作。
3. 只要有一套正文读取 MCP 可用，系统就能工作。
4. 多开 `jina / firecrawl / fetch` 的意义，不是功能叠加，而是容灾和质量兜底。

最小可用集：

1. `bocha`
2. `jina` 或 `firecrawl` 或 `fetch` 任意一种正文读取 MCP

推荐测试环境集：

1. `bocha`
2. `jina` 作为默认正文读取
3. `firecrawl` 作为复杂页面兜底
4. `fetch` 作为本地轻量兜底

一句话总结：

不是都要启动；但如果你想让系统在一个 MCP 失败时自动切到另一个，那至少要配置两套正文读取器。

---

## 3. MCP 分工

### 3.1 必选 MCP

#### `bocha`

用途：

1. 互联网搜索
2. 候选结果召回
3. 初始研究和页级研究的外部入口

没有它，搜索链路不成立。

### 3.2 正文读取 MCP

正文读取三选一即可工作：

#### `jina`

特点：

1. 远程可直接接入
2. Markdown 正文质量高
3. 启动成本最低

适合：

1. 先跑起来
2. 做默认主读取器

#### `firecrawl`

特点：

1. 支持复杂页面
2. 支持更强抓取能力
3. 支持本地持久化运行

适合：

1. 作为本地主读取器
2. 作为 `jina` 失败时的回退

#### `fetch`

特点：

1. 轻量
2. 本地可跑
3. 适合兜底

缺点：

1. 更偏 stdio
2. 不如前两者省心

适合：

1. 当第三路兜底
2. 或者在没有 `firecrawl` 时，作为本地备用读取器

### 3.3 可选 MCP

#### `markitdown`

用途：

1. PDF 转 Markdown
2. Office 附件转 Markdown
3. 上传文件入库

如果测试环境暂时不做文件上传，可以先不启动。

---

## 4. 推荐启用方案

### 4.1 最小可用

适合先联通系统：

1. `MCP_BOCHA_URL + MCP_BOCHA_AUTH_HEADER`
2. `MCP_JINA_URL=https://mcp.jina.ai/v1`

优点：

1. 不需要本地启动正文读取服务
2. 接入最快

缺点：

1. 没有本地兜底
2. 依赖远程服务可用性

### 4.2 推荐测试环境

适合稳定联调：

1. `bocha`
2. `jina`
3. `firecrawl`

回退顺序建议：

1. `jina`
2. `firecrawl`
3. `fetch`

说明：

1. `jina` 默认质量最好，且不需要本地部署
2. `firecrawl` 本地可控，适合复杂页面兜底
3. `fetch` 只有在你愿意再维护一个本地 bridge 时才建议加

### 4.3 全量冗余

适合要验证容灾策略：

1. `bocha`
2. `jina`
3. `firecrawl`
4. `fetch`
5. `markitdown`

这不是最小集，但最接近生产链路。

---

## 5. 当前测试环境配置

当前局域网测试环境可直接使用：

```dotenv
DATABASE_URL=
REDIS_URL=
```

当前建议的 MCP 配置是：

```dotenv
MCP_BOCHA_URL=https://mcp.bochaai.com/sse
MCP_BOCHA_AUTH_HEADER=Bearer sk-xxxx
MCP_JINA_URL=https://mcp.jina.ai/v1
MCP_JINA_AUTH_HEADER=Bearer jina_xxx
MCP_FIRECRAWL_URL=http://127.0.0.1:3000/mcp
MCP_FETCH_URL=http://127.0.0.1:3101/sse
MCP_MARKITDOWN_URL=
```

说明：

1. `MCP_BOCHA_URL` 直接指向远程 SSE 端点；如果你已经有这个端点，从后端接入角度不需要本地拉代码。
2. `MCP_BOCHA_AUTH_HEADER` 按 Bocha 提供的格式填写：`Bearer sk-xxxx`
3. `MCP_JINA_URL` 可以直接使用，不需要本地启动
4. `MCP_JINA_AUTH_HEADER` 建议配置；Jina 的远程 MCP 配置支持通过 `Authorization` 头注入 key
5. `MCP_FIRECRAWL_URL` 只有你本地起了服务才填写
6. `MCP_FETCH_URL` 只有你本地起了 bridge 才填写

### 5.1 MCP 环境变量约定

当前项目建议的 MCP 配置方式只有两层：

1. `MCP_*_URL`
   表示 MCP 服务地址
2. `MCP_*_AUTH_HEADER`
   表示 `Authorization` 头的完整值

这样后端网关最简单：

```python
headers = {}
if settings.MCP_BOCHA_AUTH_HEADER:
    headers["Authorization"] = settings.MCP_BOCHA_AUTH_HEADER
```

不要把 `Bearer ` 前缀拆进代码里。环境变量里直接放完整值：

```dotenv
MCP_BOCHA_AUTH_HEADER=Bearer sk-xxxx
MCP_JINA_AUTH_HEADER=Bearer jina_xxx
```

---

## 6. 启动方式

### 6.1 `jina`

最简单，不本地启动，直接配置：

```dotenv
MCP_JINA_URL=https://mcp.jina.ai/v1
MCP_JINA_AUTH_HEADER=Bearer jina_xxx
```

官方仓库给出的远程 MCP 配置示例明确支持：

```json
{
  "headers": {
    "Authorization": "Bearer ${JINA_API_KEY}"
  }
}
```

也就是说，Jina 的 key 不是写进 URL，而是走 `Authorization` 头。

官方仓库：

https://github.com/jina-ai/MCP

### 6.2 `firecrawl`

本地运行命令：

```bash
HTTP_STREAMABLE_SERVER=true FIRECRAWL_API_KEY=fc-xxxx npx -y firecrawl-mcp
```

默认地址：

```text
http://127.0.0.1:3000/mcp
```

官方仓库：

https://github.com/firecrawl/firecrawl-mcp-server

### 6.3 `fetch`

原生运行：

```bash
uvx mcp-server-fetch
```

但它原生更偏 `stdio`，不适合你的后端直接统一按 URL 管理。

推荐做法是加 bridge：

```bash
npx -y supergateway \
  --stdio "uvx mcp-server-fetch" \
  --port 3101 \
  --baseUrl http://127.0.0.1:3101 \
  --ssePath /sse \
  --messagePath /message
```

这样后端配置：

```dotenv
MCP_FETCH_URL=http://127.0.0.1:3101/sse
```

`fetch` 实现仓库：

https://github.com/ExactDoug/mcp-fetch

### 6.5 `bocha`

如果你使用远程 MCP：

```dotenv
MCP_BOCHA_URL=https://mcp.bochaai.com/sse
MCP_BOCHA_AUTH_HEADER=Bearer sk-xxxx
```

后端网关对它发起 SSE/HTTP 请求时，附带：

```http
Authorization: Bearer sk-xxxx
```

这和你提供的接入方式一致。

推断说明：

这里“远程端点 + Authorization Header”模式意味着从项目后端接入角度，不必本地拉 Bocha 代码。只有在你要自托管 Bocha MCP、或者你手头不是远程服务地址而是源码仓库时，才需要本地部署。

### 6.4 `markitdown`

如果后面要做文件上传再补，不作为当前测试环境必需项。

---

## 7. 持久化运行

测试环境如果要长期稳定运行，不要手工在终端里挂着。直接用 `systemd`。

### 7.1 Firecrawl systemd

建议文件：

```text
/etc/systemd/system/ppt-firecrawl-mcp.service
```

内容：

```ini
[Unit]
Description=PPT Firecrawl MCP Server
After=network.target

[Service]
Type=simple
User=zhx
WorkingDirectory=/Users/zhx/data/IdeaProjects/own/ppt
Environment=HTTP_STREAMABLE_SERVER=true
Environment=FIRECRAWL_API_KEY=fc-xxxx
ExecStart=/usr/bin/env npx -y firecrawl-mcp
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

启用：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now ppt-firecrawl-mcp
sudo systemctl status ppt-firecrawl-mcp
```

### 7.2 Fetch Bridge systemd

建议文件：

```text
/etc/systemd/system/ppt-fetch-mcp.service
```

内容：

```ini
[Unit]
Description=PPT Fetch MCP Bridge
After=network.target

[Service]
Type=simple
User=zhx
WorkingDirectory=/Users/zhx/data/IdeaProjects/own/ppt
ExecStart=/usr/bin/env npx -y supergateway --stdio "uvx mcp-server-fetch" --port 3101 --baseUrl http://127.0.0.1:3101 --ssePath /sse --messagePath /message
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

启用：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now ppt-fetch-mcp
sudo systemctl status ppt-fetch-mcp
```

### 7.3 Jina 不需要持久化

因为它是远程 MCP：

```text
https://mcp.jina.ai/v1
```

所以不需要本地 systemd 服务。

---

## 8. 后端回退策略

后端不要把失败切换写成散乱 if/else。统一放到 `McpGateway.read_url_markdown()`。

推荐伪代码：

```python
def read_url_markdown(url: str) -> ReadResult:
    providers = []

    if settings.MCP_JINA_URL:
        providers.append("jina")
    if settings.MCP_FIRECRAWL_URL:
        providers.append("firecrawl")
    if settings.MCP_FETCH_URL:
        providers.append("fetch")

    last_error = None
    for provider in providers:
        try:
            return client(provider).read_url(url)
        except Exception as exc:
            last_error = exc
            logger.warning("mcp reader failed", provider=provider, url=url, error=str(exc))

    raise RuntimeError(f"all markdown readers failed: {last_error}")
```

规则：

1. 只要有一个成功，就继续链路
2. 不要因为主读取器失败就整体失败
3. 把失败 provider 记录进 `tool_runs`

---

## 9. 推荐最终方案

如果你问我测试环境最合理怎么配，我给的答案是：

### 9.1 先跑起来

1. 配置 `MCP_BOCHA_URL`
2. 直接启用 `MCP_JINA_URL=https://mcp.jina.ai/v1`

### 9.2 再补稳定性

1. 本地用 `systemd` 起 `firecrawl`
2. 后端回退顺序设为 `jina -> firecrawl`

### 9.3 最后再做第三路兜底

1. 如果你确实遇到 `jina` 和 `firecrawl` 都偶发失败
2. 再补 `fetch bridge`

别一开始就把三套都堆起来，那是在给自己增加维护面。

---

## 10. 外部参考

1. Jina MCP 官方仓库：
   https://github.com/jina-ai/MCP
2. Firecrawl MCP 官方仓库：
   https://github.com/firecrawl/firecrawl-mcp-server
3. MCP Fetch Server 实现：
   https://github.com/ExactDoug/mcp-fetch
