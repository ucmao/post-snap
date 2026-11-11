import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { gotScraping } from 'got-scraping';
import * as cheerio from 'cheerio';
import { ExtractOptions, ApiResponse, ExtractedArticle, ExtractedImage } from '../types/index.js';
import { resolveExtractor } from '../extractors/index.js';
import { assertSafeUrl, guardRedirect, UnsafeUrlError } from '../utils/url-guard.js';
import { cleanHtml } from '../services/html-cleaner.js';
import { convertHtmlToMarkdown } from '../services/markdown.js';
import { processAndRehostImages } from '../services/image-downloader.js';
import { getStorageProvider } from '../services/storage/index.js';
import { config } from '../config.js';
import { hostMatches } from '../utils/url-match.js';

/** Find an SSRF-guard rejection anywhere in the error cause chain (got wraps hook errors). */
function findUnsafeUrlError(err: any): Error | null {
  for (let e = err, depth = 0; e && depth < 5; e = e.cause, depth++) {
    if (e instanceof UnsafeUrlError || e.name === 'UnsafeUrlError' || e.code === 'EPRIVATEADDR') return e;
  }
  return null;
}

/**
 * Core extraction executor shared by both GET and POST endpoints
 */
async function executeExtraction(options: ExtractOptions, log: any): Promise<ApiResponse<ExtractedArticle>> {
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

  const targetUrl = url.trim();

  // 0. SSRF guard: only public http(s) hosts
  await assertSafeUrl(targetUrl);

  const extractor = resolveExtractor(targetUrl);

  // 1. Fetch remote article HTML with real browser fingerprints
  //    (skipped for extractors that call a platform API themselves)
  let rawHtml = '';
  if (!extractor.selfFetch) {
    const customHeaders: Record<string, string> = {};
    if (hostMatches(targetUrl, 'zhihu.com') && config.zhihuCookie) {
      customHeaders['cookie'] = config.zhihuCookie;
    }

    const response = await gotScraping({
      url: targetUrl,
      headers: customHeaders,
      headerGeneratorOptions: {
        browsers: [{ name: 'chrome', minVersion: 120 }],
        devices: ['desktop'],
        locales: ['zh-CN', 'zh'],
      },
      timeout: { request: config.requestTimeout },
      retry: { limit: 1 },
      maxRedirects: 5,
      hooks: { beforeRedirect: [guardRedirect as any] },
      throwHttpErrors: false,
    });

    if (response.statusCode >= 400) {
      return {
        code: 502,
        message: `Upstream returned HTTP ${response.statusCode}. The page may be blocked by anti-bot protection, require login, or no longer exist.`,
      };
    }

    rawHtml = response.body;
    if (!rawHtml || !rawHtml.trim()) {
      return { code: 502, message: 'Upstream returned an empty response body.' };
    }
  }

  // 2. Run the matched extractor
  const rawArticle = await extractor.extract(targetUrl, rawHtml);

  let processedHtml = rawArticle.content_html;
  let finalImages: ExtractedImage[] = [];

  // 3. Handle Images (Re-host or ensure safe referrers)
  if (upload_images) {
    const storageProvider = getStorageProvider(image_storage);
    const imageResult = await processAndRehostImages(processedHtml, storageProvider, targetUrl);
    processedHtml = imageResult.html;
    finalImages = imageResult.images;
  } else {
    // Just extract existing images and add referrerpolicy="no-referrer"
    const $ = cheerio.load(processedHtml, null, false);
    $('img').each((_, el) => {
      const src = $(el).attr('src')?.trim();
      if (src) {
        $(el).attr('referrerpolicy', 'no-referrer');
        finalImages.push({
          original_url: src,
          alt: $(el).attr('alt') || '',
        });
      }
    });
    processedHtml = $.html();
  }

  // 4. Clean HTML for Rich-Text Editors
  const finalCleanHtml = cleanHtml(processedHtml, { cleanStyles: clean_styles });

  // 5. Generate formats
  const needHtml = format === 'html' || format === 'both';
  const needMarkdown = format === 'markdown' || format === 'both';

  const markdownMeta = markdown_header !== false ? {
    title: rawArticle.title,
    author: rawArticle.author,
    publish_time: rawArticle.publish_time,
    source_url: targetUrl,
    platform: rawArticle.platform,
  } : undefined;

  const markdownContent = needMarkdown ? convertHtmlToMarkdown(finalCleanHtml, markdownMeta) : undefined;

  // Calculate plain text and word count
  const $text = cheerio.load(finalCleanHtml, null, false);
  const plainText = $text.text().trim();
  const wordCount = plainText.replace(/\s+/g, '').length;

  if (!plainText && finalImages.length === 0) {
    return {
      code: 422,
      message: 'No article content could be extracted from this URL. It may be a verification page, a login wall, or an unsupported page type.',
    };
  }

  const data: ExtractedArticle = {
    title: rawArticle.title,
    author: rawArticle.author,
    publish_time: rawArticle.publish_time,
    source_url: targetUrl,
    platform: rawArticle.platform,
    cover_image: rawArticle.cover_image,
    images: finalImages,
    html: needHtml ? finalCleanHtml : undefined,
    markdown: markdownContent,
    text: plainText,
    word_count: wordCount,
  };

  return {
    code: 200,
    message: 'success',
    data,
  };
}

