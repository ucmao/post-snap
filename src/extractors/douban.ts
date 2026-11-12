import { httpJson } from '../utils/http.js';
import { logger, errorMessage } from '../utils/logger.js';
import { BaseExtractor } from './base.js';
import { hostMatches, parseUrl } from '../utils/url-match.js';
import { RawExtractedArticle } from '../types/index.js';

interface DoubanNote {
  title?: string;
  author?: { name?: string };
  cover_url?: string;
  photos?: Array<{ image?: { normal?: { url?: string } } }>;
  content?: string;
  create_time?: string;
  pub_date?: string;
  update_time?: string;
}

export class DoubanExtractor extends BaseExtractor {
  name = 'douban';
  /** Fetches its own content from a platform API; the route skips the page fetch. */
  selfFetch = true;

  canHandle(url: string): boolean {
    const u = parseUrl(url);
    return hostMatches(u, 'douban.com') && u!.pathname.startsWith('/note/');
  }

  async extract(url: string, _initialHtml: string): Promise<RawExtractedArticle> {
    const idMatch = url.match(/douban\.com\/note\/(\d+)/);
    const noteId = idMatch ? idMatch[1] : '';

    if (!noteId) {
      return {
        title: '豆瓣日记',
        content_html: '',
      };
    }

    try {
      const apiUrl = `https://m.douban.com/rexxar/api/v2/note/${noteId}`;
      const res = await httpJson<DoubanNote>({
        url: apiUrl,
        headers: {
          'Referer': `https://m.douban.com/note/${noteId}/`,
        },
      });

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
        };
      }
    } catch (e) {
      logger.warn({ extractor: 'douban', url }, `Rexxar API failed: ${errorMessage(e)}`);
    }

    return {
      title: '豆瓣日记',
      content_html: '',
    };
  }
}
