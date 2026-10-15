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
  <a href="#-支持平台矩阵实测-35-个平台"><img src="https://img.shields.io/badge/Tested%20Platforms-35-brightgreen.svg" alt="Tested Platforms: 35"></a>
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

**PostSnap 提供了开箱即用的轻量级解决方案**：纯 Node.js 内存运算（0 额外显存/浏览器开销），毫秒级输出标准化富文本 HTML 与结构精美的 Markdown！

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

### 调用示例 (cURL)

```bash
curl -X POST http://localhost:3008/api/v1/extract \
  -H "Content-Type: application/json" \
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
    "publish_time": "2026-10-14T18:50:15.000Z",
    "source_url": "https://mp.weixin.qq.com/s/23p2uY833xO6X2CwMsDRyg",
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

#### 📝 Markdown 排版输出效果预览

提取出的 `data.markdown` 自动具备结构化头版、自动小标题提升与 GFM 语法规范：

```markdown
# 特斯拉中国突然上架新车，10月15日开售，售价仅1399元

> **作者**：科技盘点君 &nbsp;|&nbsp; **发布时间**：2026-10-14T18:50:15.000Z &nbsp;|&nbsp; **来源平台**：微信公众号 &nbsp;|&nbsp; **原文链接**：[点击查看](https://mp.weixin.qq.com/s/23p2uY833xO6X2CwMsDRyg)

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
    headers: { 'Content-Type': 'application/json' },
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

## 🌐 支持平台矩阵（实测 35 个平台）

| 平台分类 | 覆盖平台 | 核心特性与适配策略 |
| :--- | :--- | :--- |
| **自媒体/门户** | 微信公众号、今日头条、搜狐号、网易号、百度百家号、新浪看点、中华网、大象新闻 | 微信长文+小绿书多图、搜狐AES图片解密、头条移动端SSR穿透 |
| **社交与创作社区** | 小红书、网易LOFTER、微博头条、知乎专栏与回答、豆瓣日记、百度贴吧 | 小红书笔记图文、LOFTER博客长文、微博头条长文、贴吧主楼穿透 |
| **科技创投/智库** | 36氪、虎嗅网、少数派、IT之家、创业邦、前瞻经济学人、澎湃新闻、ZAKER | 36氪SSR提取、创业邦万字深度特稿、全量高清插图保留 |
| **技术社区** | 稀土掘金、CSDN、博客园、SegmentFault思否、开源中国、GitHub Blog | 代码块语言语法保留、技术图表格式提取、防盗链隔离 |
| **财经与体育** | 雪球、东方财富网、网易财经、直播吧 | 股评研报、行情复盘长文、赛事战报超高密度动图提取 |
| **全网通用兜底** | 独立博客（WordPress、Hexo、Hugo、Ghost 等）、海外新闻媒体 | 内置Mozilla Readability正文评分，全网自适应智能提取 |

---

### 🧪 自动化基准测试

项目内置了针对 **35个主流平台真实文章** 的全量自动化测试套件（定义在 [`test/platforms.json`](test/platforms.json)），启动本地服务后即可一键运行：

```bash
# 启动本地服务后运行 35 个平台全量实测
npm run test:platforms

# 运行基础单元测试套件
npm test
```

---

## 📄 开源许可证

本项目基于 [MIT 许可证](LICENSE) 开源，由 [ucmao](https://github.com/ucmao) 维护，欢迎自由商用与二次开发。
