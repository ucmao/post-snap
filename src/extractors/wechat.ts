import * as cheerio from 'cheerio';
import { BaseExtractor } from './base.js';
import { RawExtractedArticle } from '../types/index.js';

export class WechatExtractor extends BaseExtractor {
  name = 'wechat';

  canHandle(url: string): boolean {
    return url.includes('mp.weixin.qq.com');
  }

  async extract(url: string, html: string): Promise<RawExtractedArticle> {
    const $ = cheerio.load(html);

    // 1. Title
    const title = $('#activity-name').text().trim() ||
                  this.getMetaContent($, 'og:title') ||
                  $('title').text().replace('- 微信公众平台', '').trim() ||
                  '未命名微信文章';

    // 2. Author / Account Name
    const author = $('#js_name').text().trim() ||
                   $('.profile_nickname').text().trim() ||
                   this.getMetaContent($, 'author') ||
                   '';

    // 3. Publish Time (often embedded in JS variable var ct = "...")
    let publishTime: string | undefined;
    const ctMatch = html.match(/var\s+ct\s*=\s*["']?(\d+)["']?/);
    if (ctMatch && ctMatch[1]) {
      const timestamp = parseInt(ctMatch[1], 10) * 1000;
      if (!isNaN(timestamp)) {
        publishTime = new Date(timestamp).toISOString();
      }
    }
    if (!publishTime) {
      publishTime = $('#publish_time').text().trim() || undefined;
    }

    // 4. Cover Image
    const coverImage = this.getMetaContent($, 'og:image') ||
                       this.getMetaContent($, 'twitter:image');

    // 5. Content Container
    const contentDom = $('#js_content');

    // Remove noise specific to WeChat articles
    contentDom.find('#js_tags, .reward_area, .qr_code_pc, #js_pc_qr_code').remove();
    this.removeNoiseElements($, contentDom);

    // CRITICAL: Fix WeChat lazy-loaded images (data-src -> src)
    contentDom.find('img').each((_, el) => {
      const $img = $(el);
      const realSrc = $img.attr('data-src') || $img.attr('src');
      if (realSrc) {
        $img.attr('src', realSrc);
        $img.removeAttr('data-src');
        $img.removeAttr('data-cropselx1');
        $img.removeAttr('data-cropselx2');
        $img.removeAttr('data-cropsely1');
        $img.removeAttr('data-cropsely2');
        $img.removeAttr('data-ratio');
        $img.removeAttr('data-w');
      }
    });

    const contentHtml = contentDom.html() || '';

    return {
      title,
      author,
      publish_time: publishTime,
      cover_image: coverImage,
      content_html: contentHtml,
      platform: 'WeChat Official Account',
    };
  }
}
