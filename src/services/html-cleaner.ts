import sanitizeHtml from 'sanitize-html';
import * as cheerio from 'cheerio';

export interface CleanOptions {
  cleanStyles?: boolean;
}

/**
 * Clean and normalize article HTML for rich-text editors and high-quality Markdown conversion
 */
export function cleanHtml(rawHtml: string, options: CleanOptions = {}): string {
  const { cleanStyles = false } = options;

  // 1. Initial sanitize to drop scripts, dangerous attributes, and invalid structures
  const sanitized = sanitizeHtml(rawHtml, {
    allowedTags: [
      'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'blockquote', 'pre', 'code',
      'ul', 'ol', 'li',
      'strong', 'em', 'b', 'i', 'u', 's', 'del', 'strike',
      'span', 'div', 'section', 'article',
      'a', 'img', 'figure', 'figcaption',
      'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
      'hr', 'br'
    ],
    allowedAttributes: {
      '*': cleanStyles ? ['class'] : ['style', 'class'],
      'a': ['href', 'target', 'rel', 'title'],
      'img': ['src', 'alt', 'title', 'width', 'height', 'referrerpolicy', 'loading'],
      'th': ['colspan', 'rowspan', 'align'],
      'td': ['colspan', 'rowspan', 'align'],
      'code': ['class'],
      'pre': ['class'],
    },
    allowedStyles: cleanStyles ? undefined : {
      '*': {
        'color': [/.*/],
        'background-color': [/.*/],
        'font-size': [/.*/],
        'font-weight': [/.*/],
        'text-align': [/.*/],
        'text-decoration': [/.*/],
        'line-height': [/.*/],
        'letter-spacing': [/.*/],
        'margin': [/.*/],
        'margin-top': [/.*/],
        'margin-bottom': [/.*/],
        'margin-left': [/.*/],
        'margin-right': [/.*/],
        'padding': [/.*/],
        'padding-top': [/.*/],
        'padding-bottom': [/.*/],
        'padding-left': [/.*/],
        'padding-right': [/.*/],
        'border': [/.*/],
        'border-radius': [/.*/],
        'width': [/.*/],
        'height': [/.*/],
        'max-width': [/.*/],
        'box-sizing': [/.*/],
        'display': [/.*/]
      }
    },
    allowedSchemes: ['http', 'https', 'data', 'mailto'],
    transformTags: {
      'a': (tagName, attribs) => {
        return {
          tagName: 'a',
          attribs: {
            ...attribs,
            target: '_blank',
            rel: 'noopener noreferrer'
          }
        };
      }
    }
  });

  // 2. Secondary cleanup with Cheerio to strip empty wrapper sections & fix formatting
  const $ = cheerio.load(sanitized, null, false);

  // 2.1 Promote isolated bold/styled paragraphs to semantic heading tags (h2 / h3)
  // This turns pseudo-headings in WeChat/36kr/Zhihu into standard Markdown headers (## / ###)
  const headingPattern = /^([一二三四五六七八九十]+[、.]|\d+[\.、]\s*|第[一二三四五六七八九十\d]+[章节部分篇]|\([一二三四五六七八九十\d]+\)|【.+?】)/;

  $('p, div, section').each((_, el) => {
    const $el = $(el);
    // Don't modify if it already contains complex elements
    if ($el.find('img, table, pre, ul, ol, blockquote').length > 0) return;

    const text = $el.text().trim();
    if (!text || text.length > 50) return;

    // Condition A: Entire element is wrapped in strong/b
    const directStrong = $el.children('strong, b').first();
    const isPureStrong = directStrong.length === 1 && directStrong.text().trim() === text;

    // Condition B: Styled with bold or large font
    const style = $el.attr('style') || '';
    const isBoldStyled = /font-weight:\s*(bold|[6-9]00)/i.test(style);
    const isLargeFont = /font-size:\s*(1[89]px|2\dpx|[12]\.[2-9]rem|[12]\.[2-9]em)/i.test(style);

    // Condition C: Matches classic Chinese document numbering pattern and is short
    const matchesPattern = headingPattern.test(text);

    if ((isPureStrong || isBoldStyled || (isLargeFont && isBoldStyled) || matchesPattern) && !/[。！？!?,，]$/.test(text)) {
      // Replace with semantic <h2>
      $el.replaceWith(`<h2>${text}</h2>`);
    }
  });

  // 2.2 Clean duplicate nested bold elements (e.g. <strong><strong>...</strong></strong>)
  $('strong, b').each((_, el) => {
    const $el = $(el);
    const text = $el.text().trim();
    if (!text) {
      $el.remove();
      return;
    }
    // Unwrap nested strong
    $el.find('strong, b').each((_, child) => {
      $(child).replaceWith($(child).html() || '');
    });
  });

  // 2.3 Remove empty paragraphs that only contain whitespace, unless they have children like img
  $('p, div, section').each((_, el) => {
    const $el = $(el);
    if ($el.children().length === 0 && $el.text().trim() === '') {
      if ($el.find('img, br, hr').length === 0) {
        $el.remove();
      }
    }
  });

  // 2.4 Unwrap redundant <a> tags that only wrap an <img> with empty text
  $('a').each((_, el) => {
    const $a = $(el);
    if ($a.children('img').length > 0 && $a.text().trim() === '') {
      const href = $a.attr('href') || '';
      // If href is redundant or points to media viewer, unwrap
      if (!href || href === '#' || href.includes('javascript:') || href.includes('.jpg') || href.includes('.png')) {
        $a.replaceWith($a.children());
      }
    }
  });

  // 2.5 Always enforce referrerpolicy="no-referrer" on all image tags to prevent broken images
  $('img').each((_, el) => {
    $(el).attr('referrerpolicy', 'no-referrer');
  });

  // 2.6 If cleanStyles is requested, strip all style attributes completely
  if (cleanStyles) {
    $('*').removeAttr('style');
  }

  return $.html();
}
