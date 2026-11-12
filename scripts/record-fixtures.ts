/**
 * Record platform fixtures for offline regression tests, and write a pass-rate report.
 *
 *   npm run fixtures:record                 # all platforms in test/platforms.json
 *   npm run fixtures:record -- wechat zhihu # only these ids
 *
 * Needs real network access. For every platform it runs the full extraction pipeline
 * in-process, records every HTTP response, and — when the extraction is good — saves
 * test/fixtures/<id>.json. Failed platforms are reported but no fixture is written,
 * so a temporary block never overwrites a known-good fixture.
 *
 * Also writes test/reports/platform-report.md (the source of truth for the pass rate
 * quoted in the README).
 */
import fs from 'node:fs';
import path from 'node:path';
import { useCassette, ejectCassette } from '../src/utils/http.js';
import { executeExtraction, errorToResponse } from '../src/services/extract-service.js';
import { snapshotOf, isGoodExtraction } from '../src/utils/snapshot.js';
import { errorMessage } from '../src/utils/logger.js';
import type { ApiResponse, ExtractedArticle } from '../src/types/index.js';
import type { PlatformFixture, PlatformItem } from '../test/fixture-types.js';

const root = process.cwd();
const platforms = JSON.parse(fs.readFileSync(path.join(root, 'test/platforms.json'), 'utf-8')) as PlatformItem[];
const onlyIds = process.argv.slice(2);
const selected = onlyIds.length ? platforms.filter(p => onlyIds.includes(p.id)) : platforms;

const fixturesDir = path.join(root, 'test/fixtures');
const reportsDir = path.join(root, 'test/reports');
fs.mkdirSync(fixturesDir, { recursive: true });
fs.mkdirSync(reportsDir, { recursive: true });

interface Row {
  item: PlatformItem;
  ok: boolean;
  ms: number;
  detail: string;
}

async function main() {
  const rows: Row[] = [];

  for (const [i, item] of selected.entries()) {
    process.stdout.write(`[${i + 1}/${selected.length}] ${item.platform} ... `);
    const start = Date.now();
    useCassette('record');
    let result: ApiResponse<ExtractedArticle | null>;
    try {
      result = await executeExtraction({ url: item.url, format: 'both', upload_images: false });
    } catch (err) {
      result = errorToResponse(err);
    }
    const requests = ejectCassette();
    const ms = Date.now() - start;

    const good = result.data ? isGoodExtraction(result as ApiResponse<ExtractedArticle>) : false;
    if (good) {
      const fixture: PlatformFixture = {
        id: item.id,
        platform: item.platform,
        url: item.url,
        recorded_at: new Date().toISOString(),
        requests,
        expected: snapshotOf(result as ApiResponse<ExtractedArticle>),
      };
      fs.writeFileSync(path.join(fixturesDir, `${item.id}.json`), JSON.stringify(fixture, null, 2) + '\n');
      const d = result.data!;
      console.log(`✅ ${ms}ms  ${d.word_count} 字 / ${d.images.length} 图  "${d.title.slice(0, 20)}"`);
      rows.push({ item, ok: true, ms, detail: d.title });
    } else {
      const detail = result.code === 200 ? `内容不足（${result.data?.word_count ?? 0} 字）` : `${result.code} ${result.message}`;
      console.log(`❌ ${ms}ms  ${detail}`);
      rows.push({ item, ok: false, ms, detail });
    }
  }

  // Report
  const okCount = rows.filter(r => r.ok).length;
  const rate = rows.length ? ((okCount / rows.length) * 100).toFixed(1) : '0.0';
  const lines = [
    '# 平台实测报告',
    '',
    `- 生成时间：${new Date().toISOString()}`,
    `- 通过：**${okCount} / ${rows.length}（${rate}%）**`,
    '- 判定标准：HTTP 200、标题非"未命名文章"、正文 > 30 字、Markdown > 50 字符',
    '- 生成方式：`npm run fixtures:record`（真实网络，结果受平台反爬与改版影响）',
    '',
    '| 分类 | 平台 | 结果 | 耗时(ms) | 标题 / 失败原因 |',
    '| :--- | :--- | :---: | ---: | :--- |',
    ...rows.map(r => `| ${r.item.category} | ${r.item.platform} | ${r.ok ? '✅' : '❌'} | ${r.ms} | ${r.detail.replace(/\|/g, '/').slice(0, 40)} |`),
    '',
  ];
  if (!onlyIds.length) {
    fs.writeFileSync(path.join(reportsDir, 'platform-report.md'), lines.join('\n'));
    console.log(`\n📄 Report written to test/reports/platform-report.md`);
  }
  console.log(`\n通过 ${okCount}/${rows.length}（${rate}%）`);
}

main().catch(err => {
  console.error(errorMessage(err));
  process.exit(1);
});
