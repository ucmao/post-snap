# 📄 Article Extractor API (全网文章内容与图文提取服务)

> **专为现代富文本编辑器设计的文章一键提取与图片转存开源 API**。  
> 解决自媒体/博客后台中“粘贴文章 URL，一键将标题、作者、富文本排版和图片完美导入富文本框”的业务需求，彻底解决**微信图片懒加载空白**和**第三方平台防盗链裂图**问题。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20.0.0-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg)](https://www.docker.com/)

---

## 💡 为什么需要这个项目？

在后台管理系统开发中，经常会有这样的运营需求：
> *“用户在公众号、知乎看到一篇好文章，想直接粘贴 URL，系统自动把整篇文章（包括标题、作者、正文富文本排版和图片）完整导入到后台的富文本编辑器里，不需要手动复制粘贴和逐张上传图片。”*

然而，直接抓取通常会遇到以下**致命痛点**：
1. **微信图片空白**：微信公众号所有图片均使用 `data-src` 懒加载，常规爬虫或浏览器复制后都是 1x1 像素的空白透明图；
2. **防盗链裂图**：微信公众平台（`mmbiz.qpic.cn`）和知乎（`zhimg.com`）有严格的 `Referer` 防盗链机制，直接引用原图 URL 会显示“未经允许不可引用”或直接破损裂图；
3. **样式污染与 XSS 风险**：原网页夹杂了大量的全局 CSS、`<script>` 弹窗脚本、广告及点赞挂件，直接粘进富文本会破坏管理后台整体样式，甚至引发安全隐患。

**本服务提供开箱即用的轻量 RESTful API**：输入 URL，自动清洗出标准化富文本 HTML / Markdown，并支持将图片转存至本地或 Base64，一键输出直接可用的 JSON 数据。

---

## ✨ 核心特性

- 🎯 **主流平台深度适配**：
  - **微信公众号**：自动还原精美排版、解析 `data-src` 懒加载图片、提取发布时间与公众号名称、过滤打赏/广告噪音。
  - **知乎专栏 & 问答**：自动解析 `data-actualsrc` 真实高分辨率原图，提取作者与标题。
  - **掘金 & CSDN**：自动清洗版权尾巴、关注可见遮罩与多余代码块包裹层。
- 🌐 **全网通用智能兜底**：
  - 基于 **Mozilla Readability** 算法（Firefox 阅读模式核心引擎），针对任意独立博客、新闻站点、WordPress、Medium 自适应提取正文。
- 🖼️ **防盗链穿透与图片转存（核心优势）**：
  - **直接穿透**：自动注入 `referrerpolicy="no-referrer"`，纯静态模式下也可直接显示防盗链图片。
  - **自动转存**：可开启 `upload_images: true`，API 服务自动并发下载所有外链图片并存储到本地静态目录（或转换为 Base64），彻底摆脱外链依赖。
- 🧼 **富文本安全与样式清洗**：
  - 基于 `sanitize-html` 白名单机制，剔除所有危险标签，规范化 `img` / `a` 标签。
  - 支持保留微信等精美行内样式（排版不乱），也可一键启用 `clean_styles: true` 剥离内联 CSS 输出极简纯语义 HTML。
- 📝 **双格式输出**：同时返回 `html`（富文本格式）与 `markdown` 格式，满足不同编辑器场景。

---

## 🚀 快速开始

### 方式一：本地 Node.js 运行

**前置依赖**：Node.js >= 20.0.0

```bash
# 1. 克隆项目并进入目录
cd article-extractor-api

# 2. 安装依赖
npm install

# 3. 复制环境变量
cp .env.example .env

# 4. 开发环境热重载启动
npm run dev

# 5. 生产构建与启动
npm run build
npm start
```

服务默认运行在 `http://localhost:3000`。

### 方式二：Docker & Docker Compose 运行（推荐生产部署）

```bash
# 启动容器
docker-compose up -d --build

# 查看运行日志
docker-compose logs -f
```

---

## 📖 API 接口文档

### 1. 文章提取与富文本生成

- **接口地址**：`POST /api/v1/extract`
- **Content-Type**：`application/json`

#### 请求参数 (Body)

| 参数名 | 类型 | 必填 | 默认值 | 详细说明 |
| :--- | :--- | :---: | :---: | :--- |
| `url` | `string` | **是** | - | 目标文章链接（支持 HTTP/HTTPS） |
| `upload_images` | `boolean` | 否 | `false` | **是否转存图片**。为 `true` 时后端会自动下载图片并替换 URL |
| `image_storage` | `string` | 否 | `'local'` | 转存方式：`'local'`（存入本地 uploads 目录）或 `'base64'` |
| `format` | `string` | 否 | `'both'` | 返回格式：`'both'` \| `'html'` \| `'markdown'` |
| `clean_styles` | `boolean` | 否 | `false` | 是否移除所有内联 CSS 样式。为 `false` 保留公众号精美排版 |

#### 请求示例 (cURL)

```bash
curl -X POST http://localhost:3000/api/v1/extract \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://mp.weixin.qq.com/s/sample_article_id",
    "upload_images": true,
    "image_storage": "local",
    "format": "both"
  }'
```

#### 成功响应 (JSON)

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "title": "深入剖析现代前端架构设计",
    "author": "技术漫谈",
    "publish_time": "2026-10-15T02:30:00.000Z",
    "source_url": "https://mp.weixin.qq.com/s/sample_article_id",
    "platform": "WeChat Official Account",
    "cover_image": "http://localhost:3000/uploads/a1b2c3d4e5f6.jpg",
    "word_count": 2840,
    "images": [
      {
        "original_url": "https://mmbiz.qpic.cn/mmbiz_png/abc123/640",
        "rehosted_url": "http://localhost:3000/uploads/7f8a9b0c1d2e.png",
        "alt": "架构图解"
      }
    ],
    "html": "<section style=\"color: #333;\"><p>正文内容...</p><p><img src=\"http://localhost:3000/uploads/7f8a9b0c1d2e.png\" referrerpolicy=\"no-referrer\" alt=\"架构图解\"></p></section>",
    "markdown": "## 深入剖析现代前端架构设计\n\n正文内容...\n\n![架构图解](http://localhost:3000/uploads/7f8a9b0c1d2e.png)",
    "text": "深入剖析现代前端架构设计 正文内容..."
  }
}
```

### 2. 健康检查

- `GET /health`：检查系统服务与运行状态。
- `GET /uploads/:filename`：访问转存到本地的静态图片资源。

---

## 💻 前端富文本编辑器集成指南

如果你的开发者朋友正在使用 **Vue 3** 和流行的富文本编辑器（如 **WangEditor**、**TinyMCE** 或 **Quill**），只需几行代码即可实现无缝贴入：

### 示例代码 (Vue 3 + Fetch)

```vue
<template>
  <div class="article-import-bar">
    <input 
      v-model="articleUrl" 
      placeholder="粘贴微信公众号、知乎等文章链接..." 
      style="width: 400px; padding: 8px;"
    />
    <button :disabled="loading" @click="handleImportArticle" style="padding: 8px 16px;">
      {{ loading ? '正在提取排版与图片...' : '一键导入' }}
    </button>
  </div>

  <!-- 你的富文本编辑器容器 (以 WangEditor 为例) -->
  <div id="editor-container"></div>
