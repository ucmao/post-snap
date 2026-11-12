import { httpJson } from '../utils/http.js';
import { logger, errorMessage } from '../utils/logger.js';
import { BaseExtractor } from './base.js';
import { hostMatches } from '../utils/url-match.js';
import { RawExtractedArticle } from '../types/index.js';

interface HnrArticleResponse {
  result?: {
    articleTitle?: string;
    title?: string;
    articleAuthor?: string;
    author?: string;
    articleOriginCode?: string;
    publishDate?: string | number;
    publishTime?: string | number;
    createTime?: string | number;
    shareImg?: string;
    coverImagesList?: Array<{ url?: string }>;
    contentBody?: string;
  };
}

export class HnrExtractor extends BaseExtractor {
  name = 'hnr';
  /** Fetches its own content from a platform API; the route skips the page fetch. */
  selfFetch = true;

  canHandle(url: string): boolean {
    return hostMatches(url, 'hnr.cn', 'hntv.tv');
  }

  async extract(url: string, _initialHtml: string): Promise<RawExtractedArticle> {
    const idMatch = url.match(/(?:article\/\d+\/|news\/\d+\/|articleId=)?(\d{15,})/);
    const articleId = idMatch ? idMatch[1] : '';

    if (!articleId) {
      return {
        title: '大象新闻/映象网文章',
        content_html: '',
      };
    }

    try {
      // HNR / Hntv is a SPA frontend; the full SSR article is retrieved from their mobile CMS gateway
      const apiUrl = `https://yxwpubmod.hntv.tv/mobile/cms/articlewithrelated?articleId=${articleId}`;
      const res = await httpJson<HnrArticleResponse>({ url: apiUrl });

      const result = res.result;
      if (result) {
        const title = result.articleTitle || result.title || '大象新闻文章';
        const author = result.articleAuthor || result.author || result.articleOriginCode || '大象新闻';
        const publishTime = result.publishDate || result.publishTime || result.createTime;
        const coverImage = result.shareImg || result.coverImagesList?.[0]?.url;
        const contentHtml = result.contentBody || '';

        return {
          title,
          author,
          publish_time: publishTime,
          cover_image: coverImage,
          content_html: contentHtml,
        };
      }
    } catch (e) {
      logger.warn({ extractor: 'hnr', url }, `Failed to fetch article: ${errorMessage(e)}`);
    }

    return {
      title: '大象新闻文章',
      content_html: '',
    };
  }
}
