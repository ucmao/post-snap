import * as cheerio from 'cheerio';
import { BaseExtractor } from './base.js';
import { RawExtractedArticle } from '../types/index.js';

export class CSDNExtractor extends BaseExtractor {
  name = 'csdn';

  canHandle(url: string): boolean {
    return url.includes('blog.csdn.net');
  }

  async extract(url: string, html: string): Promise<RawExtractedArticle> {
    const $ = cheerio.load(html);

    const title = $('#articleContentId').text().trim() ||
                  $('.title-article').text().trim() ||
                  this.getMetaContent($, 'og:title') ||
                  '未命名CSDN博客';

    const author = $('.follow-nickName').first().text().trim() ||
                   this.getMetaContent($, 'author') ||
                   '';

    const contentDom = $('#article_content');

    // Remove CSDN annoying elements (e.g. read more blur, bottom copyright, follow prompts)
    contentDom.find('.hide-article-box, .blog-content-box, .recommend-box, #treeSkill').remove();
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
      content_html: contentHtml,
      platform: 'CSDN',
    };
  }
}