export async function extractRoutes(fastify: FastifyInstance) {
  // 1. POST Endpoint (Standard JSON body)
  fastify.post('/api/v1/extract', async (request: FastifyRequest<{ Body: ExtractOptions }>, reply: FastifyReply) => {
    try {
      const result = await executeExtraction(request.body || ({} as any), request.log);
      return reply.status(result.code).send(result);
    } catch (err: any) {
      const unsafe = findUnsafeUrlError(err);
      if (unsafe) {
        return reply.status(400).send({ code: 400, message: unsafe.message } as ApiResponse<null>);
      }
      request.log.error(err);
      return reply.status(500).send({
        code: 500,
        message: `Failed to extract article: ${err.message || 'Internal Server Error'}`,
        error: err.code || err.name,
      } as ApiResponse<null>);
    }
  });

  // 2. GET Endpoint (Convenient for browser testing or simple GET callers)
  fastify.get('/api/v1/extract', async (request: FastifyRequest<{ Querystring: Record<string, string> }>, reply: FastifyReply) => {
    try {
      const query = request.query || {};
      let targetUrl = query.url;

      // Smart fallback: If caller passed directly `?https://...` without `url=` key
      if (!targetUrl) {
        const rawQuery = (request.url.split('?')[1] || '').trim();
        const decoded = decodeURIComponent(rawQuery);
        if (/^https?:\/\//i.test(decoded)) {
          targetUrl = decoded;
        }
      }

      const uploadImages = query.upload_images === 'true' || query.upload_images === '1';
      const cleanStyles = query.clean_styles === 'true' || query.clean_styles === '1';
      const markdownHeader = query.markdown_header !== 'false' && query.markdown_header !== '0';
      const format = (query.format as any) || 'both';
      const imageStorage = (query.image_storage as any) || config.defaultImageStorage;

      const options: ExtractOptions = {
        url: targetUrl || '',
        upload_images: uploadImages,
        clean_styles: cleanStyles,
        markdown_header: markdownHeader,
        format,
        image_storage: imageStorage,
      };

      const result = await executeExtraction(options, request.log);
      return reply.status(result.code).send(result);
    } catch (err: any) {
      const unsafe = findUnsafeUrlError(err);
      if (unsafe) {
        return reply.status(400).send({ code: 400, message: unsafe.message } as ApiResponse<null>);
      }
      request.log.error(err);
      return reply.status(500).send({
        code: 500,
        message: `Failed to extract article: ${err.message || 'Internal Server Error'}`,
        error: err.code || err.name,
      } as ApiResponse<null>);
    }
  });
}
