/**
 * 任务表格自定义排序逻辑
 * 提供按优先级权重、状态权重、日期、中文文本等维度的排序函数
 */
import type { SortingFn } from '@tanstack/react-table';
import dayjs from 'dayjs';
import type { Task, TaskPriority, TaskStatus } from '@/types';

export const compareTaskText = (left?: string, right?: string) => {
  const normalizedLeft = (left || '').trim();
  const normalizedRight = (right || '').trim();

  if (!normalizedLeft && !normalizedRight) return 0;
  if (!normalizedLeft) return 1;
  if (!normalizedRight) return -1;

  return normalizedLeft.localeCompare(normalizedRight, 'zh-CN');
};

export const compareTaskDate = (left?: string, right?: string) => {
  const leftDay = left ? dayjs(left) : null;
  const rightDay = right ? dayjs(right) : null;
  const leftValid = Boolean(leftDay?.isValid());
  const rightValid = Boolean(rightDay?.isValid());

  if (!leftValid && !rightValid) return 0;
  if (!leftValid) return 1;
  if (!rightValid) return -1;
  return leftDay!.valueOf() - rightDay!.valueOf();
};

const priorityRank: Record<TaskPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const statusRank: Record<TaskStatus, number> = {
  in_progress: 0,
  delayed_in_progress: 1,
  done: 2,
  delayed_done: 2,
  canceled: 3,
};

export const taskTitleSortingFn: SortingFn<Task> = (rowA, rowB) =>
  compareTaskText(rowA.original.title, rowB.original.title);

export const createTaskTextSortingFn = (
  getter: (task: Task) => string
): SortingFn<Task> => (rowA, rowB) =>
  compareTaskText(getter(rowA.original), getter(rowB.original));

export const createTaskDateSortingFn = (
  field: 'start_date' | 'due_date' | 'deleted_at'
): SortingFn<Task> => (rowA, rowB) =>
  compareTaskDate(rowA.original[field] || undefined, rowB.original[field] || undefined);

export const taskPrioritySortingFn: SortingFn<Task> = (rowA, rowB) => {
  const left = priorityRank[rowA.original.priority] ?? Number.POSITIVE_INFINITY;
  const right = priorityRank[rowB.original.priority] ?? Number.POSITIVE_INFINITY;
  return left - right;
};

export const taskStatusSortingFn: SortingFn<Task> = (rowA, rowB) => {
  const left = statusRank[rowA.original.status] ?? Number.POSITIVE_INFINITY;
  const right = statusRank[rowB.original.status] ?? Number.POSITIVE_INFINITY;
  return left - right;
};
