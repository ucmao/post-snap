import * as cheerio from 'cheerio';
import { BaseExtractor } from './base.js';
import { hostMatches } from '../utils/url-match.js';
import { RawExtractedArticle } from '../types/index.js';

export class WechatExtractor extends BaseExtractor {
  name = 'wechat';

  canHandle(url: string): boolean {
    return hostMatches(url, 'mp.weixin.qq.com');
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
      let realSrc = $img.attr('data-src') || $img.attr('src');
      if (realSrc) {
        // Upgrade image resolution from /640? or /300? to lossless master /0?
        if (realSrc.includes('qpic.cn')) {
          realSrc = realSrc.replace(/\/(?:640|300|0)\?/, '/0?');
        }
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

    let contentHtml = contentDom.html() || '';

    // 6. Support WeChat Photo / Gallery messages (小绿书/多图轮播形态)
    if (!contentHtml || contentHtml.trim().length === 0) {
      // Check if it's a picture message (picture_page_info_list / cgiDataNew)
      const picRegex = /cdn_url:\s*[\x27\x22](https?:\/\/mmbiz\.qpic\.cn\/[^\x27\x22]+)[\x27\x22]/g;
      const galleryImages: string[] = [];
      let m;
      while ((m = picRegex.exec(html)) !== null) {
        let rawUrl = m[1];
        if (rawUrl.includes('qpic.cn')) {
          rawUrl = rawUrl.replace(/\/(?:640|300|0)\?/, '/0?');
        }
        if (!galleryImages.includes(rawUrl)) {
          galleryImages.push(rawUrl);
        }
      }

      // Check author / desc from cgiDataNew
      const nickMatch = html.match(/nick_name:\s*[\x27\x22]([^\x27\x22]+)[\x27\x22]/);
      const finalAuthor = author || (nickMatch ? nickMatch[1] : '');
      const descMatch = html.match(/desc:\s*[\x27\x22]([^\x27\x22]*)[\x27\x22]/);
      const desc = descMatch ? descMatch[1] : '';

      if (galleryImages.length > 0) {
        // Construct rich-text HTML for gallery post
        const parts: string[] = [];
        if (title && title !== '未命名微信文章') {
          parts.push(`<h2>${title}</h2>`);
        }
        if (desc) {
          parts.push(`<p>${desc}</p>`);
        }
        for (const imgUrl of galleryImages) {
          parts.push(`<p><img src="${imgUrl}" referrerpolicy="no-referrer" /></p>`);
        }
        contentHtml = parts.join('\n');

        return {
          title,
          author: finalAuthor,
          publish_time: publishTime,
          cover_image: coverImage || galleryImages[0],
          content_html: contentHtml,
        };
      }
    }

    return {
      title,
      author,
      publish_time: publishTime,
      cover_image: coverImage,
      content_html: contentHtml,
    };
  }
}
