import { FastifyInstance } from 'fastify';

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  });

  fastify.get('/', async () => {
    return {
      name: 'article-extractor-api',
      version: '1.0.0',
      description: 'Universal Article Content and Image Extraction API for Rich-Text Editors',
      endpoints: {
        extract: 'POST /api/v1/extract',
        health: 'GET /health',
      },
      docs: 'https://github.com/your-org/article-extractor-api',
    };
  });
}
