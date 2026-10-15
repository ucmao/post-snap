import sanitizeHtml from 'sanitize-html';
import * as cheerio from 'cheerio';

export interface CleanOptions {
  cleanStyles?: boolean;
}

/**
 * Clean and normalize article HTML for rich-text editors (Quill, TinyMCE, WangEditor, ProseMirror, etc.)
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
    // Ensure all links open in new tab and are safe
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

  // Remove empty paragraphs that only contain whitespace, unless they have children like img
  $('p, div, section').each((_, el) => {
    const $el = $(el);
    if ($el.children().length === 0 && $el.text().trim() === '') {
      // Keep if it's an intentional break or contains an image
      if ($el.find('img, br, hr').length === 0) {
        $el.remove();
      }
    }
  });

  // Always enforce referrerpolicy="no-referrer" on all image tags to prevent broken images
  $('img').each((_, el) => {
    $(el).attr('referrerpolicy', 'no-referrer');
  });

  // If cleanStyles is requested, strip all style attributes completely
  if (cleanStyles) {
    $('*').removeAttr('style');
  }

  return $.html();
}
