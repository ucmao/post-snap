import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import fs from 'node:fs';
import { config } from './config.js';
import { healthRoutes } from './routes/health.js';
import { extractRoutes } from './routes/extract.js';
import { registerSecurity } from './plugins/security.js';

async function bootstrap() {
  let loggerConfig: any = true;
  if (process.env.NODE_ENV !== 'production') {
    try {
      loggerConfig = {
        level: 'info',
        transport: {
          target: 'pino-pretty',
          options: { colorize: true }
        }
      };
    } catch {
      loggerConfig = true;
    }
  }

  const server = Fastify({
    logger: loggerConfig,
    bodyLimit: 1024 * 1024, // 1MB is plenty for a JSON body carrying a URL
    trustProxy: config.trustProxy,
  });

  // 1. Enable CORS for front-end admin dashboard access
  await server.register(cors, {
    origin: config.corsOrigins.length > 0 ? config.corsOrigins : true,
    methods: ['GET', 'POST', 'OPTIONS'],
  });

  // 2. Ensure uploads directory exists and register static file server
  if (!fs.existsSync(config.uploadsDir)) {
    fs.mkdirSync(config.uploadsDir, { recursive: true });
  }

  await server.register(fastifyStatic, {
    root: config.uploadsDir,
    prefix: '/uploads/',
    // Uploaded files are untrusted: never let the browser sniff/execute them
    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'none'; sandbox");
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    },
  });

  // 3. Auth + rate limiting for /api/*
  registerSecurity(server);

  // 4. Register Routes
  await server.register(healthRoutes);
  await server.register(extractRoutes);

  // 5. Start Server
  try {
    const address = await server.listen({
      port: config.port,
      host: config.host,
    });
    server.log.info(`🚀 Article Extractor API is running at: ${address}`);
    server.log.info(`📂 Uploads directory: ${config.uploadsDir}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

bootstrap();
