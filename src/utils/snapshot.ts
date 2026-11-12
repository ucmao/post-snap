import crypto from 'node:crypto';
import { ApiResponse, ExtractedArticle } from '../types/index.js';

/**
 * Compact, deterministic summary of an extraction result.
 * Used by the fixture recorder and the offline regression test.
 */
export interface ExtractionSnapshot {
  code: number;
  title?: string;
  author?: string;
  platform_id?: string;
  publish_time?: string;
  word_count?: number;
  image_count?: number;
  markdown_sha1?: string;
}

export function snapshotOf(result: ApiResponse<ExtractedArticle>): ExtractionSnapshot {
  const d = result.data;
  if (!d) return { code: result.code };
  const raw: ExtractionSnapshot = {
    code: result.code,
    title: d.title,
    author: d.author,
    platform_id: d.platform_id,
    publish_time: d.publish_time,
    word_count: d.word_count,
    image_count: d.images.length,
    markdown_sha1: d.markdown ? crypto.createHash('sha1').update(d.markdown).digest('hex') : undefined,
  };
  return Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== undefined)) as ExtractionSnapshot;
}

/** Same quality bar as the live benchmark: a real title and a meaningful amount of text. */
export function isGoodExtraction(result: ApiResponse<ExtractedArticle>): boolean {
  const d = result.data;
  return result.code === 200 && !!d && d.title !== '未命名文章' && (d.word_count ?? 0) > 30 && (d.markdown?.length ?? 0) > 50;
}
