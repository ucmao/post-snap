import crypto from 'node:crypto';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config.js';

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

function readApiKey(request: FastifyRequest): string {
  const header = request.headers['x-api-key'];
  if (typeof header === 'string' && header) return header.trim();

  const auth = request.headers['authorization'];
  if (typeof auth === 'string' && /^Bearer\s+/i.test(auth)) return auth.replace(/^Bearer\s+/i, '').trim();

  const query = request.query as Record<string, unknown> | undefined;
  if (query && typeof query.api_key === 'string') return query.api_key.trim();

  return '';
}

/**
 * Simple fixed-window, in-memory rate limiter keyed by client IP.
 * Good enough for a single instance; use a shared store (Redis) when scaling out.
 */
function createRateLimiter(limitPerMinute: number) {
  const windows = new Map<string, { start: number; count: number }>();
  const WINDOW_MS = 60_000;

  setInterval(() => {
    const now = Date.now();
    for (const [key, w] of windows) {
      if (now - w.start >= WINDOW_MS) windows.delete(key);
    }
  }, WINDOW_MS).unref();

  return (key: string): { allowed: boolean; remaining: number; resetSec: number } => {
    const now = Date.now();
    let w = windows.get(key);
    if (!w || now - w.start >= WINDOW_MS) {
      w = { start: now, count: 0 };
      windows.set(key, w);
    }
    w.count++;
    return {
      allowed: w.count <= limitPerMinute,
      remaining: Math.max(0, limitPerMinute - w.count),
      resetSec: Math.ceil((w.start + WINDOW_MS - now) / 1000),
    };
  };
}

/**
 * Registers API-key auth and rate limiting for routes under /api/.
 * Health checks and /uploads/ static files are not affected.
 */
export function registerSecurity(server: FastifyInstance) {
  const limiter = config.rateLimitPerMinute > 0 ? createRateLimiter(config.rateLimitPerMinute) : null;

  if (config.apiKeys.length === 0) {
    server.log.warn('⚠️  API_KEY is not set: /api/v1/extract is open to anyone. Set API_KEY before exposing this service publicly.');
  }

  server.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.url.startsWith('/api/') || request.method === 'OPTIONS') return;

    if (config.apiKeys.length > 0) {
      const provided = readApiKey(request);
      if (!provided || !config.apiKeys.some(k => safeEqual(k, provided))) {
        return reply.status(401).send({ code: 401, message: 'Unauthorized: missing or invalid API key' });
      }
    }

    if (limiter) {
      const result = limiter(request.ip);
      reply.header('X-RateLimit-Limit', config.rateLimitPerMinute);
      reply.header('X-RateLimit-Remaining', result.remaining);
      if (!result.allowed) {
        reply.header('Retry-After', result.resetSec);
        return reply.status(429).send({ code: 429, message: 'Too many requests, please retry later' });
      }
    }
  });
}
