import { gotScraping } from 'got-scraping';
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

    if (!noteId) {
      return {
        title: '豆瓣日记',
        content_html: '',
        platform: '豆瓣日记',
      };
    }

    try {
      const apiUrl = `https://m.douban.com/rexxar/api/v2/note/${noteId}`;
      const res: any = await gotScraping(apiUrl, {
        headers: {
          'Referer': `https://m.douban.com/note/${noteId}/`,
        },
        timeout: { request: config.requestTimeout },
      }).json();

      if (res && res.title) {
        const title = res.title;
        const author = res.author?.name || '豆瓣用户';
        const coverImage = res.cover_url || res.photos?.[0]?.image?.normal?.url;
        const contentHtml = res.content || '';
        const publishTime = res.create_time || res.pub_date || res.update_time;

        return {
          title,
          author,
          publish_time: publishTime,
          cover_image: coverImage,
          content_html: contentHtml,
          platform: '豆瓣日记',
        };
      }
    } catch (e: any) {
      console.warn(`[DoubanExtractor] Rexxar API failed: ${e.message}`);
    }

    return {
      title: '豆瓣日记',
      content_html: '',
      platform: '豆瓣日记',
    };
  }
}
