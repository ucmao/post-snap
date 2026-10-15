import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import fs from 'node:fs';
import { config } from './config.js';
import { healthRoutes } from './routes/health.js';
import { extractRoutes } from './routes/extract.js';

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
    bodyLimit: 10 * 1024 * 1024, // 10MB
  });

  // 1. Enable CORS for front-end admin dashboard access
  await server.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'OPTIONS'],
  });

  // 2. Ensure uploads directory exists and register static file server
  if (!fs.existsSync(config.uploadsDir)) {
    fs.mkdirSync(config.uploadsDir, { recursive: true });
  }

  await server.register(fastifyStatic, {
    root: config.uploadsDir,
    prefix: '/uploads/',
  });

  // 3. Register Routes
  await server.register(healthRoutes);
  await server.register(extractRoutes);

  // 4. Start Server
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
