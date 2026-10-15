import { gotScraping } from 'got-scraping';
import { BaseExtractor } from './base.js';
import { RawExtractedArticle } from '../types/index.js';
import { config } from '../config.js';

export class Kr36Extractor extends BaseExtractor {
  name = '36kr';

  canHandle(url: string): boolean {
    return url.includes('36kr.com/p/');
  }

  async extract(url: string, _initialHtml: string): Promise<RawExtractedArticle> {
    const idMatch = url.match(/36kr\.com\/p\/(\d+)/);
    const articleId = idMatch ? idMatch[1] : '';

    const targetUrl = articleId
      ? `https://m.36kr.com/p/${articleId}`
      : url;

    const res = await gotScraping({
      url: targetUrl,
      headerGeneratorOptions: {
        devices: ['mobile'],
        browsers: [{ name: 'safari' }],
      },
      timeout: { request: config.requestTimeout },
    });

    const startIdx = res.body.indexOf('window.initialState=');
    if (startIdx !== -1) {
      try {
        const sub = res.body.substring(startIdx + 'window.initialState='.length);
        const endIdx = sub.indexOf('</script>');
        const jsonStr = sub.substring(0, endIdx).replace(/;$/, '').trim();
        const state = JSON.parse(jsonStr);

        const data = state.article?.detail?.data || state.articleDetail?.articleDetailData?.data;
        if (data) {
          const title = data.widgetTitle || data.title || '36氪文章';
          const author = data.author || data.user?.name || '36氪';
          const contentHtml = data.widgetContent || data.content || '';
          const coverImage = data.widgetImage || data.cover;

          let publishTime: string | undefined;
          if (data.publishTime) {
            const ts = Number(data.publishTime);
            publishTime = !isNaN(ts) ? new Date(ts).toISOString() : String(data.publishTime);
          }

          return {
            title,
            author,
            publish_time: publishTime,
            cover_image: coverImage,
            content_html: contentHtml,
            platform: '36氪',
          };
        }
      } catch (e: any) {
        console.warn(`[36krExtractor] Failed to parse initialState: ${e.message}`);
      }
    }

    return {
      title: '36氪文章',
      content_html: '',
      platform: '36氪',
    };
  }
}
