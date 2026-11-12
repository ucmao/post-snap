import { IExtractor, NormalizedArticle } from '../types/index.js';
import { platformName } from '../utils/platform.js';
import { normalizePublishTime } from '../utils/time.js';
import { WechatExtractor } from './wechat.js';
import { ZhihuExtractor } from './zhihu.js';
import { JuejinExtractor } from './juejin.js';
import { CSDNExtractor } from './csdn.js';
import { ToutiaoExtractor } from './toutiao.js';
import { Kr36Extractor } from './36kr.js';
import { DoubanExtractor } from './douban.js';
import { InfoQExtractor } from './infoq.js';
import { OSChinaExtractor } from './oschina.js';
import { TiebaExtractor } from './tieba.js';
import { HnrExtractor } from './hnr.js';
import { SohuExtractor } from './sohu.js';
import { WeiboExtractor } from './weibo.js';
import { XueqiuExtractor } from './xueqiu.js';
import { XiaohongshuExtractor } from './xiaohongshu.js';
import { LofterExtractor } from './lofter.js';
import { GeneralExtractor } from './general.js';

const specializedExtractors: IExtractor[] = [
  new WechatExtractor(),
  new ZhihuExtractor(),
  new XiaohongshuExtractor(),
  new LofterExtractor(),
  new JuejinExtractor(),
  new CSDNExtractor(),
  new ToutiaoExtractor(),
  new Kr36Extractor(),
  new DoubanExtractor(),
  new InfoQExtractor(),
  new OSChinaExtractor(),
  new TiebaExtractor(),
  new HnrExtractor(),
  new SohuExtractor(),
  new WeiboExtractor(),
  new XueqiuExtractor(),
];

const generalExtractor = new GeneralExtractor();

/**
 * Dispatch article extraction to the most specialized extractor available,
 * falling back gracefully to the general Readability extractor.
 */
export function resolveExtractor(url: string): IExtractor {
  return specializedExtractors.find(ext => ext.canHandle(url)) || generalExtractor;
}

/**
 * Run an extractor and normalize its output:
 *  - `platform_id` (stable id) + `platform` (display name) from the central registry
 *  - `publish_time` converted to ISO 8601, original kept in `publish_time_raw`
 */
export async function runExtractor(extractor: IExtractor, url: string, html: string): Promise<NormalizedArticle> {
  const raw = await extractor.extract(url, html);
  const platformId = raw.platform_id ?? extractor.name;
  const rawTime = raw.publish_time;

  return {
    title: raw.title,
    author: raw.author,
    cover_image: raw.cover_image,
    content_html: raw.content_html,
    platform_id: platformId,
    platform: platformName(platformId),
    publish_time: normalizePublishTime(rawTime),
    publish_time_raw: rawTime === undefined || rawTime === '' ? undefined : String(rawTime),
  };
}

export async function dispatchExtract(url: string, html: string): Promise<NormalizedArticle> {
  return runExtractor(resolveExtractor(url), url, html);
}
