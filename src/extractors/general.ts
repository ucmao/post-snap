import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import * as cheerio from 'cheerio';
import { BaseExtractor } from './base.js';
import { detectGeneralPlatform } from '../utils/platform.js';
import { RawExtractedArticle } from '../types/index.js';

export class GeneralExtractor extends BaseExtractor {
  name = 'general';

  canHandle(_url: string): boolean {
    return true;
  }

  private cleanTitle(title: string): string {
    if (!title) return '未命名文章';
    return title
      .replace(/\s*[-_|_]\s*(东方财富网|澎湃新闻.*|腾讯新闻|ZAKER.*|搜狐.*|新浪.*|中华网.*|少数派|IT之家|虎嗅.*|网易.*|博客园|思否|SegmentFault|CSDN.*|知乎.*|36氪.*|GitHub Blog|WordPress.*)$/i, '')
      .replace(/\s*[-_|_]\s*[\u4e00-\u9fa5]{2,10}(网|号|客户端|新闻|社区|博客|专栏)$/i, '')
      .trim();
  }

  private detectAuthor($: cheerio.CheerioAPI, html: string): string {
    // 1. Meta check
    let author = this.getMetaContent($, 'author') ||
                 this.getMetaContent($, 'article:author') ||
                 this.getMetaContent($, 'og:article:author') ||
                 this.getMetaContent($, 'source') ||
                 this.getMetaContent($, 'media_name') ||
                 '';

    // Discard invalid/code authors like "#5434", "admin", "null"
    if (author && (author.startsWith('#') || /^\d+$/.test(author) || /^(admin|root|null|undefined)$/i.test(author))) {
      author = '';
    }

    // 2. DOM selector check
    if (!author) {
      const candidates = [
        '.author', '.author-name', '.art_author', '.writer', '.user-name',
        '.ntpl_header_author', '.source', '.news_source', '.publisher',
        '.editor', '.origin', '.chan_newsInfo', '#chan_newsInfo',
        '.news_about', '.infos', '.data'
      ];
      for (const sel of candidates) {
        const text = $(sel).first().text().replace(/\s+/g, ' ').trim();
        if (text) {
          // Look for "来源：XXX" or "作者：XXX" pattern
          const match = text.match(/(?:来源|作者|文|编辑)[:：\s]+([^\s\|·;,，]{2,20})/);
          if (match) {
            author = match[1].trim();
            break;
          } else if (text.length >= 2 && text.length <= 20 && !/\d{4}/.test(text)) {
            author = text;
            break;
          }
        }
      }
    }

    // 3. Fallback regex in HTML
    if (!author) {
      const m = html.match(/(?:来源|作者|文|撰文)[:：\s]+["']?([^\s"'\n<>\|·;,，]{2,20})/);
      if (m && !/^(本站|网络|原创|转载)$/.test(m[1].trim())) {
        author = m[1].trim();
      }
    }

    return author.replace(/^(作者|来源|责任编辑|编辑)[:：\s]*/, '').trim();
  }

  private detectPublishTime($: cheerio.CheerioAPI, html: string): string | undefined {
    // 1. Meta check
    let date = this.getMetaContent($, 'article:published_time') ||
               this.getMetaContent($, 'og:release_date') ||
               this.getMetaContent($, 'pubdate') ||
               this.getMetaContent($, 'publishdate') ||
               this.getMetaContent($, 'publish_time') ||
               this.getMetaContent($, 'date') ||
               $('time').attr('datetime') ||
               $('time').text().trim();

    if (date && /\d{4}/.test(date)) {
      return date.trim();
    }

    // 2. DOM selectors for date/time
    const dateSelectors = [
      '.time', '.date', '.pub_date', '.publish-time', '.post-time',
      '.news_about', '.infos', '#chan_newsInfo', '.article_info',
      '.header_about', '.time-source', '.entry-date'
    ];
    for (const sel of dateSelectors) {
      const text = $(sel).first().text().trim();
      const match = text.match(/202\d[-/.年][01]?\d[-/.月][0-3]?\d([日\s]+[0-2]\d:[0-5]\d(:[0-5]\d)?)?/);
      if (match) {
        return match[0].trim();
      }
    }

    // 3. Regex on whole HTML
    const globalMatch = html.match(/202\d-[01]\d-[0-3]\d(\s+[0-2]\d:[0-5]\d(:[0-5]\d)?)?/);
    if (globalMatch) {
      return globalMatch[0].trim();
    }

    return undefined;
  }

  async extract(url: string, html: string): Promise<RawExtractedArticle> {
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document, {
      charThreshold: 20,
      keepClasses: false,
    });

    const parsed = reader.parse();
    const $ = cheerio.load(html);

    // 1. Title
    const rawTitle = parsed?.title ||
                     $('h1').first().text().trim() ||
                     this.getMetaContent($, 'og:title') ||
                     $('title').text().trim() ||
                     '未命名文章';
    const title = this.cleanTitle(rawTitle);

    // 2. Author
    let author = this.detectAuthor($, html) || parsed?.byline || '';

    // 3. Publish Time
    const publishTime = this.detectPublishTime($, html);

    // 4. Cover Image
    const coverImage = this.getMetaContent($, 'og:image') ||
                       this.getMetaContent($, 'twitter:image');

    // 5. Content
    let contentHtml = parsed?.content || '';

    // If Readability returns too little content, fallback to specific semantic tags
    if (!contentHtml || contentHtml.trim().length < 80) {
      const candidates = [
        '[node-type="contentBody"]',
        '.article_bd__detail',
        '.article-content',
        '.entry-content',
        '#article-content',
        '#article_content',
        '.post-content',
        'article',
        'main'
      ];
      for (const sel of candidates) {
        const target = $(sel).first();
        if (target.length > 0 && target.text().trim().length > 80) {
          this.removeNoiseElements($, target);
          contentHtml = target.html() || '';
          break;
        }
      }
    }

    // 6. Clean lazy images & convert data-src to src
    const $content = cheerio.load(contentHtml, null, false);
    $content('img').each((_, el) => {
      const $img = $content(el);
      const realSrc = $img.attr('data-src') ||
                      $img.attr('data-original') ||
                      $img.attr('data-actualsrc') ||
                      $img.attr('data-lazy-src') ||
                      $img.attr('data-echo') ||
                      $img.attr('data-url') ||
                      $img.attr('src');
      if (realSrc && !realSrc.startsWith('data:image/svg') && realSrc.length > 5) {
        $img.attr('src', realSrc.startsWith('//') ? 'https:' + realSrc : realSrc);
      }
      $img.removeAttr('data-src');
      $img.removeAttr('data-original');
      $img.removeAttr('data-actualsrc');
      $img.removeAttr('data-lazy-src');
    });

    // 7. Remove common noise like feedback/share buttons
    $content('.share-box, .comment-box, .ad-box, .advertisement, .qr-code, #backsohucom').remove();

    contentHtml = $content.html() || '';

    return {
      title,
      author,
      publish_time: publishTime,
      cover_image: coverImage,
      content_html: contentHtml,
      platform_id: detectGeneralPlatform(url),
    };
  }
}
