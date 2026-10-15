import * as cheerio from 'cheerio';
import { BaseExtractor } from './base.js';
import { RawExtractedArticle } from '../types/index.js';

export class JuejinExtractor extends BaseExtractor {
  name = 'juejin';

  canHandle(url: string): boolean {
    return url.includes('juejin.cn/post/');
  }

  async extract(url: string, html: string): Promise<RawExtractedArticle> {
    const $ = cheerio.load(html);

    const title = $('.article-title').first().text().trim() ||
                  $('h1').first().text().trim() ||
                  this.getMetaContent($, 'og:title') ||
                  '未命名掘金文章';

    const author = $('.author-name .name').first().text().trim() ||
                   this.getMetaContent($, 'author') ||
                   '';

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
      cover_image: coverImage,
      content_html: contentHtml,
      platform: 'Juejin',
    };
  }
}
