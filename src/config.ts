import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3008', 10),
  host: process.env.HOST || '0.0.0.0',
  baseUrl: process.env.BASE_URL || 'http://localhost:3008',
  defaultImageStorage: (process.env.DEFAULT_IMAGE_STORAGE || 'local') as 'local' | 'base64',
  uploadsDir: path.resolve(process.cwd(), process.env.UPLOADS_DIR || './uploads'),
  maxImageSizeBytes: parseInt(process.env.MAX_IMAGE_SIZE_BYTES || '10485760', 10),
  maxImagesPerArticle: parseInt(process.env.MAX_IMAGES_PER_ARTICLE || '100', 10),
  requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || '15000', 10),

  // Security
  /** Comma-separated API keys. Empty = no authentication (only for local/dev use). */
  apiKeys: (process.env.API_KEY || '').split(',').map(s => s.trim()).filter(Boolean),
  /** Requests per minute per IP on /api/v1/extract. 0 disables rate limiting. */
  rateLimitPerMinute: parseInt(process.env.RATE_LIMIT_PER_MINUTE || '30', 10),
  /** Comma-separated allowed CORS origins. Empty = allow all. */
  corsOrigins: (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean),
  /** Trust X-Forwarded-For (set to true when running behind Nginx / a load balancer). */
  trustProxy: process.env.TRUST_PROXY === 'true',
  /** Allow fetching private / intranet addresses. Keep false on public deployments. */
  allowPrivateNetwork: process.env.ALLOW_PRIVATE_NETWORK === 'true',

  // Optional platform cookies for accounts/login-only articles
  zhihuCookie: process.env.ZHIHU_COOKIE || '',
};
