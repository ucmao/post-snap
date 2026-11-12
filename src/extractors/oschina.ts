import { httpText } from '../utils/http.js';
import { logger, errorMessage } from '../utils/logger.js';
import * as cheerio from 'cheerio';
import { BaseExtractor } from './base.js';
import { hostMatches } from '../utils/url-match.js';
import { RawExtractedArticle } from '../types/index.js';

export class OSChinaExtractor extends BaseExtractor {
  name = 'oschina';
  /** Fetches its own content from a platform API; the route skips the page fetch. */
  selfFetch = true;

  canHandle(url: string): boolean {
    return hostMatches(url, 'oschina.net');
  }

  async extract(url: string, _initialHtml: string): Promise<RawExtractedArticle> {
    const newsMatch = url.match(/\/news\/(\d+)/);
    const blogMatch = url.match(/\/blog\/(\d+)/);

    // 1. Try OSChina News API if it matches news pattern
    if (newsMatch) {
      const newsId = newsMatch[1];
      try {
        const apiUrl = `https://www.oschina.net/action/api/news_detail?id=${newsId}`;
        const body = await httpText({ url: apiUrl });
        const $ = cheerio.load(body, { xmlMode: true });
        const title = $('news title').text().trim();
        const author = $('news author').text().trim() || '开源中国';
        const publishTime = $('news pubDate').text().trim();
        const contentHtml = $('news body').text().trim();
        if (title && contentHtml) {
          return {
            title,
            author,
            publish_time: publishTime,
            content_html: contentHtml,
          };
        }
      } catch (e) {
        logger.warn({ extractor: 'oschina', url }, `API request failed: ${errorMessage(e)}`);
      }
    }

    // 2. Try OSChina Blog API if it matches blog pattern
    if (blogMatch) {
      const blogId = blogMatch[1];
      try {
        const apiUrl = `https://www.oschina.net/action/api/blog_detail?id=${blogId}`;
        const body = await httpText({ url: apiUrl });
        const $ = cheerio.load(body, { xmlMode: true });
        const title = $('blog title').text().trim();
        const author = $('blog author').text().trim() || '开源中国博主';
        const publishTime = $('blog pubDate').text().trim();
        const contentHtml = $('blog body').text().trim();
        if (title && contentHtml) {
          return {
            title,
            author,
            publish_time: publishTime,
            content_html: contentHtml,
          };
        }
      } catch (e) {
        logger.warn({ extractor: 'oschina', url }, `API request failed: ${errorMessage(e)}`);
      }
    }

    return {
      title: '开源中国文章',
      content_html: '',
    };
  }
}
