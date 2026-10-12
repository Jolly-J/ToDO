/**
 * 任务日历视图 ViewModel
 * 定义日历视图所需的任务数据结构及日期分组转换逻辑
 */
import type { TaskPriority, TaskStatus } from '@/types';

export type CalendarTaskItem = {
  id: string;
  title: string;
  date: string;
  priority: TaskPriority;
  status: TaskStatus;
};

export type CalendarFilterValue = 'all' | TaskStatus | TaskPriority;

export const CALENDAR_STATUS_FILTER_OPTIONS: Array<{ label: string; value: 'all' | TaskStatus }> = [
  { label: '全部状态', value: 'all' },
  { label: '进行中', value: 'in_progress' },
  { label: '延期进行中', value: 'delayed_in_progress' },
  { label: '已完成', value: 'done' },
  { label: '延期完成', value: 'delayed_done' },
  { label: '已取消', value: 'canceled' },
];

export const CALENDAR_PRIORITY_FILTER_OPTIONS: Array<{ label: string; value: 'all' | TaskPriority }> = [
  { label: '全部优先级', value: 'all' },
  { label: '紧急', value: 'urgent' },
  { label: '高', value: 'high' },
  { label: '中', value: 'medium' },
  { label: '低', value: 'low' },
];

export function getCalendarTaskStatusColor({
  status,
  isOverdue,
}: {
  status: TaskStatus;
  isOverdue: boolean;
}) {
  if (status === 'canceled') {
    return '#64748B';
  }
  if (status === 'delayed_done') {
    return '#0F766E';
  }
  if (status === 'delayed_in_progress') {
    return '#DC2626';
  }

  return isOverdue ? '#EF4444' : '#10B981';
}

export function filterCalendarTasks(
  tasks: CalendarTaskItem[],
  filters: { status: 'all' | TaskStatus; priority: 'all' | TaskPriority }
) {
  return tasks.filter((task) => {
    const passStatus = filters.status === 'all' || task.status === filters.status;
    const passPriority = filters.priority === 'all' || task.priority === filters.priority;
    return passStatus && passPriority;
  });
}

export function buildTasksByDate(tasks: CalendarTaskItem[]) {
  const map = new Map<string, CalendarTaskItem[]>();
  for (const task of tasks) {
    if (!task.date) {
      continue;
    }
    const key = task.date.slice(0, 10);
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key)?.push(task);
  }
  return map;
}
