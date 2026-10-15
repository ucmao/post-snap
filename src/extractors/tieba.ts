import { gotScraping } from 'got-scraping';
import { BaseExtractor } from './base.js';
import { RawExtractedArticle } from '../types/index.js';
import { config } from '../config.js';

export class TiebaExtractor extends BaseExtractor {
  name = 'tieba';

  canHandle(url: string): boolean {
    return url.includes('tieba.baidu.com/p/') ||
           url.includes('tieba.baidu.com/f?kz=') ||
           url.includes('tieba.baidu.com/mo/q/m?kz=');
  }

  async extract(url: string, _initialHtml: string): Promise<RawExtractedArticle> {
    // 1. Extract post ID (kz)
    const kzMatch = url.match(/(?:p\/|kz=)(\d+)/);
    const kz = kzMatch ? kzMatch[1] : '';

    if (!kz) {
      return {
        title: '百度贴吧帖子',
        content_html: '',
        platform: '百度贴吧',
      };
    }

    try {
      // Baidu Tieba PC pages block scrapers with "百度安全验证" (403 CAPTCHA shield).
      // However, Tieba's mobile JSON endpoint (getPbData) returns 200 with complete thread data!
      const apiUrl = `https://tieba.baidu.com/mg/p/getPbData?kz=${kz}`;
      const response: any = await gotScraping(apiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
          'Referer': `https://tieba.baidu.com/p/${kz}`,
        },
        timeout: { request: config.requestTimeout },
      }).json();

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

        // Format publish time
        let publishTime: string | undefined;
        if (firstPost.time) {
          const date = new Date(firstPost.time * 1000);
          publishTime = date.toISOString().replace('T', ' ').slice(0, 19);
        }

        // Build rich-text HTML from post elements
        let htmlParts: string[] = [];
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
          publish_time: publishTime,
          cover_image: coverImage,
          content_html: contentHtml,
          platform: 'Baidu Tieba (百度贴吧)',
        };
      }
    } catch (e: any) {
      console.warn(`[TiebaExtractor] getPbData API failed: ${e.message}`);
    }

    return {
      title: '百度贴吧帖子',
      content_html: '',
      platform: 'Baidu Tieba (百度贴吧)',
    };
  }
}
