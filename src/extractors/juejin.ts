import * as cheerio from 'cheerio';
import { BaseExtractor } from './base.js';
import { hostMatches, parseUrl } from '../utils/url-match.js';
import { RawExtractedArticle } from '../types/index.js';

export class JuejinExtractor extends BaseExtractor {
  name = 'juejin';

  canHandle(url: string): boolean {
    const u = parseUrl(url);
    return hostMatches(u, 'juejin.cn') && u!.pathname.startsWith('/post/');
  }

  async extract(url: string, html: string): Promise<RawExtractedArticle> {
    const $ = cheerio.load(html);

    const title = $('.article-title').first().text().trim() ||
                  $('h1').first().text().trim() ||
                  this.getMetaContent($, 'og:title') ||
                  '未命名掘金文章';

    const author = $('.author-name .name').first().text().trim() ||
                   this.getMetaContent($, 'author') ||
                   '掘金创作者';

    let publishTime = $('time.time').first().text().trim() ||
                      $('time').first().attr('datetime') ||
                      this.getMetaContent($, 'article:published_time');
    if (!publishTime) {
      const timeMatch = html.match(/"datePublished":\s*"([^"]+)"/);
      if (timeMatch) publishTime = timeMatch[1];
    }

    const coverImage = this.getMetaContent($, 'og:image');

    const contentDom = $('.markdown-body').first().length > 0
      ? $('.markdown-body').first()
      : $('.article-viewer').first();

    this.removeNoiseElements($, contentDom);

    // Fix Juejin lazy-loaded images (data-src -> src)
    contentDom.find('img').each((_, el) => {
      const $img = $(el);
      const realSrc = $img.attr('data-src') || $img.attr('src');
      if (realSrc) {
        $img.attr('src', realSrc);
        $img.removeAttr('data-src');
      }
    });

    const contentHtml = contentDom.html() || '';

    return {
      title,
      author,
      publish_time: publishTime,
      cover_image: coverImage,
      content_html: contentHtml,
      platform: '稀土掘金',
    };
  }
}
