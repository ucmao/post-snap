import * as cheerio from 'cheerio';
import { BaseExtractor } from './base.js';
import { hostMatches } from '../utils/url-match.js';
import { RawExtractedArticle } from '../types/index.js';

export class XiaohongshuExtractor extends BaseExtractor {
  name = 'xiaohongshu';

  canHandle(url: string): boolean {
    return hostMatches(url, 'xiaohongshu.com', 'xhslink.com');
  }

  /**
   * Clean and transform Xiaohongshu image object/url into a high-res, unwatermarked JPG URL.
   */
  private cleanImageUrl(imgObjOrUrl: any): string | undefined {
    if (!imgObjOrUrl) return undefined;

    let fileId: string | undefined;
    let rawUrl: string | undefined;

    if (typeof imgObjOrUrl === 'object') {
      fileId = imgObjOrUrl.fileId;
      rawUrl = imgObjOrUrl.urlDefault || imgObjOrUrl.url;
      if (!rawUrl && Array.isArray(imgObjOrUrl.infoList) && imgObjOrUrl.infoList.length > 0) {
        rawUrl = imgObjOrUrl.infoList[imgObjOrUrl.infoList.length - 1]?.url || imgObjOrUrl.infoList[0]?.url;
      }
    } else if (typeof imgObjOrUrl === 'string') {
      rawUrl = imgObjOrUrl;
    }

    if (fileId) {
      return `https://sns-img-qc.xhscdn.com/${fileId}?imageView2/2/w/1920/format/jpg`;
    }

    if (!rawUrl) return undefined;

    const normalizedUrl = rawUrl.replace(/\\u002F/g, '/');
    const match = normalizedUrl.match(/\/([0-9a-f]{32})\/(.+?)(?:!|$)/);
    if (match && match[2]) {
      return `https://sns-img-qc.xhscdn.com/${match[2]}?imageView2/2/w/1920/format/jpg`;
    }

    // Strip image processing and watermark parameters
    return normalizedUrl.replace(/![^?#]*/, '');
  }

  private cleanAndParseJson(rawJsonStr: string): any {
    let jsonStr = rawJsonStr.trim().replace(/;\s*$/, '');
    jsonStr = jsonStr.replace(/\bundefined\b/g, 'null');
    jsonStr = jsonStr.replace(/new\s+Map\s*\([^)]*\)/g, '{}');
    jsonStr = jsonStr.replace(/new\s+Set\s*\([^)]*\)/g, '[]');
    jsonStr = jsonStr.replace(/new\s+Date\s*\([^)]*\)/g, 'null');

    let fullData: any = null;
    try {
      fullData = JSON.parse(jsonStr);
    } catch {
      try {
        const quoted = jsonStr.replace(/([{,]\s*)([a-zA-Z0-9_$]+)\s*:/g, '$1"$2":');
        fullData = JSON.parse(quoted);
      } catch {
        return null;
      }
    }

    if (!fullData) return null;

    // 1. PC Structure: fullData.note.noteDetailMap[firstNoteId].note
    const firstNoteId = fullData?.note?.firstNoteId;
    if (firstNoteId) {
      const noteItem = fullData?.note?.noteDetailMap?.[firstNoteId];
      if (noteItem?.note) {
        return noteItem.note;
      }
    }

    // 2. Mobile H5 Structure: fullData.noteData.data.noteData
    if (fullData?.noteData?.data?.noteData) {
      return fullData.noteData.data.noteData;
    }

    // 3. Fallback structures
    return fullData?.noteData?.note || fullData?.note?.note || null;
  }

  private extractNoteFromHtml(html: string): any {
    const idx = html.indexOf('window.__INITIAL_STATE__');
    if (idx !== -1) {
      const start = html.indexOf('{', idx);
      const end = html.indexOf('</script>', start);
      if (start !== -1 && end !== -1) {
        const jsonCandidate = html.substring(start, end);
        const parsed = this.cleanAndParseJson(jsonCandidate);
        if (parsed) return parsed;
      }
    }

    const pattern = /window\.__INITIAL_STATE__\s*=\s*(\{.*?\})\s*(?:;|<\/script>)/s;
    const match = pattern.exec(html) || /window\.__INITIAL_STATE__\s*=\s*(\{.*\})/s.exec(html);
    if (match) {
      return this.cleanAndParseJson(match[1]);
    }

    return null;
  }

  async extract(url: string, html: string): Promise<RawExtractedArticle> {
    const note = this.extractNoteFromHtml(html);

    if (note) {
      const title = note.title?.trim() || (note.desc ? note.desc.split('\n')[0].slice(0, 30) : '') || '小红书笔记';
      const user = note.user || {};
      const author = user.nickname || user.nickName || '';
      
      let publishTime: string | undefined;
      const rawTime = note.time || note.lastUpdateTime;
      if (rawTime) {
        const timestamp = typeof rawTime === 'number' ? rawTime : parseInt(rawTime, 10);
        if (!isNaN(timestamp)) {
          // If in seconds (10 digits), convert to ms
          const ms = timestamp < 1e11 ? timestamp * 1000 : timestamp;
          publishTime = new Date(ms).toISOString();
        }
      }

      // Extract high-res images
      const images: string[] = [];
      const imageList = Array.isArray(note.imageList) ? note.imageList : [];
      for (const img of imageList) {
        const clean = this.cleanImageUrl(img);
        if (clean && !images.includes(clean)) {
          images.push(clean);
        }
      }

      // Cover image
      const coverImage = this.cleanImageUrl(note.cover) || images[0];

      // Format description into rich text paragraphs
      const desc = note.desc?.trim() || '';
      const htmlParts: string[] = [];

      if (title && title !== '小红书笔记') {
        htmlParts.push(`<h2>${title}</h2>`);
      }

      if (desc) {
        const paragraphs = desc.split(/\n+/).filter(Boolean);
        for (const p of paragraphs) {
          htmlParts.push(`<p>${p}</p>`);
        }
      }

      // Append article gallery images
      for (const imgUrl of images) {
        htmlParts.push(`<p><img src="${imgUrl}" referrerpolicy="no-referrer" alt="${title}" /></p>`);
      }

      return {
        title,
        author,
        publish_time: publishTime,
        cover_image: coverImage,
        content_html: htmlParts.join('\n'),
        platform: '小红书',
      };
    }

    // Fallback: HTML DOM parsing
    const $ = cheerio.load(html);
    const title = this.getMetaContent($, 'og:title') || $('title').text().replace(/- 小红书.*/, '').trim() || '小红书笔记';
    const author = $('.author-name, .username, .nickname').first().text().trim() || this.getMetaContent($, 'author') || '';
    const coverImage = this.getMetaContent($, 'og:image');

    const desc = $('.note-text, .desc, .content').text().trim() || this.getMetaContent($, 'og:description') || '';
    const htmlParts: string[] = [];
    if (desc) {
      htmlParts.push(`<p>${desc}</p>`);
    }

    $('img').each((_, el) => {
      const src = $(el).attr('src');
      if (src && src.includes('xhscdn.com')) {
        const cleaned = this.cleanImageUrl(src);
        if (cleaned) {
          htmlParts.push(`<p><img src="${cleaned}" referrerpolicy="no-referrer" /></p>`);
        }
      }
    });

    return {
      title,
      author,
      cover_image: coverImage,
      content_html: htmlParts.join('\n'),
      platform: '小红书',
    };
  }
}
