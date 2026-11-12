import type { FastifyBaseLogger } from 'fastify';

/**
 * Shared application logger.
 *
 * At startup the server calls `setLogger(server.log)` so every module logs through
 * Fastify's pino instance (structured JSON in production, pino-pretty in dev).
 * Before that (unit tests, CLI scripts) it falls back to a minimal console logger.
 */
type LogFn = (objOrMsg: object | string, msg?: string) => void;

export interface AppLogger {
  debug: LogFn;
  info: LogFn;
  warn: LogFn;
  error: LogFn;
}

function consoleFn(level: 'debug' | 'info' | 'warn' | 'error'): LogFn {
  return (objOrMsg, msg) => {
    if (level === 'debug' && !process.env.DEBUG) return;
    const out = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    if (typeof objOrMsg === 'string') out(`[${level}] ${objOrMsg}`);
    else out(`[${level}] ${msg ?? ''}`, objOrMsg);
  };
}

let current: AppLogger = {
  debug: consoleFn('debug'),
  info: consoleFn('info'),
  warn: consoleFn('warn'),
  error: consoleFn('error'),
};

export function setLogger(log: FastifyBaseLogger): void {
  const child = log.child({ module: 'post-snap' });
  current = {
    debug: (o, m) => (typeof o === 'string' ? child.debug(o) : child.debug(o, m)),
    info: (o, m) => (typeof o === 'string' ? child.info(o) : child.info(o, m)),
    warn: (o, m) => (typeof o === 'string' ? child.warn(o) : child.warn(o, m)),
    error: (o, m) => (typeof o === 'string' ? child.error(o) : child.error(o, m)),
  };
}

/** Proxy object so imports stay valid after setLogger() swaps the implementation. */
export const logger: AppLogger = {
  debug: (o, m) => current.debug(o, m),
  info: (o, m) => current.info(o, m),
  warn: (o, m) => current.warn(o, m),
  error: (o, m) => current.error(o, m),
};

/** Extract a readable message from an unknown thrown value. */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}
