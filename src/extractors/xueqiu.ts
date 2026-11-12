import * as cheerio from 'cheerio';
import { BaseExtractor } from './base.js';
import { hostMatches } from '../utils/url-match.js';
import { RawExtractedArticle } from '../types/index.js';

export class XueqiuExtractor extends BaseExtractor {
  name = 'xueqiu';

  canHandle(url: string): boolean {
    return hostMatches(url, 'xueqiu.com');
  }

  async extract(url: string, html: string): Promise<RawExtractedArticle> {
    const $ = cheerio.load(html);

    // Precise Title without SEO spam
    let title = $('.article__title, .status-title, h1').first().text().trim();
    if (!title) {
      title = $('title').text().trim();
      title = title.replace(/\s*-\s*雪球.*$/, '').trim();
      // Cut off if title was stuffed with full paragraph
      if (title.length > 80 && title.includes(' ')) {
        title = title.split(' ')[0];
      }
    }

    // Precise Author
    let author = $('.avatar').first().attr('data-screenname') ||
                 $('.avatar__name a.name').first().text().trim() ||
                 $('.user-name').first().text().trim();
    author = author.replace(/[\(\)（）]/g, '').trim();

    // Publish Time
    let publishTime = '';
    const dateText = $('.article__date, .time').first().text().trim();
    const timeMatch = dateText.match(/202\d-[01]\d-[0-3]\d(\s+[0-2]\d:[0-5]\d)?/);
    if (timeMatch) {
      publishTime = timeMatch[0];
    }

    // Cover image
    const coverImage = this.getMetaContent($, 'og:image');

    // Content
    let $content = $('.article__bd__detail, .entry, .status-content').first();
    if ($content.length === 0) {
      $content = $('article, main').first();
    }

    // Clean Xueqiu noise
    this.removeNoiseElements($, $content);
    $content.find('.operation, .reward, .donate, .status-footer').remove();

    return {
      title: title || '雪球专栏文章',
      author,
      publish_time: publishTime,
      cover_image: coverImage,
      content_html: $content.html() || '',
    };
  }
}
