import { gotScraping } from 'got-scraping';
import * as cheerio from 'cheerio';
import { BaseExtractor } from './base.js';
import { RawExtractedArticle } from '../types/index.js';
import { config } from '../config.js';

export class DoubanExtractor extends BaseExtractor {
  name = 'douban';

  canHandle(url: string): boolean {
    return url.includes('douban.com/note/');
  }

  async extract(url: string, _initialHtml: string): Promise<RawExtractedArticle> {
    const idMatch = url.match(/douban\.com\/note\/(\d+)/);
    const noteId = idMatch ? idMatch[1] : '';

    // Douban PC mandates login for note readers.
    // Douban mobile endpoint (m.douban.com/note/:id/) bypasses PC login wall!
    const targetUrl = noteId
      ? `https://m.douban.com/note/${noteId}/`
      : url;

    const res = await gotScraping({
      url: targetUrl,
      headerGeneratorOptions: {
        devices: ['mobile'],
        browsers: [{ name: 'safari' }],
      },
      timeout: { request: config.requestTimeout },
    });

    const $ = cheerio.load(res.body);

    const title = $('h1').first().text().trim() ||
                  $('title').text().replace('- 日记', '').replace('- 豆瓣', '').trim() ||
                  '未命名豆瓣日记';

    const author = $('.note-author').text().trim() ||
                   $('.author-name').text().trim() ||
                   '';

    const contentDom = $('.note-content').length > 0
      ? $('.note-content').first()
      : $('.content').first();

    this.removeNoiseElements($, contentDom);

    // Normalize lazy loaded images
    contentDom.find('img').each((_, el) => {
      const $img = $(el);
      const realSrc = $img.attr('data-src') || $img.attr('data-original') || $img.attr('src');
      if (realSrc) {
        $img.attr('src', realSrc);
        $img.removeAttr('data-src');
        $img.removeAttr('data-original');
      }
    });

    return {
      title,
      author,
      content_html: contentDom.html() || '',
      platform: '豆瓣日记',
    };
  }
}
