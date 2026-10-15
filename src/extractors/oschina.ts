import { gotScraping } from 'got-scraping';
import * as cheerio from 'cheerio';
import { BaseExtractor } from './base.js';
import { RawExtractedArticle } from '../types/index.js';
import { config } from '../config.js';

export class OSChinaExtractor extends BaseExtractor {
  name = 'oschina';

  canHandle(url: string): boolean {
    return url.includes('oschina.net');
  }

  async extract(url: string, _initialHtml: string): Promise<RawExtractedArticle> {
    const newsMatch = url.match(/\/news\/(\d+)/);
    const blogMatch = url.match(/\/blog\/(\d+)/);

    // 1. Try OSChina News API if it matches news pattern
    if (newsMatch) {
      const newsId = newsMatch[1];
      try {
        const apiUrl = `https://www.oschina.net/action/api/news_detail?id=${newsId}`;
        const res = await gotScraping(apiUrl, { timeout: { request: config.requestTimeout } });
        const $ = cheerio.load(res.body, { xmlMode: true });
        const title = $('news title').text().trim();
        const contentHtml = $('news body').text().trim();
        if (title && contentHtml) {
          return {
            title,
            content_html: contentHtml,
            platform: '开源中国 (OSChina)',
          };
        }
      } catch {}
    }

    // 2. Try OSChina Blog API if it matches blog pattern
    if (blogMatch) {
      const blogId = blogMatch[1];
      try {
        const apiUrl = `https://www.oschina.net/action/api/blog_detail?id=${blogId}`;
        const res = await gotScraping(apiUrl, { timeout: { request: config.requestTimeout } });
        const $ = cheerio.load(res.body, { xmlMode: true });
        const title = $('blog title').text().trim();
        const author = $('blog author').text().trim();
        const contentHtml = $('blog body').text().trim();
        if (title && contentHtml) {
          return {
            title,
            author,
            content_html: contentHtml,
            platform: '开源中国 (OSChina)',
          };
        }
      } catch {}
    }

    return {
      title: '开源中国文章',
      content_html: '',
      platform: '开源中国 (OSChina)',
    };
  }
}
