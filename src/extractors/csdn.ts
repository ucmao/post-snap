import * as cheerio from 'cheerio';
import { BaseExtractor } from './base.js';
import { hostMatches } from '../utils/url-match.js';
import { RawExtractedArticle } from '../types/index.js';

export class CSDNExtractor extends BaseExtractor {
  name = 'csdn';

  canHandle(url: string): boolean {
    return hostMatches(url, 'blog.csdn.net');
  }

  async extract(url: string, html: string): Promise<RawExtractedArticle> {
    const $ = cheerio.load(html);

    const title = $('#articleContentId').text().trim() ||
                  $('.title-article').text().trim() ||
                  this.getMetaContent($, 'og:title') ||
                  '未命名CSDN博客';

    const author = $('.follow-nickName').first().text().trim() ||
                   $('.user-info a.name').first().text().trim() ||
                   this.getMetaContent($, 'author') ||
                   'CSDN博主';

    let publishTime = $('.time').first().text().replace(/于|已于|在/, '').trim() ||
                      this.getMetaContent($, 'pubdate') ||
                      this.getMetaContent($, 'article:published_time');
    if (!publishTime) {
      const timeMatch = html.match(/202\d-[01]\d-[0-3]\d\s+[0-2]\d:[0-5]\d/);
      if (timeMatch) publishTime = timeMatch[0];
    }

    const contentDom = $('#article_content');

    // Remove CSDN annoying elements (e.g. read more blur, bottom copyright, follow prompts)
    contentDom.find('.hide-article-box, .blog-content-box, .recommend-box, #treeSkill, .blog-column-pay').remove();
    this.removeNoiseElements($, contentDom);

    // Fix CSDN images
    contentDom.find('img').each((_, el) => {
      const $img = $(el);
      const realSrc = $img.attr('data-src') || $img.attr('src');
      if (realSrc) {
        $img.attr('src', realSrc);
        $img.removeAttr('data-src');
      }
    });

    const contentHtml = contentDom.html() || '';

    return {
      title,
      author,
      publish_time: publishTime,
      content_html: contentHtml,
      platform: 'CSDN',
    };
  }
}
