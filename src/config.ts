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
  requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || '15000', 10),

  // Optional platform cookies for accounts/login-only articles
  zhihuCookie: process.env.ZHIHU_COOKIE || '',
};
