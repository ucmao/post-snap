import * as cheerio from 'cheerio';
import crypto from 'node:crypto';
import { BaseExtractor } from './base.js';
import { hostMatches, parseUrl } from '../utils/url-match.js';
import { RawExtractedArticle } from '../types/index.js';

export class SohuExtractor extends BaseExtractor {
  name = 'sohu';

  canHandle(url: string): boolean {
    const u = parseUrl(url);
    return hostMatches(u, 'sohu.com') && u!.pathname.startsWith('/a/');
  }

  private decryptSohuImage(encrypted: string): string | null {
    try {
      if (!encrypted || encrypted.startsWith('http') || encrypted.startsWith('//')) {
        return encrypted;
      }
      const key = Buffer.from('www.sohu.com6666', 'utf8');
      const decipher = crypto.createDecipheriv('aes-128-ecb', key, null);
      decipher.setAutoPadding(true);
      let decrypted = decipher.update(encrypted, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
      if (decrypted.startsWith('//')) {
        return 'https:' + decrypted;
      }
      return decrypted;
    } catch {
      return null;
    }
  }

  async extract(url: string, html: string): Promise<RawExtractedArticle> {
    const $ = cheerio.load(html);

    // Extract title
    let title = $('h1').first().text().trim() ||
                this.getMetaContent($, 'og:title') ||
                $('title').text().trim();
    title = title.replace(/_[^_]*?(搜狐|游戏|旅行|财经|娱乐|体育|汽车).*$/i, '').trim();

    // Extract author
    let author = $('.user-info .name, .avatar__name a, .article-info .source').first().text().trim() ||
                 this.getMetaContent($, 'author') ||
                 '';
    if (!author) {
      const match = html.match(/media_name["\x27:]+([^"\x27,]+)/i);
      if (match) author = match[1].trim();
    }

    // Extract publish time
    let publishTime = this.getMetaContent($, 'og:release_date') ||
                      this.getMetaContent($, 'article:published_time') ||
                      $('.article-info .time, #news-time, .time').first().text().trim() ||
                      '';
    if (!publishTime) {
      const timeMatch = html.match(/202\d-[01]\d-[0-3]\d\s+[0-2]\d:[0-5]\d(:[0-5]\d)?/);
      if (timeMatch) publishTime = timeMatch[0];
    }

    // Extract cover image
    const coverImage = this.getMetaContent($, 'og:image');

    // Locate content container
    let $content = $('#mp-editor').first();
    if ($content.length === 0) {
      $content = $('article.article, .article-content, .text').first();
    }

    // Decrypt all Sohu encrypted images
    $content.find('img').each((_, el) => {
      const $img = $(el);
      const dataSrc = $img.attr('data-src');
      const rawSrc = $img.attr('src');
      const target = dataSrc || rawSrc;

      if (target) {
        const decrypted = this.decryptSohuImage(target);
        if (decrypted) {
          $img.attr('src', decrypted);
        } else if (target.startsWith('http') || target.startsWith('//')) {
          $img.attr('src', target.startsWith('//') ? 'https:' + target : target);
        }
      }
      $img.removeAttr('data-src');
    });

    // Remove noise elements
    this.removeNoiseElements($, $content);
    $content.find('#backsohucom, .statement, .edit-info, .lookall-box').remove();

    return {
      title: title || '未命名搜狐文章',
      author,
      publish_time: publishTime,
      cover_image: coverImage,
      content_html: $content.html() || '',
    };
  }
}