</template>

<script setup>
import { ref } from 'vue';

const articleUrl = ref('');
const loading = ref(false);

async function handleImportArticle() {
  if (!articleUrl.value) return alert('请输入文章链接');
  
  loading.value = true;
  try {
    const res = await fetch('http://localhost:3000/api/v1/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: articleUrl.value,
        upload_images: true, // 开启自动转存图片到本地，彻底防止防盗链裂图
        clean_styles: false  // 保留排版样式
      })
    });
    
    const result = await res.json();
    if (result.code === 200) {
      // 1. 设置文章标题
      document.querySelector('#title-input').value = result.data.title;
      
      // 2. 将处理好的富文本 HTML 直接注入编辑器
      // 示例：wangEditor.setHtml(result.data.html);
      // 示例：tinyMCE.activeEditor.setContent(result.data.html);
      console.log('导入成功！', result.data);
    } else {
      alert('导入失败: ' + result.message);
    }
  } catch (err) {
    alert('请求异常: ' + err.message);
  } finally {
    loading.value = false;
  }
}
</script>
```

---

## 🛠️ 项目结构

```text
article-extractor-api/
├── src/
│   ├── index.ts               # Fastify 启动入口、CORS、静态资源托管
│   ├── config.ts              # 环境变量配置
│   ├── types/                 # TypeScript 类型契约
│   ├── extractors/            # 核心提取器分发层
│   │   ├── base.ts            # 抽象基类与去噪逻辑
│   │   ├── wechat.ts          # 微信公众号专用解析器 (修复 data-src 懒加载)
│   │   ├── zhihu.ts           # 知乎专栏/问答专用解析器 (修复 data-actualsrc)
│   │   ├── juejin.ts          # 掘金文章解析器
│   │   ├── csdn.ts            # CSDN 博客解析器
│   │   ├── general.ts         # 基于 Mozilla Readability 的全网通用兜底
│   │   └── index.ts           # 自动路由分发器
│   ├── services/
│   │   ├── html-cleaner.ts    # 富文本安全白名单与样式清洗
│   │   ├── markdown.ts        # Turndown HTML 转 Markdown
│   │   ├── image-downloader.ts# 防盗链绕过、图片下载与正文 SRC 替换引擎
│   │   └── storage/           # 存储驱动 (Local 本地磁盘 / Base64 内联)
│   └── routes/
│       ├── extract.ts         # POST /api/v1/extract 路由
│       └── health.ts          # 健康检查
├── uploads/                   # 本地图片上传与静态服务目录
├── test/
│   └── extract.test.ts        # 自动化测试用例
├── Dockerfile                 # 生产级多阶段构建镜像
├── docker-compose.yml         # 容器编排文件
└── package.json
```

---

## 📄 开源许可证

本项目基于 [MIT 许可证](LICENSE) 开源，欢迎自由商用与二次开发。
