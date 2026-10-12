/**
 * 任务评论已读回执前端判定工具
 * 负责抽离可见比例、移动端 Tab 和当前用户状态等判断，避免抽屉组件堆积监听细节。
 */
import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { Comment } from '@/types';

export type CommentVisibleEntry = {
  commentId: string;
  isIntersecting: boolean;
  intersectionRatio: number;
};

export function isCommentReadTrackingActive({
  drawerVisible,
  isMobile,
  activeTab,
  documentVisible,
}: {
  drawerVisible: boolean;
  isMobile: boolean;
  activeTab: 'info' | 'chat';
  documentVisible: boolean;
}) {
  if (!drawerVisible || !documentVisible) return false;
  if (isMobile && activeTab !== 'chat') return false;
  return true;
}

export function collectVisibleUnreadCommentIds({
  comments,
  currentUserId,
  visibleEntries,
  minimumRatio = 0.5,
}: {
  comments: Pick<Comment, 'id' | 'user_id' | 'read_state'>[];
  currentUserId?: string | null;
  visibleEntries: CommentVisibleEntry[];
  minimumRatio?: number;
}) {
  if (!currentUserId) return [];

  const commentMap = new Map(comments.map((comment) => [comment.id, comment]));
  const ids: string[] = [];
  const seen = new Set<string>();

  for (const entry of visibleEntries) {
    if (!entry.isIntersecting || entry.intersectionRatio < minimumRatio || seen.has(entry.commentId)) {
      continue;
    }

    const comment = commentMap.get(entry.commentId);
    if (!comment || comment.user_id === currentUserId || comment.read_state?.has_read) {
      continue;
    }

    if ((comment.read_state?.recipient_count ?? 0) <= 0) {
      continue;
    }

    seen.add(entry.commentId);
    ids.push(entry.commentId);
  }

  return ids;
}

export function useCommentReadReceipts({
  active,
  comments,
  currentUserId,
  containerRef,
  onMarkRead,
  delayMs = 1000,
}: {
  active: boolean;
  comments: Pick<Comment, 'id' | 'user_id' | 'read_state'>[];
  currentUserId?: string | null;
  containerRef: RefObject<HTMLElement | null>;
  onMarkRead: (commentIds: string[]) => Promise<void> | void;
  delayMs?: number;
}) {
  const commentsRef = useRef(comments);
  const pendingTimersRef = useRef(new Map<string, number>());
  const markedIdsRef = useRef(new Set<string>());
  const onMarkReadRef = useRef(onMarkRead);

  useEffect(() => {
    commentsRef.current = comments;
  }, [comments]);

  useEffect(() => {
    onMarkReadRef.current = onMarkRead;
  }, [onMarkRead]);

  useEffect(() => {
    if (!active || !currentUserId || !containerRef.current || typeof IntersectionObserver === 'undefined') {
      return;
    }

    const container = containerRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries
          .map((entry) => ({
            commentId: (entry.target as HTMLElement).dataset.commentId || '',
            isIntersecting: entry.isIntersecting,
            intersectionRatio: entry.intersectionRatio,
          }))
          .filter((entry) => Boolean(entry.commentId));

        const ids = collectVisibleUnreadCommentIds({
          comments: commentsRef.current,
          currentUserId,
          visibleEntries,
        }).filter((id) => !pendingTimersRef.current.has(id) && !markedIdsRef.current.has(id));

        for (const id of ids) {
          const timer = window.setTimeout(() => {
            pendingTimersRef.current.delete(id);
            markedIdsRef.current.add(id);
            Promise.resolve(onMarkReadRef.current([id])).catch(() => {
              markedIdsRef.current.delete(id);
            });
          }, delayMs);

          pendingTimersRef.current.set(id, timer);
        }
      },
      {
        root: container,
        threshold: [0, 0.5, 1],
      }
    );

    const nodes = Array.from(container.querySelectorAll<HTMLElement>('[data-comment-id]'));
    nodes.forEach((node) => observer.observe(node));

    return () => {
      observer.disconnect();
      for (const timer of pendingTimersRef.current.values()) {
        window.clearTimeout(timer);
      }
      pendingTimersRef.current.clear();
    };
  }, [active, containerRef, currentUserId, delayMs, comments.length]);
}
