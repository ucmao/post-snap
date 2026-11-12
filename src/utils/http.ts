import got from 'got';
import { gotScraping } from 'got-scraping';
import { config } from '../config.js';
import { guardRedirect, setSkipDnsCheck } from './url-guard.js';

/**
 * Single HTTP entry point for all page / platform-API requests.
 *
 * Centralizing requests here gives us:
 *  - consistent timeouts and SSRF-safe redirect handling
 *  - record / replay ("cassette") support, so real platform responses can be
 *    snapshotted once and replayed offline in regression tests.
 */
export interface HttpRequestOptions {
  url: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  /** JSON request body (POST) */
  json?: unknown;
  /**
   * 'scraping' (default): got-scraping with generated real-browser headers/TLS fingerprint.
   * 'plain': plain got, only the headers you pass.
   */
  client?: 'scraping' | 'plain';
  /** got-scraping header generator options, e.g. { devices: ['mobile'] } */
  headerGeneratorOptions?: Record<string, unknown>;
  retry?: number;
}

export interface HttpResponse {
  statusCode: number;
  body: string;
  /** Final URL after redirects */
  url: string;
}

export class HttpStatusError extends Error {
  constructor(public statusCode: number, public url: string) {
    super(`HTTP ${statusCode} from ${url}`);
    this.name = 'HttpStatusError';
  }
}

// ---------------------------------------------------------------------------
// Cassette (record / replay)
// ---------------------------------------------------------------------------

export interface CassetteEntry {
  method: string;
  url: string;
  requestBody?: string;
  statusCode: number;
  finalUrl: string;
  body: string;
}

interface Cassette {
  mode: 'record' | 'replay';
  entries: CassetteEntry[];
}

let cassette: Cassette | null = null;

/** Start recording (entries = []) or replaying (entries = previously recorded). */
export function useCassette(mode: 'record' | 'replay', entries: CassetteEntry[] = []): void {
  cassette = { mode, entries: mode === 'replay' ? [...entries] : [] };
  setSkipDnsCheck(mode === 'replay');
}

/** Stop the active cassette and return its entries (the recording, in record mode). */
export function ejectCassette(): CassetteEntry[] {
  const entries = cassette?.entries ?? [];
  cassette = null;
  setSkipDnsCheck(false);
  return entries;
}

export function isReplaying(): boolean {
  return cassette?.mode === 'replay';
}

function requestKey(method: string, url: string, body?: string): string {
  return `${method} ${url} ${body ?? ''}`;
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

export async function httpRequest(opts: HttpRequestOptions): Promise<HttpResponse> {
  const method = opts.method ?? 'GET';
  const requestBody = opts.json === undefined ? undefined : JSON.stringify(opts.json);

  if (cassette?.mode === 'replay') {
    const key = requestKey(method, opts.url, requestBody);
    const hit = cassette.entries.find(e => requestKey(e.method, e.url, e.requestBody) === key);
    if (!hit) throw new Error(`[cassette] No recorded response for ${method} ${opts.url}`);
    return { statusCode: hit.statusCode, body: hit.body, url: hit.finalUrl };
  }

  const common = {
    method,
    headers: opts.headers ?? {},
    json: opts.json as Record<string, unknown> | undefined,
    timeout: { request: config.requestTimeout },
    retry: { limit: opts.retry ?? 1 },
    maxRedirects: 5,
    hooks: { beforeRedirect: [guardRedirect] },
    throwHttpErrors: false,
    responseType: 'text' as const,
  };

  const response = opts.client === 'plain'
    ? await got(opts.url, common)
    : await gotScraping({
        url: opts.url,
        ...common,
        headerGeneratorOptions: opts.headerGeneratorOptions ?? {
          browsers: [{ name: 'chrome', minVersion: 120 }],
          devices: ['desktop'],
          locales: ['zh-CN', 'zh'],
        },
      });

  const result: HttpResponse = {
    statusCode: response.statusCode,
    body: String(response.body ?? ''),
    url: response.url,
  };

  if (cassette?.mode === 'record') {
    cassette.entries.push({
      method,
      url: opts.url,
      requestBody,
      statusCode: result.statusCode,
      finalUrl: result.url,
      body: result.body,
    });
  }

  return result;
}

/** Request and parse a JSON response. Throws HttpStatusError on non-2xx. */
export async function httpJson<T>(opts: HttpRequestOptions): Promise<T> {
  const res = await httpRequest({ ...opts, headers: { accept: 'application/json, text/plain, */*', ...opts.headers } });
  if (res.statusCode >= 400) throw new HttpStatusError(res.statusCode, opts.url);
  return JSON.parse(res.body) as T;
}

/** Request text. Throws HttpStatusError on non-2xx. */
export async function httpText(opts: HttpRequestOptions): Promise<string> {
  const res = await httpRequest(opts);
  if (res.statusCode >= 400) throw new HttpStatusError(res.statusCode, opts.url);
  return res.body;
}
