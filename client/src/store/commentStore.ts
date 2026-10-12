/** 评论状态 Store，管理任务评论的加载、新增与删除 */
import { create } from 'zustand';
import type { Comment, CommentMessageType, CommentReadStatus } from '@/types';
import request from '@/api/request';
import { createRequestId } from '@/utils/requestId';
import { useTaskStore } from './taskStore';
import clientLogger from '@/utils/clientLogger';

type CreateCommentPayload = {
  content: string;
  parent_id?: string | null;
  attachment_ids?: string[];
  message_type?: CommentMessageType;
  mentioned_user_ids?: string[];
  request_id?: string;
};

interface CommentState {
  comments: Comment[];
  loading: boolean;
  error: { status?: number; message?: string } | null;
  fetchComments: (taskId: string) => Promise<void>;
  createComment: (taskId: string, payload: CreateCommentPayload) => Promise<Comment>;
  updateComment: (commentId: string, payload: { content: string }) => Promise<Comment>;
  auditComment: (commentId: string, payload: { action: 'approve' | 'reject' }) => Promise<Comment>;
  markCommentsRead: (taskId: string, commentIds: string[]) => Promise<void>;
  fetchCommentReadStatus: (commentId: string) => Promise<CommentReadStatus>;
  deleteComment: (commentId: string) => Promise<void>;
  resetComments: () => void;
}

