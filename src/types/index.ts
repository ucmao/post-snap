/**
 * Request options for article extraction
 */
export interface ExtractOptions {
  /** Target article URL */
  url: string;
  /**
   * Whether to download external images and re-host them to avoid anti-hotlinking
   * @default false
   */
  upload_images?: boolean;
  /**
   * Storage backend for re-hosted images
   * @default 'local'
   */
  image_storage?: 'local' | 'base64';
  /**
   * Output content format
   * @default 'both'
   */
  format?: 'html' | 'markdown' | 'both';
  /**
   * Whether to strip inline CSS styles from tags
   * If true: keeps clean semantic HTML tags
   * If false: retains original inline typography styles (great for WeChat articles)
   * @default false
   */
  clean_styles?: boolean;
  /**
   * Whether to format markdown with structured article header (Title, Author, Date, Source)
   * @default true
   */
  markdown_header?: boolean;
}

/**
 * Image metadata extracted from the article
 */
export interface ExtractedImage {
  original_url: string;
  rehosted_url?: string;
  alt?: string;
}

/**
 * Standard article extraction result
 */
export interface ExtractedArticle {
  title: string;
  author?: string;
  publish_time?: string;
  source_url: string;
  platform: string;
  cover_image?: string;
  images: ExtractedImage[];
  html?: string;
  markdown?: string;
  text?: string;
  word_count?: number;
}

/**
 * Unified API Response structure
 */
export interface ApiResponse<T> {
  code: number;
  message: string;
  data?: T;
  error?: string;
}

/**
 * Interface for platform-specific and generic extractors
 */
export interface IExtractor {
  name: string;
  /** Return true if this extractor can handle the given URL */
  canHandle(url: string): boolean;
  /** Extract raw article details from HTML */
  extract(url: string, html: string): Promise<RawExtractedArticle>;
}

/**
 * Raw article data returned by an extractor before post-processing
 */
export interface RawExtractedArticle {
  title: string;
  author?: string;
  publish_time?: string;
  cover_image?: string;
  content_html: string;
  platform: string;
}

/**
 * Image storage provider interface
 */
export interface IStorageProvider {
  name: string;
  /**
   * Save an image buffer and return an accessible URL or Base64 URI
   */
  save(buffer: Buffer, mimeType: string, filenameHint?: string): Promise<string>;
}
