import { FastifyInstance } from 'fastify';
import { ExtractOptions } from '../types/index.js';
import { executeExtraction, errorToResponse } from '../services/extract-service.js';
import { config } from '../config.js';

type QueryParams = Partial<Record<'url' | 'format' | 'image_storage' | 'upload_images' | 'clean_styles' | 'markdown_header' | 'api_key', string>>;

const truthy = (v: string | undefined) => v === 'true' || v === '1';

export async function extractRoutes(fastify: FastifyInstance) {
  // 1. POST Endpoint (Standard JSON body)
  fastify.post<{ Body: Partial<ExtractOptions> | undefined }>('/api/v1/extract', async (request, reply) => {
    try {
      const body = request.body ?? {};
      const result = await executeExtraction({ ...body, url: body.url ?? '' });
      return reply.status(result.code).send(result);
    } catch (err) {
      const result = errorToResponse(err);
      if (result.code >= 500) request.log.error(err);
      return reply.status(result.code).send(result);
    }
  });

  // 2. GET Endpoint (Convenient for browser testing or simple GET callers)
  fastify.get<{ Querystring: QueryParams }>('/api/v1/extract', async (request, reply) => {
    try {
      const query = request.query ?? {};
      let targetUrl = query.url;

      // Smart fallback: caller passed `?https://...` directly without the `url=` key
      if (!targetUrl) {
        const rawQuery = (request.url.split('?')[1] || '').trim();
        const decoded = decodeURIComponent(rawQuery);
        if (/^https?:\/\//i.test(decoded)) {
          targetUrl = decoded;
        }
      }

      // format / image_storage are validated inside executeExtraction (400 on bad values)
      const result = await executeExtraction({
        url: targetUrl ?? '',
        upload_images: truthy(query.upload_images),
        clean_styles: truthy(query.clean_styles),
        markdown_header: query.markdown_header !== 'false' && query.markdown_header !== '0',
        format: (query.format ?? 'both') as ExtractOptions['format'],
        image_storage: (query.image_storage ?? config.defaultImageStorage) as ExtractOptions['image_storage'],
      });
      return reply.status(result.code).send(result);
    } catch (err) {
      const result = errorToResponse(err);
      if (result.code >= 500) request.log.error(err);
      return reply.status(result.code).send(result);
    }
  });
}