export const useCommentStore = create<CommentState>((set, get) => ({
  comments: [],
  loading: false,
  error: null,

  fetchComments: async (taskId) => {
    if (!taskId) {
      set({ comments: [], loading: false, error: null });
      return;
    }

    set({ loading: true, error: null });

    try {
      const comments = await request.get<Comment[]>(`/tasks/${taskId}/comments`);
      set({ comments, loading: false });
    } catch (err: any) {
      set({ 
        loading: false, 
        error: { 
          status: err?.response?.status || err?.status, 
          message: err?.message || '加载评论失败' 
        } 
      });
    }
  },

  createComment: async (taskId, payload) => {
    const startTime = Date.now();
    const requestId = payload.request_id || createRequestId('comment');

    try {
      // 统一使用 JSON 格式提交评论
      const comment = await request.post<Comment>(`/tasks/${taskId}/comments`, {
        content: payload.content,
        parent_id: payload.parent_id ?? null,
        attachment_ids: payload.attachment_ids || [],
        message_type: payload.message_type || 'message',
        mentioned_user_ids: payload.mentioned_user_ids || [],
      }, {
        headers: {
          'X-Idempotency-Key': requestId,
        },
      });

      const alreadyExists = get().comments.some((item) => item.id === comment.id);

      set(({ comments }) => ({
        comments: alreadyExists
          ? comments.map((item) => (item.id === comment.id ? comment : item))
          : [...comments, comment],
      }));

      if (!alreadyExists) {
        useTaskStore.setState((state) => ({
          tasks: state.tasks.map((task) => (
            task.id === taskId
              ? { ...task, comment_count: (task.comment_count ?? 0) + 1 }
              : task
          )),
          taskDetails: state.taskDetails[taskId]
            ? {
                ...state.taskDetails,
                [taskId]: {
                  ...state.taskDetails[taskId],
                  comment_count: (state.taskDetails[taskId].comment_count ?? 0) + 1,
                },
              }
            : state.taskDetails,
          boardData: {
            in_progress: state.boardData.in_progress.map((task) => (
              task.id === taskId
                ? { ...task, comment_count: (task.comment_count ?? 0) + 1 }
                : task
            )),
            delayed_in_progress: state.boardData.delayed_in_progress.map((task) => (
              task.id === taskId
                ? { ...task, comment_count: (task.comment_count ?? 0) + 1 }
                : task
            )),
            done: state.boardData.done.map((task) => (
              task.id === taskId
                ? { ...task, comment_count: (task.comment_count ?? 0) + 1 }
                : task
            )),
            delayed_done: state.boardData.delayed_done.map((task) => (
              task.id === taskId
                ? { ...task, comment_count: (task.comment_count ?? 0) + 1 }
                : task
            )),
            canceled: state.boardData.canceled.map((task) => (
              task.id === taskId
                ? { ...task, comment_count: (task.comment_count ?? 0) + 1 }
                : task
            )),
          },
        }));
      }

      // 日志上报：评论提交成功
      clientLogger.success('frontend.comment.submit.success', {
        taskId,
        commentId: comment.id,
        durationMs: Date.now() - startTime,
        reqId: requestId,
      });

      return comment;
    } catch (err) {
      // 日志上报：评论提交失败
      clientLogger.failed('frontend.comment.submit.failed', {
        taskId,
        durationMs: Date.now() - startTime,
        reqId: requestId,
        error: err instanceof Error ? err : new Error('评论提交失败'),
      });
      throw err;
    }
  },

  updateComment: async (commentId, payload) => {
    const updatedComment = await request.patch<Comment>(`/comments/${commentId}`, payload);
    set(({ comments }) => ({
      comments: comments.map((comment) => (comment.id === commentId ? updatedComment : comment)),
    }));
    return updatedComment;
  },

  auditComment: async (commentId, payload) => {
    const updatedComment = await request.put<Comment>(`/comments/${commentId}/audit`, payload);
    set(({ comments }) => ({
      comments: comments.map((comment) => (comment.id === commentId ? updatedComment : comment)),
    }));
    return updatedComment;
  },

  markCommentsRead: async (taskId, commentIds) => {
    const ids = [...new Set(commentIds.filter(Boolean))];
    if (!taskId || ids.length === 0) return;

    await request.post<{ updated: number }>(`/tasks/${taskId}/comments/read`, {
      comment_ids: ids,
    });

    const idSet = new Set(ids);
    set(({ comments }) => ({
      comments: comments.map((comment) => {
        if (!idSet.has(comment.id) || !comment.read_state || comment.read_state.has_read) {
          return comment;
        }

        const nextReadCount = Math.min(comment.read_state.recipient_count, comment.read_state.read_count + 1);
        return {
          ...comment,
          read_state: {
            ...comment.read_state,
            has_read: true,
            read_count: nextReadCount,
            unread_count: Math.max(comment.read_state.recipient_count - nextReadCount, 0),
          },
        };
      }),
    }));
  },

  fetchCommentReadStatus: async (commentId) => {
    return request.get<CommentReadStatus>(`/comments/${commentId}/read-status`);
  },

  deleteComment: async (commentId) => {
    const comment = get().comments.find((item) => item.id === commentId);
    await request.delete(`/comments/${commentId}`);
    set(({ comments }) => ({
      comments: comments.filter((comment) => comment.id !== commentId),
    }));

    if (comment?.task_id) {
      useTaskStore.setState((state) => ({
        tasks: state.tasks.map((task) => (
          task.id === comment.task_id
            ? { ...task, comment_count: Math.max((task.comment_count ?? 1) - 1, 0) }
            : task
        )),
        taskDetails: state.taskDetails[comment.task_id]
          ? {
              ...state.taskDetails,
              [comment.task_id]: {
                ...state.taskDetails[comment.task_id],
                comment_count: Math.max((state.taskDetails[comment.task_id].comment_count ?? 1) - 1, 0),
              },
            }
          : state.taskDetails,
        boardData: {
          in_progress: state.boardData.in_progress.map((task) => (
            task.id === comment.task_id
              ? { ...task, comment_count: Math.max((task.comment_count ?? 1) - 1, 0) }
              : task
          )),
          delayed_in_progress: state.boardData.delayed_in_progress.map((task) => (
            task.id === comment.task_id
              ? { ...task, comment_count: Math.max((task.comment_count ?? 1) - 1, 0) }
              : task
          )),
          done: state.boardData.done.map((task) => (
            task.id === comment.task_id
              ? { ...task, comment_count: Math.max((task.comment_count ?? 1) - 1, 0) }
              : task
          )),
          delayed_done: state.boardData.delayed_done.map((task) => (
            task.id === comment.task_id
              ? { ...task, comment_count: Math.max((task.comment_count ?? 1) - 1, 0) }
              : task
          )),
          canceled: state.boardData.canceled.map((task) => (
            task.id === comment.task_id
              ? { ...task, comment_count: Math.max((task.comment_count ?? 1) - 1, 0) }
              : task
          )),
        },
      }));
    }
  },

  resetComments: () => {
    set({ comments: [], error: null });
  },
}));
