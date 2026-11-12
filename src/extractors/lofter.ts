import * as cheerio from 'cheerio';
import { BaseExtractor } from './base.js';
import { hostMatches } from '../utils/url-match.js';
import { RawExtractedArticle } from '../types/index.js';

interface LofterImage {
  raw?: string;
  orign?: string;
  origin?: string;
}

interface LofterPostView {
  title?: string;
  digest?: string;
  publishTime?: number | string;
  noticeTime?: number | string;
  content?: string;
  firstImage?: LofterImage;
  photoPostView?: {
    caption?: string;
    photoLinks?: LofterImage[];
    firstImage?: LofterImage;
  };
  videoPostView?: {
    caption?: string;
    videoInfo?: { originUrl?: string; flashurl?: string };
  };
}

interface LofterBlogInfo {
  blogNickName?: string;
  blogName?: string;
}

interface LofterInitData {
  postData?: {
    data?: {
      blogInfo?: LofterBlogInfo;
      postData?: { postView?: LofterPostView };
    };
  };
  answerDetailData?: {
    blogInfo?: LofterBlogInfo;
    barrage?: string;
    answer?: string;
    images?: LofterImage[];
  };
}

export class LofterExtractor extends BaseExtractor {
  name = 'lofter';

  canHandle(url: string): boolean {
    return hostMatches(url, 'lofter.com');
  }

  /**
   * Clean LOFTER image url by stripping resizing and watermark query parameters.
   */
  private cleanImageUrl(url: string | undefined): string | undefined {
    if (!url) return undefined;
    return url.replace(/\?(imageView|type=).*$/, '').replace(/\\u002F/g, '/');
  }

  private parseJsonSafely(rawStr: string): LofterInitData | null {
    const jsonStr = rawStr.replace(/;\s*$/, '').trim();
    try {
      return JSON.parse(jsonStr) as LofterInitData;
    } catch {
      try {
        const quoted = jsonStr.replace(/([{,]\s*)([a-zA-Z0-9_$]+)\s*:/g, '$1"$2":');
        return JSON.parse(quoted) as LofterInitData;
      } catch {
        return null;
      }
    }
  }

  private extractInitializeData(html: string): LofterInitData | null {
    const idx = html.indexOf('window.__initialize_data__');
    if (idx !== -1) {
      const start = html.indexOf('{', idx);
      const end = html.indexOf('</script>', start);
      if (start !== -1 && end !== -1) {
        const candidate = html.substring(start, end);
        const parsed = this.parseJsonSafely(candidate);
        if (parsed) return parsed;
      }
    }

    const match = html.match(/window\.__initialize_data__\s*=\s*(\{.*?\})\s*(?:;|<\/script>)/s);
    if (match) {
      return this.parseJsonSafely(match[1]);
    }

    return null;
  }

  async extract(url: string, html: string): Promise<RawExtractedArticle> {
    const initData = this.extractInitializeData(html);

    if (initData) {
      // 1. Check standard blog post details: postData.data
      const postBundle = initData.postData?.data;
      if (postBundle) {
        const blogInfo: LofterBlogInfo = postBundle.blogInfo || {};
        const author = blogInfo.blogNickName || blogInfo.blogName || '';
        const postView: LofterPostView = postBundle.postData?.postView || {};

        let title = postView.title?.trim() || postView.digest?.trim() || '';
        if (title) {
          title = title.replace(/<[^>]+>/g, '').trim();
        }

        // Unix seconds or ms; normalized to ISO 8601 by the dispatcher
        const publishTime = postView.publishTime || postView.noticeTime;

        const htmlParts: string[] = [];
        let coverImage: string | undefined;

        // Article/Text post with full HTML content
        if (postView.content) {
          htmlParts.push(postView.content);
        }

        // Photo/Gallery post
        const photoPostView = postView.photoPostView;
        if (photoPostView) {
          const caption = (photoPostView.caption || '').trim();
          if (caption) {
            htmlParts.push(`<div class="lofter-caption">${caption}</div>`);
          }

          const photoLinks = Array.isArray(photoPostView.photoLinks) ? photoPostView.photoLinks : [];
          for (const item of photoLinks) {
            const rawUrl = item?.raw || item?.orign || item?.origin;
            const cleaned = this.cleanImageUrl(rawUrl);
            if (cleaned) {
              if (!coverImage) coverImage = cleaned;
              htmlParts.push(`<p><img src="${cleaned}" referrerpolicy="no-referrer" /></p>`);
            }
          }

          if (!coverImage) {
            const firstImg = photoPostView.firstImage || postView.firstImage;
            const firstRaw = firstImg?.raw || firstImg?.orign || firstImg?.origin;
            coverImage = this.cleanImageUrl(firstRaw);
          }
        }

        // Video post
        const videoPostView = postView.videoPostView;
        if (videoPostView) {
          const caption = (videoPostView.caption || '').trim();
          if (caption) {
            htmlParts.push(`<div class="lofter-caption">${caption}</div>`);
          }
          const videoInfo = videoPostView.videoInfo || {};
          const videoUrl = videoInfo.originUrl || videoInfo.flashurl;
          if (videoUrl) {
            htmlParts.push(`<p><video src="${videoUrl}" controls></video></p>`);
          }
        }

        if (!title) {
          title = '网易LOFTER文章';
        }

        return {
          title,
          author,
          publish_time: publishTime,
          cover_image: coverImage,
          content_html: htmlParts.join('\n'),
        };
      }

      // 2. Compatible with Q&A / Answer detail: answerDetailData
      if (initData.answerDetailData) {
        const ans = initData.answerDetailData;
        const blogInfo: LofterBlogInfo = ans.blogInfo || {};
        const author = blogInfo.blogNickName || blogInfo.blogName || '';
        const title = (ans.barrage || ans.answer || '网易LOFTER问答').replace(/<[^>]+>/g, '').trim();

        const htmlParts: string[] = [];
        if (ans.answer) {
          htmlParts.push(`<p>${ans.answer}</p>`);
        }
        for (const img of ans.images || []) {
          const rawUrl = img?.orign || img?.raw;
          const cleaned = this.cleanImageUrl(rawUrl);
          if (cleaned) {
            htmlParts.push(`<p><img src="${cleaned}" referrerpolicy="no-referrer" /></p>`);
          }
        }

        return {
          title,
          author,
          content_html: htmlParts.join('\n'),
        };
      }
    }

    // Fallback: DOM parsing
    const $ = cheerio.load(html);
    const title = this.getMetaContent($, 'og:title') || $('title').text().replace(/-.*LOFTER.*/, '').trim() || '网易LOFTER文章';
    const author = $('.w-author, .author, .user-name').first().text().trim() || this.getMetaContent($, 'author') || '';
    const coverImage = this.cleanImageUrl(this.getMetaContent($, 'og:image'));

    const contentDom = $('.ct .text, .post .content, .rich-text, #content, .content').first();
    this.removeNoiseElements($, contentDom);

    // Clean image URLs in DOM
    contentDom.find('img').each((_, el) => {
      const $img = $(el);
      const raw = $img.attr('src') || $img.attr('data-src');
      if (raw) {
        $img.attr('src', this.cleanImageUrl(raw)!);
      }
    });

    return {
      title,
      author,
      cover_image: coverImage,
      content_html: contentDom.html() || '',
    };
  }
}
