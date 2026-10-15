import { IExtractor, RawExtractedArticle } from '../types/index.js';
import * as cheerio from 'cheerio';

export abstract class BaseExtractor implements IExtractor {
  abstract name: string;
  abstract canHandle(url: string): boolean;
  abstract extract(url: string, html: string): Promise<RawExtractedArticle>;

  /**
   * Helper to clean common noisy DOM elements before content extraction
   */
  protected removeNoiseElements($: cheerio.CheerioAPI, root: cheerio.Cheerio<any>) {
    root.find('script, style, noscript, svg, button, form, iframe[src=""], [style*="display: none"], [style*="display:none"]').remove();
  }

  /**
   * Helper to extract common meta tags
   */
  protected getMetaContent($: cheerio.CheerioAPI, property: string): string | undefined {
    return $(`meta[property="${property}"]`).attr('content') ||
           $(`meta[name="${property}"]`).attr('content') ||
           undefined;
  }
}
