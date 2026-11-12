<p align="center">
  <img src="assets/post-snap-logo.png" alt="PostSnap Logo" width="180" />
</p>

<h1 align="center">PostSnap</h1>

<p align="center"><strong>全网文章一键快照与图文排版提取引擎</strong></p>

> **专为现代富文本编辑器与知识库设计的全网文章提取与图片转存开源引擎**。  
> 解决自媒体/博客后台中“粘贴任意文章 URL，一键将标题、作者、发布时间、富文本排版、超清配图与精美 Markdown 完美同步进编辑器”的需求，内置**真实浏览器指纹伪装**、**微信多图轮播（小绿书）自适应**、**搜狐 AES-128 密文图片逆向解密**、**微博头条长文穿透**与**防盗链转存**能力。

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
  <img src="https://img.shields.io/badge/Node.js-%3E%3D20.0.0-green.svg" alt="Node.js">
  <img src="https://img.shields.io/badge/TypeScript-5.x-blue.svg" alt="TypeScript">
  <a href="test/reports/platform-report.md"><img src="https://img.shields.io/badge/Platforms-35%20covered-blue.svg" alt="Platforms: 35 covered"></a>
  <img src="https://img.shields.io/badge/Docker-Ready-2496ED.svg" alt="Docker Ready">
</p>

---

## 💡 为什么需要 PostSnap？

在后台管理系统、CMS 内容库或 AI 知识库开发中，运营与技术团队经常有这样的需求：
> *“在微信公众号、小红书、知乎、36氪、今日头条、微博头条看到一篇好文章，想直接粘贴 URL，系统自动把整篇文章（包括标题、作者、发布日期、格式规范的 Markdown、富文本排版和高清大图）完整导入后台富文本框或知识库，不再需要手动复制粘贴和一张张重新上传图片。”*

然而，直接抓取通常会遇到以下**核心痛点**：
1. **反爬与 WAF 盾拦截**：大型平台（如 36氪、知乎、头条、百度贴吧）会严格校验网络层指纹与 `sec-ch-ua` 标头，普通爬虫直接返回 403 或验证盾脚本；
2. **微信图片空白与小绿书形态**：微信传统文章有 `data-src` 懒加载，新型“小绿书图文消息”甚至没有传统正文容器，普通提取器直接失效；
3. **搜狐号前端图片加密**：搜狐正文图片全部通过 `AES-128-ECB` 进行字符串混淆，直接提取只能得到乱码图片；
4. **防盗链裂图**：微信公众平台（`mmbiz.qpic.cn`）等有严格的 `Referer` 防盗链机制，直接引用会导致图片破损裂开；
5. **Markdown 格式混乱**：缺乏语义化章节标题、无表格支持、代码块丢失语言标识、存在垃圾符号残留。

**PostSnap 提供了开箱即用的轻量级解决方案**：纯 Node.js 实现，无需 Headless 浏览器，一次请求即可输出标准化富文本 HTML 与结构清晰的 Markdown。耗时主要取决于目标站点响应速度（通常为数百毫秒到数秒）。

---

## 🚀 快速开始

### 方式一：本地 Node.js 运行

```bash
# 1. 克隆项目并进入目录
git clone https://github.com/ucmao/post-snap.git
cd post-snap

# 2. 安装项目依赖
npm install

# 3. 复制环境变量配置文件
cp .env.example .env

# 4. 本地构建与启动
npm run build
npm start

# 或开发模式运行（支持热重载）
npm run dev
```

服务启动后默认运行在：`http://localhost:3008`。

---

### 方式二：Docker & Docker Compose 一键运行（推荐）

```bash
# 1. 克隆项目并进入目录
git clone https://github.com/ucmao/post-snap.git
cd post-snap

# 2. 启动容器并持久化存储上传目录
docker compose up -d --build

# 3. 查看运行日志
docker compose logs -f
```

---

## 🔌 API 接口与使用规范

### 接口定义

`POST /api/v1/extract` 或 `GET /api/v1/extract?url=...`

#### 请求参数 (JSON Body 或 Query)

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
| :--- | :--- | :---: | :---: | :--- |
| `url` | `string` | **是** | - | 目标文章链接（支持 HTTP/HTTPS 任意长链/短链） |
| `format` | `string` | 否 | `'both'` | 返回格式：`'both'` \| `'markdown'` \| `'html'` |
| `upload_images` | `boolean` | 否 | `false` | 是否自动将图片转存到本地（防止外链防盗链裂图） |
| `image_storage` | `string` | 否 | `'local'` | 图片存储驱动：`'local'`（本地磁盘） \| `'base64'` |
| `clean_styles` | `boolean` | 否 | `false` | 是否移除 HTML 中的内联 CSS 样式 |
| `markdown_header`| `boolean` | 否 | `true` | 是否在 Markdown 顶部自动生成标题与元信息头版 |

