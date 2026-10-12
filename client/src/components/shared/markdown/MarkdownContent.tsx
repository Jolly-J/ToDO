import { useEffect, useMemo, useRef } from 'react';
import { cn } from '@/lib/utils';
import { isSafeImageSrc, markdownToSafeHtml } from './markdown';

export interface MarkdownMention {
  id: string;
  name: string;
}

export interface MarkdownPreviewImage {
  src: string;
  alt?: string;
  title?: string;
}

interface MarkdownContentProps {
  markdown?: string | null;
  emptyText?: string;
  mentions?: MarkdownMention[];
  onImageClick?: (image: MarkdownPreviewImage) => void;
  className?: string;
}

function shouldSkipTextNode(node: Node) {
  const parent = node.parentElement;
  return Boolean(parent?.closest('code, pre, a, [data-mention-id]'));
}

function findNextMention(text: string, tokens: Array<{ token: string; id: string }>, start: number) {
  let nextMatch: { index: number; token: string; id: string } | null = null;

  for (const mention of tokens) {
    const index = text.indexOf(mention.token, start);
    if (index === -1) continue;
    if (!nextMatch || index < nextMatch.index || (index === nextMatch.index && mention.token.length > nextMatch.token.length)) {
      nextMatch = { index, token: mention.token, id: mention.id };
    }
  }

  return nextMatch;
}

function highlightMentions(container: HTMLElement, mentions: MarkdownMention[]) {
  const tokens = mentions
    .filter((mention) => mention.name)
    .map((mention) => ({ id: mention.id, token: `@${mention.name}` }))
    .sort((left, right) => right.token.length - left.token.length);

  if (tokens.length === 0) return;

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];

  while (true) {
    const currentNode = walker.nextNode();
    if (!currentNode) break;

    if (!shouldSkipTextNode(currentNode) && tokens.some((mention) => currentNode.textContent?.includes(mention.token))) {
      textNodes.push(currentNode as Text);
    }
  }

  for (const textNode of textNodes) {
    const text = textNode.textContent || '';
    const fragment = document.createDocumentFragment();
    let cursor = 0;

    while (cursor < text.length) {
      const match = findNextMention(text, tokens, cursor);
      if (!match) {
        fragment.appendChild(document.createTextNode(text.slice(cursor)));
        break;
      }

      if (match.index > cursor) {
        fragment.appendChild(document.createTextNode(text.slice(cursor, match.index)));
      }

      const span = document.createElement('span');
      span.dataset.mentionId = match.id;
      span.className = 'tf-markdown-mention';
      span.textContent = match.token;
      fragment.appendChild(span);
      cursor = match.index + match.token.length;
    }

    textNode.parentNode?.replaceChild(fragment, textNode);
  }
}

export default function MarkdownContent({
  markdown,
  emptyText = '暂无内容',
  mentions = [],
  onImageClick,
  className,
}: MarkdownContentProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const content = String(markdown || '').trim();
  const html = useMemo(() => markdownToSafeHtml(content), [content]);

  useEffect(() => {
    if (!containerRef.current || !mentions.length) return;
    highlightMentions(containerRef.current, mentions);
  }, [html, mentions]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !onImageClick) return;

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const image = target?.closest('img');
      if (!image || !container.contains(image)) return;

      const src = image.getAttribute('src') || '';
      if (!isSafeImageSrc(src)) return;

      event.preventDefault();
      onImageClick({
        src,
        alt: image.getAttribute('alt') || undefined,
        title: image.getAttribute('title') || undefined,
      });
    };

    container.addEventListener('click', handleClick);
    return () => {
      container.removeEventListener('click', handleClick);
    };
  }, [html, onImageClick]);

  if (!content) {
    return <span className="text-[13px] text-muted-foreground">{emptyText}</span>;
  }

  return (
    <div
      ref={containerRef}
      className={cn('tf-markdown-content', className)}
      data-clickable-images={onImageClick ? 'true' : undefined}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
