import * as cheerio from 'cheerio';
import { BaseExtractor } from './base.js';
import { RawExtractedArticle } from '../types/index.js';

export class WeiboExtractor extends BaseExtractor {
  name = 'weibo';

  canHandle(url: string): boolean {
    return /weibo\.(com|cn)\/ttarticle/i.test(url);
  }

  async extract(url: string, html: string): Promise<RawExtractedArticle> {
    const $ = cheerio.load(html);

    // Title
    let title = $('h1').first().text().trim() ||
                $('.title').first().text().trim() ||
                this.getMetaContent($, 'og:title') ||
                $('title').text().trim();
    title = title.replace(/\s*-\s*微博$/, '').trim();

    // Author
    let author = '';
    $('a[href*="/u/"]').each((_, el) => {
      const text = $(el).text().trim();
      if (!author && text && !text.includes('博主') && text.length < 20) {
        author = text;
      }
    });
    if (!author) {
      author = $('.author_succ .W_f14, .author-name, .user-name').first().text().trim() ||
               this.getMetaContent($, 'author') ||
               '微博创作者';
    }

    // Publish Time
    let publishTime = $('.time, span.time, .pub_date, .date').first().text().trim();
    if (!publishTime) {
      const timeMatch = html.match(/(\d{4}-)?\d{1,2}-\d{1,2}\s+\d{2}:\d{2}/);
      if (timeMatch) publishTime = timeMatch[0];
    }

    // Cover image
    const coverImage = this.getMetaContent($, 'og:image');

    // Content Body
    let $content = $('[node-type="contentBody"]').first();
    if ($content.length === 0) {
      $content = $('.main_editor').first();
    }

    // Upgrade Weibo images to large resolution
    $content.find('img').each((_, el) => {
      const $img = $(el);
      let src = $img.attr('src') || $img.attr('data-src') || '';
      // Weibo image resolution upgrade: bmiddle / thumb180 -> large
      if (src.includes('sinaimg.cn')) {
        src = src.replace(/\/(bmiddle|thumb\d+|square|small)\//, '/large/');
      }
      $img.attr('src', src);
      $img.removeAttr('srcset');
    });

    this.removeNoiseElements($, $content);
    $content.find('.artical-add-box, .reward_box, .WB_editor_iframe_new_empty').remove();

    return {
      title: title || '微博头条文章',
      author,
      publish_time: publishTime,
      cover_image: coverImage,
      content_html: $content.html() || '',
      platform: '微博头条文章',
    };
  }
}
