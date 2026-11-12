import { httpJson } from '../utils/http.js';
import { logger, errorMessage } from '../utils/logger.js';
import { BaseExtractor } from './base.js';
import { hostMatches, parseUrl } from '../utils/url-match.js';
import { RawExtractedArticle } from '../types/index.js';

interface InfoQDetailResponse {
  data?: {
    article_title?: string;
    author?: Array<{ nickname?: string }>;
    article_cover?: string;
    content?: string;
    ai_summary?: string;
    content_short?: string;
  };
}

export class InfoQExtractor extends BaseExtractor {
  name = 'infoq';
  /** Fetches its own content from a platform API; the route skips the page fetch. */
  selfFetch = true;

  canHandle(url: string): boolean {
    const u = parseUrl(url);
    return hostMatches(u, 'infoq.cn') && u!.pathname.startsWith('/article/');
  }

  async extract(url: string, _initialHtml: string): Promise<RawExtractedArticle> {
    const idMatch = url.match(/article\/([a-zA-Z0-9_\-]+)/);
    const uuid = idMatch ? idMatch[1] : '';

    if (!uuid) {
      return {
        title: 'InfoQ 文章',
        content_html: '',
      };
    }

    try {
      const res = await httpJson<InfoQDetailResponse>({
        url: 'https://www.infoq.cn/public/v1/article/getDetail',
        method: 'POST',
        json: { uuid },
        headers: {
          'Referer': `https://www.infoq.cn/article/${uuid}`,
          'Origin': 'https://www.infoq.cn',
        },
      });

      const item = res?.data;
      if (item) {
        const title = item.article_title || 'InfoQ 文章';
        const author = item.author?.[0]?.nickname || 'InfoQ 创作者';
        const coverImage = item.article_cover;
        
        let contentHtml = item.content || '';
        if (!contentHtml && item.ai_summary) {
          contentHtml = `<p><strong>【AI 摘要】</strong>${item.ai_summary}</p>` + (item.content_short ? `<p>${item.content_short}</p>` : '');
        }

        return {
          title,
          author,
          cover_image: coverImage,
          content_html: contentHtml,
        };
      }
    } catch (e) {
      logger.warn({ extractor: 'infoq', url }, `API request failed: ${errorMessage(e)}`);
    }

    return {
      title: 'InfoQ 文章',
      content_html: '',
    };
  }
}
