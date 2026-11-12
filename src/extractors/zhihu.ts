import * as cheerio from 'cheerio';
import { BaseExtractor } from './base.js';
import { hostMatches, parseUrl } from '../utils/url-match.js';
import { RawExtractedArticle } from '../types/index.js';

export class ZhihuExtractor extends BaseExtractor {
  name = 'zhihu';

  canHandle(url: string): boolean {
    const u = parseUrl(url);
    return hostMatches(u, 'zhihu.com') && (u!.pathname.startsWith('/p/') || u!.pathname.startsWith('/question/'));
  }

  async extract(url: string, html: string): Promise<RawExtractedArticle> {
    const $ = cheerio.load(html);

    // Title
    const title = $('.Post-Title').first().text().trim() ||
                  $('h1.QuestionHeader-title').text().trim() ||
                  this.getMetaContent($, 'og:title') ||
                  $('title').text().replace('- 知乎', '').trim() ||
                  '未命名知乎内容';

    // Author
    const author = $('.AuthorInfo-name .UserLink-link').first().text().trim() ||
                   this.getMetaContent($, 'author') ||
                   '知乎答主';

    // Publish Time
    let publishTime = this.getMetaContent($, 'article:published_time') ||
                      $('meta[itemprop="datePublished"]').attr('content') ||
                      $('.ContentItem-time').first().text().replace(/编辑于|发布于/, '').trim();
    if (!publishTime) {
      const match = html.match(/"datePublished":\s*"([^"]+)"/);
      if (match) publishTime = match[1];
    }

    // Cover Image
    const coverImage = $('.TitleImage').attr('src') ||
                       this.getMetaContent($, 'og:image');

    // Content container: Article or Answer
    let contentDom = $('.Post-RichTextContainer .RichText').first();
    if (contentDom.length === 0) {
      contentDom = $('.RichContent-inner .RichText').first();
    }
    if (contentDom.length === 0) {
      contentDom = $('.Post-RichText').first();
    }

    this.removeNoiseElements($, contentDom);

    // Fix Zhihu lazy-loaded images (prefer data-actualsrc or data-original)
    contentDom.find('img').each((_, el) => {
      const $img = $(el);
      const actualSrc = $img.attr('data-actualsrc') ||
                        $img.attr('data-original') ||
                        $img.attr('src');
      if (actualSrc) {
        $img.attr('src', actualSrc);
        $img.removeAttr('data-actualsrc');
        $img.removeAttr('data-original');
      }
    });

    const contentHtml = contentDom.html() || '';

    return {
      title,
      author,
      publish_time: publishTime,
      cover_image: coverImage,
      content_html: contentHtml,
    };
  }
}
