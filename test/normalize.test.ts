import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePublishTime, formatCnDateTime } from '../src/utils/time.js';
import { detectGeneralPlatform, platformName, PLATFORMS } from '../src/utils/platform.js';

// Fixed "now": 2026-11-12 08:00 Beijing time
const NOW = new Date('2026-11-12T00:00:00.000Z');

describe('normalizePublishTime', () => {
  const cases: Array<[unknown, string | undefined]> = [
    // timestamps
    [1690000000, '2023-07-22T04:26:40.000Z'],
    [1690000000000, '2023-07-22T04:26:40.000Z'],
    ['1690000000', '2023-07-22T04:26:40.000Z'],
    // explicit timezone
    ['2026-10-14T18:50:15.000Z', '2026-10-14T18:50:15.000Z'],
    ['2026-10-14T18:50:15+08:00', '2026-10-14T10:50:15.000Z'],
    ['Wed, 14 Oct 2026 10:50:15 +0800', '2026-10-14T02:50:15.000Z'],
    ['Wed, 14 Oct 2026 10:50:15 GMT', '2026-10-14T10:50:15.000Z'],
    // wall clock without timezone => Beijing time
    ['2026-10-14 18:50', '2026-10-14T10:50:00.000Z'],
    ['2026-10-14 18:50:15', '2026-10-14T10:50:15.000Z'],
    ['2026/10/14 18:50', '2026-10-14T10:50:00.000Z'],
    ['2026.10.14', '2026-10-13T16:00:00.000Z'],
    ['2026年10月14日 18:50', '2026-10-14T10:50:00.000Z'],
    ['2026年10月14日', '2026-10-13T16:00:00.000Z'],
    ['2026-10-14T18:50:15', '2026-10-14T10:50:15.000Z'],
    // year-less
    ['10-14 18:50', '2026-10-14T10:50:00.000Z'],
    ['10月14日', '2026-10-13T16:00:00.000Z'],
    ['12-20', '2025-12-19T16:00:00.000Z'],
    // relative
    ['5分钟前', '2026-11-11T23:55:00.000Z'],
    ['3小时前', '2026-11-11T21:00:00.000Z'],
    ['2天前', '2026-11-10T00:00:00.000Z'],
    ['昨天 12:30', '2026-11-11T04:30:00.000Z'],
    ['今天 07:00', '2026-11-11T23:00:00.000Z'],
    // garbage
    ['', undefined],
    [null, undefined],
    ['不知道什么时候', undefined],
    ['2026-13-40', undefined],
    [0, undefined],
  ];

  for (const [input, expected] of cases) {
    it(`${JSON.stringify(input)} -> ${expected}`, () => {
      assert.equal(normalizePublishTime(input, NOW), expected);
    });
  }

  it('formats ISO as Beijing time for display', () => {
    assert.equal(formatCnDateTime('2026-10-14T10:50:15.000Z'), '2026-10-14 18:50');
    assert.equal(formatCnDateTime(undefined), undefined);
  });
});

describe('platform registry', () => {
  it('detects general-extractor platforms by hostname', () => {
    assert.equal(detectGeneralPlatform('https://www.cnblogs.com/a/p/1.html'), 'cnblogs');
    assert.equal(detectGeneralPlatform('https://money.163.com/26/1014/x.html'), 'netease_money');
    assert.equal(detectGeneralPlatform('https://www.163.com/dy/article/x.html'), 'netease');
    assert.equal(detectGeneralPlatform('https://new.qq.com/rain/a/x'), 'qq_news');
    assert.equal(detectGeneralPlatform('https://evil.com/?u=cnblogs.com'), 'web');
    assert.equal(detectGeneralPlatform('https://myblog.dev/post'), 'web');
  });

  it('every id has a display name and ids are lowercase slugs', () => {
    for (const [id, name] of Object.entries(PLATFORMS)) {
      assert.match(id, /^[a-z0-9_]+$/);
      assert.ok(name.length > 0);
    }
    assert.equal(platformName('unknown_id'), '网页文章');
  });
});