---

### 🔐 安全配置（公网部署必读）

PostSnap 会代替调用方去请求任意 URL 并下载图片，暴露到公网前请务必配置以下环境变量（见 `.env.example`）：

| 变量 | 默认值 | 说明 |
| :--- | :---: | :--- |
| `API_KEY` | 空 | API 密钥（多个用逗号分隔）。留空则不鉴权，**仅适合本地开发** |
| `RATE_LIMIT_PER_MINUTE` | `30` | 每个 IP 每分钟请求上限，`0` 为不限流 |
| `CORS_ORIGINS` | 空 | 允许跨域的来源，留空为全部允许 |
| `TRUST_PROXY` | `false` | 部署在 Nginx / LB 后设为 `true`，按真实 IP 限流 |
| `ALLOW_PRIVATE_NETWORK` | `false` | 是否允许抓取内网地址。公网部署请保持 `false` |
| `MAX_IMAGES_PER_ARTICLE` | `100` | 单篇文章最多转存图片数 |

内置防护：

- **SSRF 防护**：拒绝非 http(s) 协议，拒绝解析到 `127.0.0.0/8`、`10/8`、`172.16/12`、`192.168/16`、`169.254/16`（云元数据）、IPv6 私有段等地址；每次重定向和实际建连时都会重新校验。
- **图片转存加固**：按文件头（magic bytes）识别真实类型，仅保存 JPEG / PNG / GIF / WebP / AVIF / BMP，拒绝 SVG 与 HTML；下载时流式限制大小；`/uploads/` 响应带 `nosniff` 与严格 CSP。
- **鉴权方式**：Header `X-API-Key: <key>`、`Authorization: Bearer <key>`，或 GET 请求 Query `api_key=<key>`。

#### 错误码

| `code` | 含义 |
| :---: | :--- |
| `400` | URL 非法，或指向内网 / 保留地址 |
| `401` | 缺少或错误的 API Key |
| `422` | 页面获取成功但未能提取到正文（验证页、登录墙等） |
| `429` | 触发限流，参考 `Retry-After` 响应头 |
| `502` | 目标站点返回非 2xx（反爬拦截、需要登录、文章已删除等）或空响应 |
| `500` | 服务内部错误 |

---

### 调用示例 (cURL)

```bash
curl -X POST http://localhost:3008/api/v1/extract \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "url": "https://mp.weixin.qq.com/s/23p2uY833xO6X2CwMsDRyg",
    "format": "both"
  }'
```

#### 返回结果示例 (JSON)

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "title": "特斯拉中国突然上架新车，10月15日开售，售价仅1399元",
    "author": "科技盘点君",
    "publish_time": "2026-10-14T10:50:15.000Z",
    "publish_time_raw": "1791975015",
    "source_url": "https://mp.weixin.qq.com/s/23p2uY833xO6X2CwMsDRyg",
    "platform_id": "wechat",
    "platform": "微信公众号",
    "cover_image": "https://mmbiz.qpic.cn/...",
    "word_count": 1710,
    "images": [
      {
        "original_url": "https://mmbiz.qpic.cn/...",
        "alt": "配图"
      }
    ],
    "markdown": "# 特斯拉中国突然上架新车...\n\n> 作者：科技盘点君...",
    "html": "<section><p>正文内容...</p><p><img src=\"https://mmbiz.qpic.cn/...\" referrerpolicy=\"no-referrer\"></p></section>"
  }
}
```

#### 返回字段说明

| 字段 | 说明 |
| :--- | :--- |
| `platform_id` | **稳定的平台标识**，可放心用于分支判断，如 `wechat`、`zhihu`、`xiaohongshu`、`36kr`、`web`（未识别站点）。完整列表见 [`src/utils/platform.ts`](src/utils/platform.ts) |
| `platform` | 平台展示名称，如 `微信公众号`，仅用于展示，可能调整 |
| `publish_time` | 统一为 **ISO 8601（UTC）**。无时区的国内站点时间按北京时间（UTC+8）换算；支持时间戳、`2026-10-14 18:50`、`2026年10月14日`、`3小时前`、`昨天 12:30` 等格式。无法可靠解析时省略该字段 |
| `publish_time_raw` | 页面上的原始时间值，便于排查或自行解析 |
| `word_count` | 正文字符数（去除空白） |
| `images` | 正文图片；开启 `upload_images` 时包含 `rehosted_url` |

> Markdown 头版中的发布时间以北京时间 `YYYY-MM-DD HH:mm` 展示。

#### 📝 Markdown 排版输出效果预览

提取出的 `data.markdown` 自动具备结构化头版、自动小标题提升与 GFM 语法规范：

```markdown
# 特斯拉中国突然上架新车，10月15日开售，售价仅1399元

