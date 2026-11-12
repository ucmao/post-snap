import { hostMatches } from './url-match.js';

/**
 * Stable platform identifiers (`platform_id`) and their display names (`platform`).
 * `platform_id` is part of the API contract: callers may branch on it, so never rename an id.
 */
export const PLATFORMS = {
  // Specialized extractors (id === extractor.name)
  wechat: '微信公众号',
  zhihu: '知乎',
  xiaohongshu: '小红书',
  lofter: '网易LOFTER',
  juejin: '稀土掘金',
  csdn: 'CSDN',
  toutiao: '今日头条',
  '36kr': '36氪',
  douban: '豆瓣',
  infoq: 'InfoQ',
  oschina: '开源中国',
  tieba: '百度贴吧',
  hnr: '大象新闻',
  sohu: '搜狐号',
  weibo: '微博头条文章',
  xueqiu: '雪球',

  // Recognized by the general (Readability) extractor
  eastmoney: '东方财富网',
  netease_money: '网易财经',
  netease: '网易号',
  zhibo8: '直播吧',
  cyzone: '创业邦',
  qianzhan: '前瞻经济学人',
  zaker: 'ZAKER',
  thepaper: '澎湃新闻',
  sina: '新浪',
  china_com: '中华网',
  cnblogs: '博客园',
  segmentfault: 'SegmentFault 思否',
  sspai: '少数派',
  ithome: 'IT之家',
  baijiahao: '百度百家号',
  qq_news: '腾讯新闻',
  huxiu: '虎嗅网',
  github_blog: 'GitHub Blog',

  // Fallback for any other site
  web: '网页文章',
} as const;

export type PlatformId = keyof typeof PLATFORMS;

export function platformName(id: string): string {
  return (PLATFORMS as Record<string, string>)[id] ?? PLATFORMS.web;
}

/** Ordered rules: more specific hosts/paths first. */
const GENERAL_RULES: Array<{ id: PlatformId; match: (u: URL) => boolean }> = [
  { id: 'eastmoney', match: u => hostMatches(u, 'eastmoney.com') },
  { id: 'netease_money', match: u => hostMatches(u, '163.com') && (u.hostname.startsWith('money.') || u.pathname.startsWith('/money')) },
  { id: 'netease', match: u => hostMatches(u, '163.com') },
  { id: 'zhibo8', match: u => hostMatches(u, 'zhibo8.com', 'zhibo8.cc') },
  { id: 'cyzone', match: u => hostMatches(u, 'cyzone.cn') },
  { id: 'qianzhan', match: u => hostMatches(u, 'qianzhan.com') },
  { id: 'zaker', match: u => hostMatches(u, 'myzaker.com') },
  { id: 'thepaper', match: u => hostMatches(u, 'thepaper.cn') },
  { id: 'sina', match: u => hostMatches(u, 'sina.com.cn', 'sina.cn') },
  { id: 'china_com', match: u => hostMatches(u, 'china.com') },
  { id: 'cnblogs', match: u => hostMatches(u, 'cnblogs.com') },
  { id: 'segmentfault', match: u => hostMatches(u, 'segmentfault.com') },
  { id: 'sspai', match: u => hostMatches(u, 'sspai.com') },
  { id: 'ithome', match: u => hostMatches(u, 'ithome.com') },
  { id: 'baijiahao', match: u => hostMatches(u, 'baijiahao.baidu.com') },
  { id: 'qq_news', match: u => hostMatches(u, 'qq.com') },
  { id: 'huxiu', match: u => hostMatches(u, 'huxiu.com') },
  { id: 'github_blog', match: u => hostMatches(u, 'github.blog') },
];

/** Detect platform for URLs handled by the general extractor. */
export function detectGeneralPlatform(url: string): PlatformId {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return 'web';
  }
  return GENERAL_RULES.find(r => r.match(parsed))?.id ?? 'web';
}
