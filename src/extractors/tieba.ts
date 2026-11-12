import { httpJson } from '../utils/http.js';
import { logger, errorMessage } from '../utils/logger.js';
import { BaseExtractor } from './base.js';
import { hostMatches, parseUrl } from '../utils/url-match.js';
import { RawExtractedArticle } from '../types/index.js';

interface TiebaContentItem {
  type?: number;
  text?: string;
  link?: string;
  src?: string;
  origin_src?: string;
}

interface TiebaPost {
  title?: string;
  time?: number;
  author?: { show_nickname?: string; name_show?: string; name?: string };
  content?: TiebaContentItem[];
}

interface TiebaPbResponse {
  data?: {
    post_list?: TiebaPost[];
    forum?: { name?: string };
    thread?: { title?: string };
  };
}

export class TiebaExtractor extends BaseExtractor {
  name = 'tieba';
  /** Fetches its own content from a platform API; the route skips the page fetch. */
  selfFetch = true;

  canHandle(url: string): boolean {
    const u = parseUrl(url);
    if (!hostMatches(u, 'tieba.baidu.com')) return false;
    return u!.pathname.startsWith('/p/') ||
           ((u!.pathname === '/f' || u!.pathname === '/mo/q/m') && u!.searchParams.has('kz'));
  }

  async extract(url: string, _initialHtml: string): Promise<RawExtractedArticle> {
    // 1. Extract post ID (kz)
    const kzMatch = url.match(/(?:p\/|kz=)(\d+)/);
    const kz = kzMatch ? kzMatch[1] : '';

    if (!kz) {
      return {
        title: '百度贴吧帖子',
        content_html: '',
      };
    }

    try {
      // Baidu Tieba PC pages block scrapers with "百度安全验证" (403 CAPTCHA shield).
      // However, Tieba's mobile JSON endpoint (getPbData) returns 200 with complete thread data!
      const apiUrl = `https://tieba.baidu.com/mg/p/getPbData?kz=${kz}`;
      const response = await httpJson<TiebaPbResponse>({
        url: apiUrl,
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
          'Referer': `https://tieba.baidu.com/p/${kz}`,
        },
      });

      const data = response?.data;
      if (data && data.post_list && data.post_list.length > 0) {
        const firstPost = data.post_list[0];
        const forumName = data.forum?.name ? `${data.forum.name}吧` : '';
        const rawTitle = firstPost.title || data.thread?.title || '百度贴吧帖子';
        const title = forumName ? `【${forumName}】${rawTitle}` : rawTitle;

        const author = firstPost.author?.show_nickname ||
                       firstPost.author?.name_show ||
                       firstPost.author?.name ||
                       '贴吧网友';

        // Build rich-text HTML from post elements
        const htmlParts: string[] = [];
        let coverImage: string | undefined;

        if (Array.isArray(firstPost.content)) {
          for (const item of firstPost.content) {
            if (item.type === 0 && item.text) {
              // Plain text or text with line breaks
              const safeText = item.text.replace(/\n/g, '<br/>');
              htmlParts.push(`<p>${safeText}</p>`);
            } else if (item.type === 1 && item.link) {
              // External or internal link
              htmlParts.push(`<p><a href="${item.link}" target="_blank" rel="noopener noreferrer">${item.text || item.link}</a></p>`);
            } else if (item.type === 3 && item.src) {
              // Image
              const imgSrc = item.origin_src && item.origin_src.startsWith('http')
                ? item.origin_src
                : item.src;
              if (!coverImage) {
                coverImage = imgSrc;
              }
              htmlParts.push(`<p><img src="${imgSrc}" alt="贴吧图片" referrerpolicy="no-referrer" /></p>`);
            } else if (item.type === 2 && item.text) {
              // Emoji / sticker
              htmlParts.push(`<span>${item.text}</span>`);
            }
          }
        }

        const contentHtml = htmlParts.join('\n');

        return {
          title,
          author,
          publish_time: firstPost.time,
          cover_image: coverImage,
          content_html: contentHtml,
        };
      }
    } catch (e) {
      logger.warn({ extractor: 'tieba', url }, `getPbData API failed: ${errorMessage(e)}`);
    }

    return {
      title: '百度贴吧帖子',
      content_html: '',
    };
  }
}
