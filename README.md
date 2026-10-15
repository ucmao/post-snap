# 📸 PostSnap (全网文章一键快照与图文提取引擎)

> **专为现代富文本编辑器设计的全网文章一键提取与图片转存开源引擎**。  
> 解决自媒体/博客后台中“粘贴任意文章 URL，一键将标题、作者、富文本排版和超清图片完美同步进编辑器”的需求，内置**真实浏览器指纹伪装**、**微信多图轮播（小绿书）自适应**与**防盗链穿透**能力。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20.0.0-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg)](https://www.docker.com/)

---

## 💡 为什么需要 PostSnap？

在后台管理系统或 CMS 开发中，运营人员经常有这样的需求：
> *“在微信公众号、知乎、36氪、今日头条看到一篇好文章，想直接粘贴 URL，系统自动把整篇文章（包括标题、作者、富文本排版和高清大图）完整导入后台富文本框，不再需要手动复制粘贴和一张张重新上传图片。”*

然而，直接抓取通常会遇到以下**致命痛点**：
1. **反爬与 WAF 盾拦截**：大型平台（如 36氪、知乎、头条）会校验网络层指纹与 `sec-ch-ua` 标头，普通爬虫直接返回 403 或验证盾脚本；
2. **微信图片空白与小绿书形态**：微信传统文章有 `data-src` 懒加载，新型“小绿书图文消息”甚至没有文章正文节点，普通抓取器直接失效；
3. **防盗链裂图**：微信公众平台（`mmbiz.qpic.cn`）有严格的 `Referer` 防盗链机制，直接引用会导致图片破损裂开；
4. **样式污染**：直接拷贝网页代码会带入大量外部 CSS、JS 弹窗与广告，破坏后台整体 UI。

**PostSnap 提供了开箱即用的轻量级解决方案**：纯 Node.js 内存运算（0 额外显存/浏览器开销），毫秒级输出标准化富文本 HTML / Markdown！

---

## ✨ 核心特性

- 🎯 **主流自媒体平台深度适配 (实测成功率 85.7%+)**：
  - **微信公众号**：完美支持**传统万字长文**与**新型多图轮播（小绿书形态）**双模式，自动修复懒加载图片，提取发布时间与公众号名称；
  - **今日头条**：智能重写移动端 SSR 端点，秒级绕过 PC 端的字节跳动 `_$jsvmprt` 混淆反爬墙；
  - **36氪**：自动提取内联 SSR 数据流，毫秒级还原万字商业长文；
  - **豆瓣日记**：通过移动端 Rexxar API 穿透 PC 端强制登录墙；
  - **稀土掘金 / CSDN / 博客园 / SegmentFault / 少数派 / IT之家 / 虎嗅 / 微博头条 / 百度百家号 / 腾讯新闻 / 网易号**：全量经过实测，秒级稳定解析。
- 🛡️ **真实浏览器指纹模拟 (`got-scraping`)**：
  - 自动模拟 Chrome 120+ 真实桌面/移动设备的 Client Hints（`sec-ch-ua`）、HTTP/2 协议栈与严格的标头排列顺序，无需笨重的无头浏览器即可穿透大部分常规 WAF。
- 🌐 **全网智能算法兜底 (Mozilla Readability)**：
  - 内置火狐浏览器官方阅读模式算法，面对任意未适配的独立博客（WordPress、Hexo、Hugo）、海外媒体（GitHub Blog、Medium），自适应通过文本密度和语义评分定位正文。
- 🖼️ **防盗链穿透与图片自动转存**：
  - **直接穿透**：所有 `<img>` 标签自动注入 `referrerpolicy="no-referrer"`；
  - **自动转存**：开启 `upload_images: true`，服务端自动并发下载图片并存储至本地 `uploads/` 目录（或转换为 Base64），彻底摆脱外链依赖。
- 📝 **双格式输出**：同时返回 `html`（富文本格式）与 `markdown` 格式。

---

## 🚀 快速开始

### 方式一：本地 Node.js 运行

```bash
# 1. 克隆项目并进入目录
git clone https://github.com/your-org/post-snap.git
cd post-snap

# 2. 安装依赖
npm install

# 3. 复制环境变量
cp .env.example .env

# 4. 启动开发环境 (支持热重载)
npm run dev

# 5. 生产构建与启动
npm run build
npm start
```

服务默认运行在 `http://localhost:3000`。

### 方式二：Docker & Docker Compose 一键运行（推荐）

```bash
# 启动容器并持久化存储上传目录
docker compose up -d --build

# 查看运行日志
docker compose logs -f
```

---

## 📖 API 接口文档

### 1. 文章提取与富文本生成

- **接口地址**：`POST /api/v1/extract` 或 `GET /api/v1/extract?url=...`
- **Content-Type**：`application/json`

#### 请求参数

| 参数名 | 类型 | 必填 | 默认值 | 详细说明 |
| :--- | :--- | :---: | :---: | :--- |
| `url` | `string` | **是** | - | 目标文章链接（支持 HTTP/HTTPS） |
| `upload_images` | `boolean` | 否 | `false` | **是否转存图片**。为 `true` 时后端自动下载图片并替换 URL |
| `image_storage` | `string` | 否 | `'local'` | 转存方式：`'local'`（存入本地 uploads 目录）或 `'base64'` |
| `format` | `string` | 否 | `'both'` | 返回格式：`'both'` \| `'html'` \| `'markdown'` |
| `clean_styles` | `boolean` | 否 | `false` | 是否移除所有内联 CSS。为 `false` 保留精美排版 |

#### 快速 GET 调用示例（浏览器或终端直接敲）：

```text
http://localhost:3000/api/v1/extract?url=https://mp.weixin.qq.com/s/23p2uY833xO6X2CwMsDRyg
```

#### 标准 POST 调用示例 (cURL)：

```bash
curl -X POST http://localhost:3000/api/v1/extract \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://36kr.com/p/4026620885782912",
    "upload_images": true,
    "format": "both"
  }'
```

#### 成功响应数据 (JSON)：

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "title": "一边爽一边骂，我们到底中了AI短剧什么毒？",
    "author": "36氪",
    "publish_time": "2026-10-15T02:30:00.000Z",
    "source_url": "https://36kr.com/p/4026620885782912",
    "platform": "36氪",
    "cover_image": "http://localhost:3000/uploads/cover.jpg",
    "word_count": 10361,
    "images": [
      {
        "original_url": "https://img.36krcdn.com/...",
        "rehosted_url": "http://localhost:3000/uploads/7f8a9b0c1d2e.png",
        "alt": "配图"
      }
    ],
    "html": "<section style=\"color: #333;\"><p>正文内容...</p><p><img src=\"http://localhost:3000/uploads/7f8a9b0c1d2e.png\" referrerpolicy=\"no-referrer\"></p></section>",
    "markdown": "## 一边爽一边骂，我们到底中了AI短剧什么毒？\n\n正文内容...\n\n![](http://localhost:3000/uploads/7f8a9b0c1d2e.png)"
  }
}
```

---

## 🧪 自动化全平台基准测试

项目内置了针对全网 28 个主流平台的真实文章自动化基准测试套件：

```bash
npm run test:platforms
```

该脚本会自动并发压测所有平台的文章抓取率、耗时、字数与图片提取准确度，并打印漂亮的汇总分析表。

---

## 💻 前端富文本编辑器（Vue 3 / React）集成示例

```javascript
// 在管理后台中一键抓取并回填
async function handleImport(articleUrl) {
  const res = await fetch(`http://localhost:3000/api/v1/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: articleUrl,
      upload_images: true // 自动转存图片到本地，彻底防止防盗链裂图
    })
  });
  const { data } = await res.json();

  // 1. 自动填入文章标题输入框
  document.querySelector('#title-input').value = data.title;
  
  // 2. 注入富文本编辑器 (以 WangEditor / TinyMCE 为例)
  editor.setHtml(data.html);
}
```

---

## 🛠️ 项目结构

```text
post-snap/
├── src/
│   ├── index.ts               # Fastify 启动入口、CORS、静态服务
│   ├── config.ts              # 环境变量与 Cookie 配置
│   ├── types/                 # TypeScript 类型契约
│   ├── extractors/            # 核心平台提取器
│   │   ├── wechat.ts          # 微信公众号 (长文 + 小绿书图片轮播)
│   │   ├── toutiao.ts         # 今日头条 (移动端 SSR 穿透)
│   │   ├── 36kr.ts            # 36氪 (SSR 数据流解析)
│   │   ├── douban.ts          # 豆瓣日记 (Rexxar API 穿透)
│   │   ├── zhihu.ts           # 知乎专栏
│   │   ├── juejin.ts          # 稀土掘金
│   │   ├── csdn.ts            # CSDN 博客
│   │   ├── general.ts         # Mozilla Readability 全网自适应兜底
│   │   └── index.ts           # 路由分发器
│   ├── services/
│   │   ├── html-cleaner.ts    # 富文本安全清洗与排版规范化
│   │   ├── markdown.ts        # Turndown HTML 转 Markdown
│   │   ├── image-downloader.ts# 防盗链绕过与图片转存替换引擎
│   │   └── storage/           # 本地磁盘 (Local) / Base64 存储驱动
│   └── routes/
│       ├── extract.ts         # /api/v1/extract 核心路由
│       └── health.ts          # 健康检查
├── uploads/                   # 本地图片上传与静态服务目录
├── test/
│   ├── extract.test.ts        # 基础单元测试
│   ├── test-platforms.ts      # 28 个全平台全量自动化回归测试
│   └── platforms.json         # 平台真实测试数据集
├── Dockerfile                 # 生产级多阶段构建镜像
└── docker-compose.yml         # 容器编排文件
```

---

## 📄 开源许可证

本项目基于 [MIT 许可证](LICENSE) 开源，欢迎自由商用与二次开发。
