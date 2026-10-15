import { IExtractor, RawExtractedArticle } from '../types/index.js';
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
export async function dispatchExtract(url: string, html: string): Promise<RawExtractedArticle> {
  const matchedExtractor = specializedExtractors.find(ext => ext.canHandle(url)) || generalExtractor;
  return matchedExtractor.extract(url, html);
}
