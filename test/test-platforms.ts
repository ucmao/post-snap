import fs from 'node:fs';
import path from 'node:path';
import got from 'got';

interface PlatformItem {
  id: string;
  platform: string;
  category: string;
  url: string;
  description: string;
}

interface TestResult {
  platform: string;
  category: string;
  url: string;
  success: boolean;
  title?: string;
  author?: string;
  publishTime?: string;
  wordCount?: number;
  imageCount?: number;
  markdownHeaders?: number;
  hasMetaBlock?: boolean;
  durationMs: number;
  error?: string;
}

async function runPlatformBenchmark() {
  const platformsPath = path.resolve(process.cwd(), 'test/platforms.json');
  if (!fs.existsSync(platformsPath)) {
    console.error('❌ platforms.json not found at:', platformsPath);
    process.exit(1);
  }

  const platforms: PlatformItem[] = JSON.parse(fs.readFileSync(platformsPath, 'utf-8'));
  const apiUrl = process.env.API_URL || 'http://localhost:3008/api/v1/extract';

  console.log(`\n🚀 开始针对 ${platforms.length} 个主流平台的真实文章进行自动化提取与 Markdown 格式排版测试...\n`);
  console.log(`API 端点: ${apiUrl}`);
  console.log(`--------------------------------------------------------------------------------`);

  const results: TestResult[] = [];

  for (let i = 0; i < platforms.length; i++) {
    const item = platforms[i];
    process.stdout.write(`[${i + 1}/${platforms.length}] 测试 [${item.platform}] ... `);
    const start = Date.now();

    try {
      const res = await got.post(apiUrl, {
        json: { url: item.url, upload_images: false, format: 'both' },
        timeout: { request: 15000 },
        retry: { limit: 1 },
        throwHttpErrors: false,
      });

      const duration = Date.now() - start;
      const json: any = JSON.parse(res.body);

      if (res.statusCode === 200 && json.code === 200 && json.data) {
        const title = json.data.title || '';
        const author = json.data.author || '未知';
        const publishTime = json.data.publish_time || '';
        const wordCount = json.data.word_count || 0;
        const images = json.data.images || [];
        const markdown = json.data.markdown || '';

        // Check Markdown format layout criteria
        const hasTitleH1 = markdown.startsWith(`# ${title}`) || markdown.includes(`# ${title}`);
        const hasMetaBlock = markdown.includes('> **作者**') || markdown.includes('> **来源平台**') || markdown.includes('> **原文链接**');
        const headingLevels = (markdown.match(/^#{1,6}\s+/gm) || []).length;

        // Check if extraction was actually meaningful and well-formatted
        const isGood = title !== '未命名文章' && wordCount > 30 && markdown.length > 50;

        if (isGood) {
          console.log(`✅ 成功 (${duration}ms) | 标题: "${title.slice(0, 16)}..." | 排版层级: ${headingLevels} | 字数: ${wordCount} | 图: ${images.length}`);
          results.push({
            platform: item.platform,
            category: item.category,
            url: item.url,
            success: true,
            title,
            author,
            publishTime,
            wordCount,
            imageCount: images.length,
            markdownHeaders: headingLevels,
            hasMetaBlock,
            durationMs: duration,
          });
        } else {
          console.log(`⚠️ 内容不足/未命名 (${duration}ms) | 字数: ${wordCount}`);
          results.push({
            platform: item.platform,
            category: item.category,
            url: item.url,
            success: false,
            title,
            wordCount,
            imageCount: images.length,
            durationMs: duration,
            error: '正文字数过少或 Markdown 未生成',
          });
        }
      } else {
        const errMsg = json.message || `HTTP ${res.statusCode}`;
        console.log(`❌ 失败 (${duration}ms) | 错误: ${errMsg}`);
        results.push({
          platform: item.platform,
          category: item.category,
          url: item.url,
          success: false,
          durationMs: duration,
          error: errMsg,
        });
      }
    } catch (err: any) {
      const duration = Date.now() - start;
      console.log(`❌ 超时/异常 (${duration}ms) | ${err.message}`);
      results.push({
        platform: item.platform,
        category: item.category,
        url: item.url,
        success: false,
        durationMs: duration,
        error: err.message,
      });
    }
  }

  // Summary Report
  const total = results.length;
  const successCount = results.filter(r => r.success).length;
  const failCount = total - successCount;
  const avgDuration = Math.round(results.reduce((acc, cur) => acc + cur.durationMs, 0) / total);
  const successRate = ((successCount / total) * 100).toFixed(1);

  console.log(`\n============================ 📊 评测汇总报告 ============================`);
  console.log(`平台总数: ${total}`);
  console.log(`提取与排版成功: ${successCount} 个 ✅`);
  console.log(`需要适配/异常: ${failCount} 个 ⚠️`);
  console.log(`综合成功率: ${successRate}%`);
  console.log(`平均响应耗时: ${avgDuration}ms`);
  console.log(`========================================================================\n`);

  // Detailed Table
  console.log('| 平台分类 | 平台名称 | 结果 | 耗时(ms) | 字数 | 图片 | 标题排版层级 | 作者 | 发布时间 | 标题 / 错误信息 |');
  console.log('| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |');
  for (const r of results) {
    const status = r.success ? '✅ 成功' : '❌ 失败';
    const info = r.success ? (r.title || '').replace(/\|/g, '') : `⚠️ ${r.error || '失败'}`;
    const author = (r.author || '无').replace(/\|/g, '').slice(0, 10);
    const pubDate = (r.publishTime || '无').slice(0, 10);
    console.log(`| ${r.category} | ${r.platform} | ${status} | ${r.durationMs} | ${r.wordCount || 0} | ${r.imageCount || 0} | ${r.markdownHeaders || 0} 级 | ${author} | ${pubDate} | ${info.slice(0, 24)} |`);
  }
}

runPlatformBenchmark();
