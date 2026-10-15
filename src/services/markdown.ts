import TurndownService from 'turndown';

const turndownService = new TurndownService({
  headingStyle: 'atx',
  hr: '---',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '*',
});

// Custom rules for enhanced table support and image captions
turndownService.addRule('preserveImages', {
  filter: 'img',
  replacement: (content, node) => {
    const el = node as HTMLElement;
    const src = el.getAttribute('src') || '';
    const alt = el.getAttribute('alt') || '';
    const title = el.getAttribute('title');
    return title ? `![${alt}](${src} "${title}")` : `![${alt}](${src})`;
  }
});

export function convertHtmlToMarkdown(html: string): string {
  try {
    return turndownService.turndown(html);
  } catch (err: any) {
    console.warn(`[MarkdownConverter] Conversion failed, fallback to empty string: ${err.message}`);
    return '';
  }
}
