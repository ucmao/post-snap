import TurndownService from 'turndown';
// @ts-ignore
import turndownPluginGfm from 'turndown-plugin-gfm';
import { logger, errorMessage } from '../utils/logger.js';

const { gfm } = turndownPluginGfm;

const turndownService = new TurndownService({
  headingStyle: 'atx',
  hr: '---',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '*',
  strongDelimiter: '**',
});

// Enable GFM plugin (GitHub Flavored Markdown: tables, strikethrough, task list items, etc.)
turndownService.use(gfm);

// Custom rules for image tags to ensure clean markdown without broken syntax
turndownService.addRule('preserveImages', {
  filter: 'img',
  replacement: (_content, node) => {
    const el = node as HTMLElement;
    const src = el.getAttribute('src') || el.getAttribute('data-src') || '';
    if (!src || src.startsWith('data:image/svg') || src.length > 500 && !src.startsWith('http')) {
      return '';
    }
    const alt = (el.getAttribute('alt') || '').replace(/[\[\]]/g, '').trim();
    const title = el.getAttribute('title');
    return title ? `\n\n![${alt}](${src} "${title}")\n\n` : `\n\n![${alt}](${src})\n\n`;
  }
});

export interface MarkdownArticleMeta {
  title?: string;
  author?: string;
  publish_time?: string;
  source_url?: string;
  platform?: string;
}

/**
 * Format and post-process generated markdown text
 */
export function postProcessMarkdown(markdown: string, meta?: MarkdownArticleMeta): string {
  let processed = markdown;

  // 1. Remove redundant empty bold/italic tokens (e.g. ****, ********)
  processed = processed.replace(/\*{4,}/g, '');
  processed = processed.replace(/_{4,}/g, '');

  // 2. Clean up awkward blockquotes with headers like "> ## " or "> # "
  processed = processed.replace(/^>\s*(#{1,6}\s+)/gm, '$1');

  // 3. Normalize multiple linebreaks (max 2 consecutive newlines)
  processed = processed.replace(/\r\n/g, '\n');
  processed = processed.replace(/\n{3,}/g, '\n\n');

  // 4. Remove leading/trailing whitespaces from each line
  processed = processed
    .split('\n')
    .map(line => (line.startsWith('    ') ? line : line.trimEnd()))
    .join('\n')
    .trim();

  // 5. If metadata is provided, build a beautiful structured header
  if (meta && meta.title && meta.title !== '未命名文章') {
    const headerLines: string[] = [];
    headerLines.push(`# ${meta.title}`);
    headerLines.push('');

    const metaItems: string[] = [];
    if (meta.author && meta.author.trim()) {
      metaItems.push(`**作者**：${meta.author.trim()}`);
    }
    if (meta.publish_time && meta.publish_time.trim()) {
      metaItems.push(`**发布时间**：${meta.publish_time.trim()}`);
    }
    if (meta.platform && meta.platform.trim()) {
      metaItems.push(`**来源平台**：${meta.platform.trim()}`);
    }
    if (meta.source_url && meta.source_url.trim()) {
      metaItems.push(`**原文链接**：[点击查看](${meta.source_url.trim()})`);
    }

    if (metaItems.length > 0) {
      headerLines.push(`> ${metaItems.join(' &nbsp;|&nbsp; ')}`);
      headerLines.push('');
      headerLines.push('---');
      headerLines.push('');
    }

    // Check if the body already starts with the same title as an H1
    const titleRegex = new RegExp(`^#\\s+${escapeRegex(meta.title)}\\s*\\n*`, 'i');
    processed = processed.replace(titleRegex, '').trim();

    processed = `${headerLines.join('\n')}\n\n${processed}`;
  }

  return processed.trim();
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Convert HTML string to structured, beautiful Markdown
 */
export function convertHtmlToMarkdown(html: string, meta?: MarkdownArticleMeta): string {
  try {
    const rawMarkdown = turndownService.turndown(html);
    return postProcessMarkdown(rawMarkdown, meta);
  } catch (err) {
    logger.warn(`Markdown conversion failed, falling back to empty string: ${errorMessage(err)}`);
    return '';
  }
}
