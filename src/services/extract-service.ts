import * as cheerio from 'cheerio';
import { ExtractOptions, ApiResponse, ExtractedArticle, ExtractedImage } from '../types/index.js';
import { resolveExtractor, runExtractor } from '../extractors/index.js';
import { assertSafeUrl, UnsafeUrlError } from '../utils/url-guard.js';
import { httpRequest } from '../utils/http.js';
import { hostMatches } from '../utils/url-match.js';
import { formatCnDateTime } from '../utils/time.js';
import { errorMessage } from '../utils/logger.js';
import { cleanHtml } from './html-cleaner.js';
import { convertHtmlToMarkdown } from './markdown.js';
import { processAndRehostImages } from './image-downloader.js';
import { getStorageProvider } from './storage/index.js';
import { config } from '../config.js';

const FORMATS = ['html', 'markdown', 'both'] as const;
const STORAGES = ['local', 'base64'] as const;

type Format = (typeof FORMATS)[number];
type Storage = (typeof STORAGES)[number];

export function isFormat(v: unknown): v is Format {
  return typeof v === 'string' && (FORMATS as readonly string[]).includes(v);
}

export function isStorage(v: unknown): v is Storage {
  return typeof v === 'string' && (STORAGES as readonly string[]).includes(v);
}

/** Find an SSRF-guard rejection anywhere in the error cause chain (got wraps hook errors). */
export function findUnsafeUrlError(err: unknown): Error | null {
  let e: unknown = err;
  for (let depth = 0; e && depth < 5; depth++) {
    if (e instanceof UnsafeUrlError) return e;
    if (e instanceof Error) {
      if (e.name === 'UnsafeUrlError' || (e as NodeJS.ErrnoException).code === 'EPRIVATEADDR') return e;
      e = e.cause;
    } else {
      break;
    }
  }
  return null;
}

/** Convert any thrown error into an API response. */
export function errorToResponse(err: unknown): ApiResponse<null> {
  const unsafe = findUnsafeUrlError(err);
  if (unsafe) return { code: 400, message: unsafe.message };
  const e = err instanceof Error ? (err as NodeJS.ErrnoException) : undefined;
  return {
    code: 500,
    message: `Failed to extract article: ${errorMessage(err) || 'Internal Server Error'}`,
    error: e?.code || e?.name,
  };
}

/**
 * Core extraction pipeline shared by the GET / POST endpoints and the fixture tools:
 * SSRF check → fetch page → platform extractor → images → clean HTML → Markdown.
 */
export async function executeExtraction(options: ExtractOptions): Promise<ApiResponse<ExtractedArticle>> {
  const {
    url,
    upload_images = false,
    image_storage = config.defaultImageStorage,
    format = 'both',
    clean_styles = false,
    markdown_header = true,
  } = options;

  if (!url || typeof url !== 'string' || !/^https?:\/\//i.test(url.trim())) {
    return {
      code: 400,
      message: 'Invalid or missing "url" parameter. Must be a valid HTTP/HTTPS URL.',
    };
  }
  if (!isFormat(format)) {
    return { code: 400, message: `Invalid "format": must be one of ${FORMATS.join(', ')}` };
  }
  if (!isStorage(image_storage)) {
    return { code: 400, message: `Invalid "image_storage": must be one of ${STORAGES.join(', ')}` };
  }

  const targetUrl = url.trim();

  // 0. SSRF guard: only public http(s) hosts
  await assertSafeUrl(targetUrl);

  const extractor = resolveExtractor(targetUrl);

  // 1. Fetch the article page with real browser fingerprints
  //    (skipped for extractors that call a platform API themselves)
  let rawHtml = '';
  if (!extractor.selfFetch) {
    const headers: Record<string, string> = {};
    if (hostMatches(targetUrl, 'zhihu.com') && config.zhihuCookie) {
      headers['cookie'] = config.zhihuCookie;
    }

    const response = await httpRequest({ url: targetUrl, headers });

    if (response.statusCode >= 400) {
      return {
        code: 502,
        message: `Upstream returned HTTP ${response.statusCode}. The page may be blocked by anti-bot protection, require login, or no longer exist.`,
      };
    }

    rawHtml = response.body;
    if (!rawHtml.trim()) {
      return { code: 502, message: 'Upstream returned an empty response body.' };
    }
  }

  // 2. Run the matched extractor (platform + publish time are normalized here)
  const article = await runExtractor(extractor, targetUrl, rawHtml);

  let processedHtml = article.content_html;
  let finalImages: ExtractedImage[] = [];

  // 3. Images: re-host, or keep originals with a safe referrer policy
  if (upload_images) {
    const imageResult = await processAndRehostImages(processedHtml, getStorageProvider(image_storage), targetUrl);
    processedHtml = imageResult.html;
    finalImages = imageResult.images;
  } else {
    const $ = cheerio.load(processedHtml, null, false);
    $('img').each((_, el) => {
      const src = $(el).attr('src')?.trim();
      if (src) {
        $(el).attr('referrerpolicy', 'no-referrer');
        finalImages.push({ original_url: src, alt: $(el).attr('alt') || '' });
      }
    });
    processedHtml = $.html();
  }

  // 4. Clean HTML for rich-text editors
  const finalCleanHtml = cleanHtml(processedHtml, { cleanStyles: clean_styles });

  // 5. Output formats
  const needHtml = format === 'html' || format === 'both';
  const needMarkdown = format === 'markdown' || format === 'both';

  const markdownMeta = markdown_header !== false ? {
    title: article.title,
    author: article.author,
    publish_time: formatCnDateTime(article.publish_time) ?? article.publish_time_raw,
    source_url: targetUrl,
    platform: article.platform,
  } : undefined;

  const markdownContent = needMarkdown ? convertHtmlToMarkdown(finalCleanHtml, markdownMeta) : undefined;

  const plainText = cheerio.load(finalCleanHtml, null, false).text().trim();
  const wordCount = plainText.replace(/\s+/g, '').length;

  if (!plainText && finalImages.length === 0) {
    return {
      code: 422,
      message: 'No article content could be extracted from this URL. It may be a verification page, a login wall, or an unsupported page type.',
    };
  }

  return {
    code: 200,
    message: 'success',
    data: {
      title: article.title,
      author: article.author,
      publish_time: article.publish_time,
      publish_time_raw: article.publish_time_raw,
      source_url: targetUrl,
      platform_id: article.platform_id,
      platform: article.platform,
      cover_image: article.cover_image,
      images: finalImages,
      html: needHtml ? finalCleanHtml : undefined,
      markdown: markdownContent,
      text: plainText,
      word_count: wordCount,
    },
  };
}
