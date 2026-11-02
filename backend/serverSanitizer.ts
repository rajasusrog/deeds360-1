import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import { escapeHtml } from '../src/utils/htmlSanitizer';

const jsdomWindow = new JSDOM('').window;
const domPurifyInstance = createDOMPurify(jsdomWindow as any);

const ALLOWED_LEGAL_TAGS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'strong', 'b', 'em', 'i', 'u', 'sup', 'sub',
  'div', 'span', 'br', 'hr',
  'ul', 'ol', 'li',
  'table', 'thead', 'tbody', 'tr', 'th', 'td'
];

const ALLOWED_LEGAL_ATTRS = [
  'class', 'style', 'align', 'colspan', 'rowspan', 'border', 'cellpadding', 'cellspacing'
];

/**
 * Server-side HTML sanitizer backed by JSDOM and DOMPurify for Node.js environments.
 * Fails closed by returning escaped HTML if sanitization throws an error.
 */
export function sanitizeServerHtml(dirtyHtml: string): string {
  if (!dirtyHtml) return '';
  try {
    return domPurifyInstance.sanitize(dirtyHtml, {
      ALLOWED_TAGS: ALLOWED_LEGAL_TAGS,
      ALLOWED_ATTR: ALLOWED_LEGAL_ATTRS,
      FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onmouseenter', 'onmouseleave'],
      ALLOW_DATA_ATTR: false,
    });
  } catch {
    return escapeHtml(dirtyHtml);
  }
}

export function sanitizeServerLegalSection<T extends { contentEn: string; contentTa: string }>(section: T): T {
  return {
    ...section,
    contentEn: sanitizeServerHtml(section.contentEn),
    contentTa: sanitizeServerHtml(section.contentTa),
  };
}
