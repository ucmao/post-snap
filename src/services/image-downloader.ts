import got from 'got';
import * as cheerio from 'cheerio';
import { IStorageProvider, ExtractedImage } from '../types/index.js';
import { config } from '../config.js';

export interface ProcessImagesResult {
  html: string;
  images: ExtractedImage[];
}

/**
 * Downloads images, re-hosts them using the chosen storage provider,
 * and updates the image URLs in the HTML content.
 */
export async function processAndRehostImages(
  html: string,
  storageProvider: IStorageProvider,
  sourceUrl?: string
): Promise<ProcessImagesResult> {
  const $ = cheerio.load(html, null, false);
  const imgElements = $('img').toArray();
  const extractedImages: ExtractedImage[] = [];

  // Group images to process unique URLs once and replace everywhere
  const urlMap = new Map<string, string>(); // original -> rehosted

  // Concurrency limit helper
  const concurrency = 4;
  const uniqueUrls: string[] = [];

  for (const el of imgElements) {
    const src = $(el).attr('src')?.trim();
    if (src && (src.startsWith('http://') || src.startsWith('https://'))) {
      if (!uniqueUrls.includes(src)) {
        uniqueUrls.push(src);
      }
    }
  }

  // Helper to download and save an individual image
  async function downloadAndSave(imageUrl: string): Promise<string | null> {
    try {
      // Pick appropriate referer based on image host
      let referer = 'https://www.google.com';
      if (imageUrl.includes('qpic.cn') || imageUrl.includes('weixin.qq.com')) {
        referer = 'https://mp.weixin.qq.com/';
      } else if (imageUrl.includes('zhimg.com') || imageUrl.includes('zhihu.com')) {
        referer = 'https://www.zhihu.com/';
      } else if (imageUrl.includes('juejin.cn')) {
        referer = 'https://juejin.cn/';
      } else if (sourceUrl) {
        try {
          const parsed = new URL(sourceUrl);
          referer = `${parsed.protocol}//${parsed.host}/`;
        } catch {}
      }

      const res = await got(imageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Referer': referer,
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        },
        timeout: { request: config.requestTimeout },
      });

      const buffer = res.rawBody;
      if (buffer.length > config.maxImageSizeBytes) {
        console.warn(`[ImageProcessor] Image exceeds max size (${buffer.length} > ${config.maxImageSizeBytes}): ${imageUrl}`);
        return null;
      }

      const mimeType = (res.headers['content-type'] as string) || 'image/jpeg';
      const rehostedUrl = await storageProvider.save(buffer, mimeType);
      return rehostedUrl;
    } catch (err: any) {
      console.warn(`[ImageProcessor] Failed to download/save image: ${imageUrl}. Reason: ${err.message}`);
      return null;
    }
  }

  // Batch execution with concurrency pool
  for (let i = 0; i < uniqueUrls.length; i += concurrency) {
    const chunk = uniqueUrls.slice(i, i + concurrency);
    await Promise.all(
      chunk.map(async (url) => {
        const rehosted = await downloadAndSave(url);
        if (rehosted) {
          urlMap.set(url, rehosted);
        }
      })
    );
  }

  // Replace src attributes and collect image meta
  for (const el of imgElements) {
    const originalSrc = $(el).attr('src')?.trim();
    const alt = $(el).attr('alt') || '';

    if (originalSrc) {
      const rehosted = urlMap.get(originalSrc);
      if (rehosted) {
        $(el).attr('src', rehosted);
        $(el).removeAttr('data-src');
        $(el).removeAttr('data-actualsrc');
        // Ensure no-referrer attribute is also kept for maximum frontend display safety
        $(el).attr('referrerpolicy', 'no-referrer');

        extractedImages.push({
          original_url: originalSrc,
          rehosted_url: rehosted,
          alt,
        });
      } else {
        // Kept original but ensure safe referrer policy
        $(el).attr('referrerpolicy', 'no-referrer');
        extractedImages.push({
          original_url: originalSrc,
          alt,
        });
      }
    }
  }

  return {
    html: $.html(),
    images: extractedImages,
  };
}
