/** 任务语义色彩配置，定义优先级与状态对应的颜色、图标等视觉元数据 */
import type { TaskPriority, TaskStatus } from '@/types';

type SemanticMeta = {
  color: string;
  label: string;
};

const fallbackMeta: SemanticMeta = {
  color: '#6B7280',
  label: '未设置',
};

export const priorityConfig: Record<TaskPriority, SemanticMeta> = {
  urgent: { color: '#EF4444', label: '紧急' },
  high: { color: '#F97316', label: '高' },
  medium: { color: '#2B5A9B', label: '中' },
  low: { color: '#10B981', label: '低' },
};

export const statusConfig: Record<TaskStatus, SemanticMeta> = {
  in_progress: { color: '#F59E0B', label: '进行中' },
  delayed_in_progress: { color: '#DC2626', label: '延期进行中' },
  done: { color: '#10B981', label: '已完成' },
  delayed_done: { color: '#0F766E', label: '延期完成' },
  canceled: { color: '#64748B', label: '已取消' },
};

export function getPriorityMeta(priority?: string | null): SemanticMeta {
  if (!priority) {
    return fallbackMeta;
  }
  return priorityConfig[priority as TaskPriority] || { color: fallbackMeta.color, label: priority };
}

export function getStatusMeta(status?: string | null): SemanticMeta {
  if (!status) {
    return fallbackMeta;
  }
  return statusConfig[status as TaskStatus] || { color: fallbackMeta.color, label: status };
}

export function getPriorityColor(priority?: string | null) {
  return getPriorityMeta(priority).color;
}

export function getStatusColor(status?: string | null) {
  return getStatusMeta(status).color;
}

export function getPriorityLabel(priority?: string | null) {
  return getPriorityMeta(priority).label;
}

export function getStatusLabel(status?: string | null) {
  return getStatusMeta(status).label;
}

export function withAlpha(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');
  const sixDigitHex = normalized.length === 3
    ? normalized.split('').map((char) => `${char}${char}`).join('')
    : normalized;
  const red = Number.parseInt(sixDigitHex.slice(0, 2), 16);
  const green = Number.parseInt(sixDigitHex.slice(2, 4), 16);
  const blue = Number.parseInt(sixDigitHex.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
