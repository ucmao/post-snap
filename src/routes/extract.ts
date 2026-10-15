import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import got from 'got';
import * as cheerio from 'cheerio';
import { ExtractOptions, ApiResponse, ExtractedArticle, ExtractedImage } from '../types/index.js';
import { dispatchExtract } from '../extractors/index.js';
import { cleanHtml } from '../services/html-cleaner.js';
import { convertHtmlToMarkdown } from '../services/markdown.js';
import { processAndRehostImages } from '../services/image-downloader.js';
import { getStorageProvider } from '../services/storage/index.js';
import { config } from '../config.js';

export async function extractRoutes(fastify: FastifyInstance) {
  fastify.post('/api/v1/extract', async (request: FastifyRequest<{ Body: ExtractOptions }>, reply: FastifyReply) => {
    const {
      url,
      upload_images = false,
      image_storage = config.defaultImageStorage,
      format = 'both',
      clean_styles = false,
    } = request.body || {};

    // 1. Parameter Validation
    if (!url || typeof url !== 'string' || !/^https?:\/\//i.test(url.trim())) {
      return reply.status(400).send({
        code: 400,
        message: 'Invalid or missing "url" parameter. Must be a valid HTTP/HTTPS URL.',
      } as ApiResponse<null>);
    }

    const targetUrl = url.trim();

    try {
      // 2. Fetch remote article HTML
      const response = await got(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        },
        timeout: { request: config.requestTimeout },
        retry: { limit: 1 },
      });

      const rawHtml = response.body;

      // 3. Dispatch to appropriate extractor
      const rawArticle = await dispatchExtract(targetUrl, rawHtml);

      let processedHtml = rawArticle.content_html;
      let finalImages: ExtractedImage[] = [];

      // 4. Handle Images (Re-host or ensure safe referrers)
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

      // 5. Clean HTML for Rich-Text Editors
      const finalCleanHtml = cleanHtml(processedHtml, { cleanStyles: clean_styles });

      // 6. Generate formats
      const needHtml = format === 'html' || format === 'both';
      const needMarkdown = format === 'markdown' || format === 'both';

      const markdownContent = needMarkdown ? convertHtmlToMarkdown(finalCleanHtml) : undefined;

      // Calculate plain text and word count
      const $text = cheerio.load(finalCleanHtml, null, false);
      const plainText = $text.text().trim();
      const wordCount = plainText.replace(/\s+/g, '').length;

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

      return reply.send({
        code: 200,
        message: 'success',
        data,
      } as ApiResponse<ExtractedArticle>);

    } catch (err: any) {
      request.log.error(err);
      return reply.status(500).send({
        code: 500,
        message: `Failed to extract article: ${err.message || 'Internal Server Error'}`,
        error: err.code || err.name,
      } as ApiResponse<null>);
    }
  });
}
