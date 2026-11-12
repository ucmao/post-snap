import { httpText } from '../utils/http.js';
import { logger, errorMessage } from '../utils/logger.js';
import { BaseExtractor } from './base.js';
import { hostMatches, parseUrl } from '../utils/url-match.js';
import { RawExtractedArticle } from '../types/index.js';

interface Kr36Data {
  widgetTitle?: string;
  title?: string;
  author?: string;
  user?: { name?: string };
  widgetContent?: string;
  content?: string;
  widgetImage?: string;
  cover?: string;
  publishTime?: number | string;
}

interface Kr36State {
  article?: { detail?: { data?: Kr36Data } };
  articleDetail?: { articleDetailData?: { data?: Kr36Data } };
}

export class Kr36Extractor extends BaseExtractor {
  name = '36kr';
  /** Fetches its own content from a platform API; the route skips the page fetch. */
  selfFetch = true;

  canHandle(url: string): boolean {
    const u = parseUrl(url);
    return hostMatches(u, '36kr.com') && u!.pathname.startsWith('/p/');
  }

  async extract(url: string, _initialHtml: string): Promise<RawExtractedArticle> {
    const idMatch = url.match(/36kr\.com\/p\/(\d+)/);
    const articleId = idMatch ? idMatch[1] : '';

    const targetUrl = articleId
      ? `https://m.36kr.com/p/${articleId}`
      : url;

    const body = await httpText({
      url: targetUrl,
      headerGeneratorOptions: {
        devices: ['mobile'],
        browsers: [{ name: 'safari' }],
      },
    });

    const startIdx = body.indexOf('window.initialState=');
    if (startIdx !== -1) {
      try {
        const sub = body.substring(startIdx + 'window.initialState='.length);
        const endIdx = sub.indexOf('</script>');
        const jsonStr = sub.substring(0, endIdx).replace(/;$/, '').trim();
        const state = JSON.parse(jsonStr) as Kr36State;

        const data = state.article?.detail?.data || state.articleDetail?.articleDetailData?.data;
        if (data) {
          const title = data.widgetTitle || data.title || '36氪文章';
          const author = data.author || data.user?.name || '36氪';
          const contentHtml = data.widgetContent || data.content || '';
          const coverImage = data.widgetImage || data.cover;

          return {
            title,
            author,
            publish_time: data.publishTime,
            cover_image: coverImage,
            content_html: contentHtml,
          };
        }
      } catch (e) {
        logger.warn({ extractor: '36kr', url }, `Failed to parse initialState: ${errorMessage(e)}`);
      }
    }

    return {
      title: '36氪文章',
      content_html: '',
    };
  }
}
