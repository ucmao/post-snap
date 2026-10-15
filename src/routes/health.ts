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
      name: 'post-snap',
      version: '1.0.0',
      description: 'PostSnap - Universal Article Content and Image Snapshot/Extractor Engine',
      endpoints: {
        extract: 'POST /api/v1/extract (or GET /api/v1/extract?url=...)',
        health: 'GET /health',
      },
      docs: 'https://github.com/your-org/post-snap',
    };
  });
}
