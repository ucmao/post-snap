import { gotScraping } from 'got-scraping';
import { BaseExtractor } from './base.js';
import { RawExtractedArticle } from '../types/index.js';
import { config } from '../config.js';

export class InfoQExtractor extends BaseExtractor {
  name = 'infoq';

  canHandle(url: string): boolean {
    return url.includes('infoq.cn/article/');
  }

  async extract(url: string, _initialHtml: string): Promise<RawExtractedArticle> {
    const idMatch = url.match(/article\/([a-zA-Z0-9_\-]+)/);
    const uuid = idMatch ? idMatch[1] : '';

    if (!uuid) {
      return {
        title: 'InfoQ 文章',
        content_html: '',
        platform: '极客邦 InfoQ',
      };
    }

    try {
      const res: any = await gotScraping.post('https://www.infoq.cn/public/v1/article/getDetail', {
        json: { uuid },
        headers: {
          'Referer': `https://www.infoq.cn/article/${uuid}`,
          'Origin': 'https://www.infoq.cn',
        },
        timeout: { request: config.requestTimeout },
      }).json();

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
          platform: '极客邦 InfoQ',
        };
      }
    } catch (e: any) {
      console.warn(`[InfoQExtractor] API request failed: ${e.message}`);
    }

    return {
      title: 'InfoQ 文章',
      content_html: '',
      platform: '极客邦 InfoQ',
    };
  }
}
