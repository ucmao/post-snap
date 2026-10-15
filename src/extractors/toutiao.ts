import * as cheerio from 'cheerio';
import got from 'got';
import { BaseExtractor } from './base.js';
import { RawExtractedArticle } from '../types/index.js';
import { config } from '../config.js';

export class ToutiaoExtractor extends BaseExtractor {
  name = 'toutiao';

  canHandle(url: string): boolean {
    return url.includes('toutiao.com/article/') ||
           url.includes('toutiao.com/i') ||
           url.includes('m.toutiao.com');
  }

  async extract(url: string, _initialHtml: string): Promise<RawExtractedArticle> {
    // 1. Extract Article ID from URL
    const idMatch = url.match(/(?:article\/|i)(\d+)/);
    const articleId = idMatch ? idMatch[1] : '';

    // 2. Toutiao PC version enforces heavy JS-VM obfuscation without rendering SSR DOM.
    // However, Toutiao's mobile endpoint (m.toutiao.com/article/:id) serves complete SSR HTML!
    const targetUrl = articleId
      ? `https://m.toutiao.com/article/${articleId}/`
      : url;

    const response = await got(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
      timeout: { request: config.requestTimeout },
      followRedirect: true,
    });

    const html = response.body;
    const $ = cheerio.load(html);

    // 3. Extract Metadata
    const title = $('h1').first().text().trim() ||
                  $('title').text().replace('- 今日头条', '').trim() ||
                  this.getMetaContent($, 'og:title') ||
                  '未命名头条文章';

    const author = $('.name').first().text().trim() ||
                   $('.author-name').first().text().trim() ||
                   $('.user-name').first().text().trim() ||
                   this.getMetaContent($, 'author') ||
                   '';

    const coverImage = this.getMetaContent($, 'og:image');

    // 4. Extract Article Content
    const contentDom = $('article').first();

    // Remove noise elements
    contentDom.find('.app-install-block, .open-app-block, .feedback-block').remove();
    this.removeNoiseElements($, contentDom);

    // Normalize Toutiao images
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
      platform: 'Toutiao (今日头条)',
    };
  }
}
