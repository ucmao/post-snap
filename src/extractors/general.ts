import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import * as cheerio from 'cheerio';
import { BaseExtractor } from './base.js';
import { RawExtractedArticle } from '../types/index.js';

export class GeneralExtractor extends BaseExtractor {
  name = 'general';

  canHandle(_url: string): boolean {
    // Fallback handler for all URLs
    return true;
  }

  async extract(url: string, html: string): Promise<RawExtractedArticle> {
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document, {
      charThreshold: 20,
      keepClasses: false,
    });

    const parsed = reader.parse();
    const $ = cheerio.load(html);

    const title = parsed?.title ||
                  $('h1').first().text().trim() ||
                  this.getMetaContent($, 'og:title') ||
                  $('title').text().trim() ||
                  '未命名文章';

    const author = parsed?.byline ||
                   this.getMetaContent($, 'author') ||
                   '';

    const coverImage = this.getMetaContent($, 'og:image') ||
                       this.getMetaContent($, 'twitter:image');

    let contentHtml = parsed?.content || '';

    // If Readability fails or returns empty, fallback to article/body tags
    if (!contentHtml || contentHtml.trim().length < 50) {
      const fallbackTarget = $('article').first().length > 0 ? $('article').first() : $('main').first();
      if (fallbackTarget.length > 0) {
        this.removeNoiseElements($, fallbackTarget);
        contentHtml = fallbackTarget.html() || '';
      }
    }

    // Fix lazy loading images with data-src, data-original, etc.
    const $content = cheerio.load(contentHtml, null, false);
    $content('img').each((_, el) => {
      const $img = $content(el);
      const realSrc = $img.attr('data-src') ||
                      $img.attr('data-original') ||
                      $img.attr('data-actualsrc') ||
                      $img.attr('src');
      if (realSrc) {
        $img.attr('src', realSrc);
        $img.removeAttr('data-src');
        $img.removeAttr('data-original');
      }
    });

    contentHtml = $content.html() || '';

    return {
      title,
      author,
      cover_image: coverImage,
      content_html: contentHtml,
      platform: 'Generic Web Page',
    };
  }
}