> **作者**：科技盘点君 &nbsp;|&nbsp; **发布时间**：2026-10-14 18:50 &nbsp;|&nbsp; **来源平台**：微信公众号 &nbsp;|&nbsp; **原文链接**：[点击查看](https://mp.weixin.qq.com/s/23p2uY833xO6X2CwMsDRyg)

---

特斯拉又出新车了，售价只要1399元。

先别激动，这次不是Model 3降价，也不是什么全新的电动车，而是一辆专门给小朋友准备的两轮平衡车。

## 一、产品细节

![](https://mmbiz.qpic.cn/...)
```

---

### 前端编辑器（Vue / React / 原生）集成示例

```javascript
async function importArticleToEditor(articleUrl) {
  const res = await fetch('http://localhost:3008/api/v1/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': 'your-api-key' },
    body: JSON.stringify({
      url: articleUrl,
      upload_images: true // 自动转存图片到本地，彻底防裂图
    })
  });
  const { code, data } = await res.json();
  if (code !== 200 || !data) return;

  // 1. 回填标题与作者
  document.querySelector('#title-input').value = data.title;
  document.querySelector('#author-input').value = data.author;

  // 2. 注入富文本编辑器 (以 WangEditor / TinyMCE / ProseMirror 为例)
  editor.setHtml(data.html);

  // 3. 或注入 Markdown 编辑器 (如 Vditor / ByteMD / CherryMarkdown)
  mdEditor.setValue(data.markdown);
}
```

---

## 🌐 支持平台矩阵（覆盖 35 个平台）

| 平台分类 | 覆盖平台 | 核心特性与适配策略 |
| :--- | :--- | :--- |
| **自媒体/门户** | 微信公众号、今日头条、搜狐号、网易号、百度百家号、新浪看点、中华网、大象新闻 | 微信长文+小绿书多图、搜狐AES图片解密、头条移动端SSR穿透 |
| **社交与创作社区** | 小红书、网易LOFTER、微博头条、知乎专栏与回答、豆瓣日记、百度贴吧 | 小红书笔记图文、LOFTER博客长文、微博头条长文、贴吧主楼穿透 |
| **科技创投/智库** | 36氪、虎嗅网、少数派、IT之家、创业邦、前瞻经济学人、澎湃新闻、ZAKER | 36氪SSR提取、创业邦万字深度特稿、全量高清插图保留 |
| **技术社区** | 稀土掘金、CSDN、博客园、SegmentFault思否、开源中国、GitHub Blog | 代码块语言语法保留、技术图表格式提取、防盗链隔离 |
| **财经与体育** | 雪球、东方财富网、网易财经、直播吧 | 股评研报、行情复盘长文、赛事战报超高密度动图提取 |
| **全网通用兜底** | 独立博客（WordPress、Hexo、Hugo、Ghost 等）、海外新闻媒体 | 内置Mozilla Readability正文评分，全网自适应智能提取 |

---

### 🧪 测试

测试分为三层，前两层完全离线，已接入 GitHub Actions CI：

| 命令 | 网络 | 说明 |
| :--- | :---: | :--- |
| `npm test` | 离线 | 单元测试（提取器、HTML 清洗、Markdown、SSRF 防护、时间与平台归一化）+ 平台快照回归测试 |
| `npm run fixtures:record` | 需要 | 对 [`test/platforms.json`](test/platforms.json) 中的真实文章跑完整流程，录制所有 HTTP 响应到 `test/fixtures/<id>.json`，并生成[实测报告](test/reports/platform-report.md) |
| `npm run test:platforms` | 需要 | 对已启动的服务（默认 `http://localhost:3008`）做端到端基准测试，设置了 `API_KEY` 时会自动携带 |

**平台快照回归**：`npm test` 会把 `test/fixtures/` 中录制的真实响应离线回放，并与录制时的结果比对（标题、作者、发布时间、字数、图片数、Markdown 哈希）。改动提取器后无需联网即可发现回归，也不会因为平台临时封禁或文章被删而误报。平台改版导致提取失效时：修复提取器 → `npm run fixtures:record -- <id>` 重新录制 → 检查 diff。

**实测通过率**：真实网络下的结果受反爬策略与平台改版影响，会随时间波动。最新通过率以 [`test/reports/platform-report.md`](test/reports/platform-report.md) 为准（由 `npm run fixtures:record` 生成）。

```bash
npm test                      # 离线单元测试 + 快照回归
npm run typecheck             # 类型检查（含测试与脚本）
npm run fixtures:record       # 联网录制全部平台快照并生成报告
npm run fixtures:record -- wechat zhihu   # 只重录指定平台
```

---

## 📄 开源许可证

本项目基于 [MIT 许可证](LICENSE) 开源，由 [ucmao](https://github.com/ucmao) 维护，欢迎自由商用与二次开发。
