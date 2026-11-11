import * as cheerio from 'cheerio';
import got from 'got';
import { BaseExtractor } from './base.js';
import { hostMatches, parseUrl } from '../utils/url-match.js';
import { RawExtractedArticle } from '../types/index.js';
import { config } from '../config.js';

export class ToutiaoExtractor extends BaseExtractor {
  name = 'toutiao';
  /** Fetches its own content from a platform API; the route skips the page fetch. */
  selfFetch = true;

  canHandle(url: string): boolean {
    const u = parseUrl(url);
    if (!hostMatches(u, 'toutiao.com')) return false;
    return u!.pathname.startsWith('/article/') ||
           /^\/i\d/.test(u!.pathname) ||
           hostMatches(u, 'm.toutiao.com');
  }

  async extract(url: string, _initialHtml: string): Promise<RawExtractedArticle> {
    const idMatch = url.match(/(?:article\/|i)(\d+)/);
    const articleId = idMatch ? idMatch[1] : '';

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

    const title = $('h1').first().text().trim() ||
                  $('title').text().replace('- 今日头条', '').trim() ||
                  this.getMetaContent($, 'og:title') ||
                  '未命名头条文章';

    const author = $('.name').first().text().trim() ||
                   $('.author-name').first().text().trim() ||
                   $('.user-name').first().text().trim() ||
                   this.getMetaContent($, 'author') ||
                   '今日头条';

    let publishTime = $('.time, span.time, .article-time, .publish-time').first().text().trim() ||
                      this.getMetaContent($, 'article:published_time');
    if (!publishTime) {
      const timeMatch = html.match(/202\d-[01]\d-[0-3]\d(\s+[0-2]\d:[0-5]\d)?/);
      if (timeMatch) publishTime = timeMatch[0];
    }

    const coverImage = this.getMetaContent($, 'og:image');

    const contentDom = $('article').first();

    contentDom.find('.app-install-block, .open-app-block, .feedback-block').remove();
    this.removeNoiseElements($, contentDom);

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
      platform: '今日头条',
    };
  }
}
