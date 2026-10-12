import { marked } from 'marked';
import TurndownService from 'turndown';

const BLOCKED_TAGS = new Set(['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'form', 'input']);
const ALLOWED_TAGS = new Set([
  'a',
  'blockquote',
  'br',
  'code',
  'del',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'hr',
  'img',
  'li',
  'ol',
  'p',
  'pre',
  's',
  'strong',
  'table',
  'tbody',
  'td',
  'th',
  'thead',
  'tr',
  'ul',
]);

const turndownService = new TurndownService({
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  headingStyle: 'atx',
});

turndownService.addRule('taskflowImage', {
  filter: 'img',
  replacement: (_content, node) => {
    const element = node as HTMLImageElement;
    const src = element.getAttribute('src') || '';
    if (!isSafeImageSrc(src)) return '';

    const alt = element.getAttribute('alt') || '';
    const title = element.getAttribute('title');
    return title ? `![${alt}](${src} "${title}")` : `![${alt}](${src})`;
  },
});

function unwrapElement(element: Element) {
  const parent = element.parentNode;
  if (!parent) return;

  while (element.firstChild) {
    parent.insertBefore(element.firstChild, element);
  }
  parent.removeChild(element);
}

function isSafeHref(value: string | null) {
  const raw = String(value || '').trim();
  if (!raw) return false;
  if (raw.startsWith('/') && !raw.startsWith('//')) return true;

  try {
    const url = new URL(raw, window.location.origin);
    return ['http:', 'https:', 'mailto:'].includes(url.protocol);
  } catch {
    return false;
  }
}

export function isSafeImageSrc(value: string | null) {
  const raw = String(value || '').trim();
  if (!raw) return false;
  if (raw.startsWith('//')) return false;

  const normalized = raw.startsWith('./') ? raw.slice(1) : raw;
  return normalized.startsWith('/uploads/rich-text-images/');
}

function cleanElementAttributes(element: Element) {
  const tagName = element.tagName.toLowerCase();

  for (const attribute of Array.from(element.attributes)) {
    const name = attribute.name.toLowerCase();
    const value = attribute.value;

    if (name.startsWith('on') || name === 'style' || name === 'class') {
      element.removeAttribute(attribute.name);
      continue;
    }

    if (tagName === 'a' && ['href', 'title', 'target', 'rel'].includes(name)) {
      if (name === 'href' && !isSafeHref(value)) {
        element.removeAttribute(attribute.name);
      }
      continue;
    }

    if (tagName === 'img' && ['src', 'alt', 'title'].includes(name)) {
      if (name === 'src' && !isSafeImageSrc(value)) {
        element.remove();
      }
      continue;
    }

    if ((tagName === 'td' || tagName === 'th') && ['colspan', 'rowspan'].includes(name)) {
      continue;
    }

    element.removeAttribute(attribute.name);
  }

  if (tagName === 'a' && element.getAttribute('href')) {
    element.setAttribute('target', '_blank');
    element.setAttribute('rel', 'noreferrer noopener');
  }
}

export function sanitizeMarkdownHtml(html: string) {
  if (typeof DOMParser === 'undefined') {
    return html;
  }

  const document = new DOMParser().parseFromString(html, 'text/html');
  const elements = Array.from(document.body.querySelectorAll('*'));

  for (const element of elements) {
    const tagName = element.tagName.toLowerCase();
    if (BLOCKED_TAGS.has(tagName)) {
      element.remove();
      continue;
    }

    if (!ALLOWED_TAGS.has(tagName)) {
      unwrapElement(element);
      continue;
    }

    cleanElementAttributes(element);
  }

  return document.body.innerHTML;
}

export function markdownToSafeHtml(markdown: string) {
  const html = marked.parse(markdown || '', {
    async: false,
    breaks: true,
    gfm: true,
  }) as string;

  return sanitizeMarkdownHtml(html);
}

export function markdownToEditorHtml(markdown: string) {
  return markdownToSafeHtml(markdown);
}

export function htmlToMarkdown(html: string) {
  return turndownService
    .turndown(sanitizeMarkdownHtml(html || ''))
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
