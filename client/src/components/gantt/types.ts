/**
 * 甘特图通用类型定义
 */

export type GanttScale = 'day' | 'week' | 'month' | 'year';

export type GanttItemType = 'task' | 'milestone' | 'group';

export interface GanttItem {
  id: string;
  type: GanttItemType;
  parentId?: string;
  taskId?: string;
  name: string;
  startDate?: string;
  dueDate?: string;
  progress: number;
  status: string;
  assigneeName?: string;
  isDelayed: boolean;
  isCritical: boolean;
  depth: number;
  sortOrder: number;
}
