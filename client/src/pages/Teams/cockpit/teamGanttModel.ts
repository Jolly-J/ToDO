/**
 * 团队甘特图数据模型。
 * 文件作用：把团队任务转换为甘特图行、时间轴与网格放置信息，供屏幕驾驶舱与打印预览共用。
 * 主要功能：任务扁平化、状态筛选、父子补齐、折叠展开、风险过滤、时间轴布局与放置计算。
 * 说明：纯函数，不依赖 React；筛选与全览规则集中在这里，避免屏幕视图和打印视图两处逻辑漂移。
 */
import dayjs from 'dayjs';
import {
  buildGanttRows,
  getItemGridPlacement,
  type GanttGridPlacement,
  type GanttItem,
  type GanttScale,
  type GanttTimelineUnit,
} from '@/components/gantt';
import type { Task } from '@/types';
import { buildTeamGanttLayout, getTimeProgress } from './teamGanttLayout';

/** 屏幕驾驶舱当前生效的甘特图显示属性，打印预览需要沿用这些设置。 */
export interface TeamGanttViewState {
  statusFilter: string;
  riskOnly: boolean;
  collapsedIds: Set<string>;
}

export interface BuildTeamGanttModelOptions {
  tasks: Task[];
  today: string;
  statusFilter: string;
  riskOnly: boolean;
  collapsedIds: ReadonlySet<string>;
  /** 时间轴可用宽度（不含左侧任务名称列） */
  availableWidth: number;
  scale: GanttScale;
  zoom: number;
  fit: boolean;
}

export interface TeamGanttModel {
  filteredTasks: Task[];
  parentIds: Set<string>;
  depthMap: Map<string, number>;
  ganttItems: GanttItem[];
  allRows: GanttItem[];
  visibleRows: GanttItem[];
  filteredRows: GanttItem[];
  rangeItems: GanttItem[];
  units: GanttTimelineUnit[];
  renderScale: GanttScale;
  pxPerDay: number;
  placements: Map<string, GanttGridPlacement>;
  taskStart?: string;
  taskEnd?: string;
  timelineWidth: number;
  statusLabel: string;
}

const STATUS_LABEL: Record<string, string> = {
  in_progress: '进行中',
  unfinished: '未完成',
  overdue: '仅逾期',
  done: '已完成',
  all: '全部状态',
};

export function getGanttStatusLabel(statusFilter: string): string {
  return STATUS_LABEL[statusFilter] ?? '全部状态';
}

function isDoneStatus(status: string): boolean {
  return status === 'done' || status === 'delayed_done';
}

function isOverdueTask(task: Task, todayStr: string): boolean {
  return (
    task.status === 'delayed_in_progress' ||
    Boolean(task.due_date && task.due_date.slice(0, 10) < todayStr && !isDoneStatus(task.status))
  );
}

/** 把主任务与其嵌套 subtasks 扁平化去重，并补全 parent_id。 */
export function flattenTeamTasks(tasks: Task[]): Task[] {
  const map = new Map<string, Task>();
  const walk = (task: Task, fallbackParentId?: string) => {
    const pid = task.parent_id || fallbackParentId;
    const normalized: Task = { ...task, parent_id: pid };
    if (!map.has(normalized.id)) {
      map.set(normalized.id, normalized);
    }
    if (task.subtasks && Array.isArray(task.subtasks)) {
      task.subtasks.forEach((sub) => walk(sub, task.id));
    }
  };
  tasks.forEach((task) => walk(task));
  return Array.from(map.values());
}

/**
 * 按状态筛选任务，并补齐父子关系：
 * 子任务命中时保留祖先作为树容器；父任务命中时连同子任务一起展示。
 */
export function filterTeamGanttTasks(
  flattenedTasks: Task[],
  statusFilter: string,
  todayStr: string
): Task[] {
  const isSingleMatch = (task: Task): boolean => {
    const done = isDoneStatus(task.status);
    const overdue = isOverdueTask(task, todayStr);

    if (statusFilter === 'in_progress') {
      if (task.status !== 'in_progress' && task.status !== 'delayed_in_progress') return false;
    } else if (statusFilter === 'unfinished') {
      if (done || task.status === 'canceled') return false;
    } else if (statusFilter === 'overdue') {
      if (!overdue) return false;
    } else if (statusFilter === 'done') {
      if (!done) return false;
    }

    return true;
  };

  const taskMap = new Map<string, Task>();
  flattenedTasks.forEach((task) => taskMap.set(task.id, task));

  const matchedIds = new Set<string>();
  flattenedTasks.forEach((task) => {
    if (isSingleMatch(task)) {
      matchedIds.add(task.id);
      let cursor = task.parent_id;
      while (cursor && taskMap.has(cursor)) {
        matchedIds.add(cursor);
        cursor = taskMap.get(cursor)!.parent_id;
      }
    }
  });

  flattenedTasks.forEach((task) => {
    if (task.parent_id && matchedIds.has(task.parent_id)) {
      matchedIds.add(task.id);
    }
  });

  return flattenedTasks.filter((task) => matchedIds.has(task.id));
}

/** 把筛选后的任务映射为甘特图行项（含层级深度与时间进度）。 */
export function buildTeamGanttItems(
  filteredTasks: Task[],
  depthMap: Map<string, number>,
  todayStr: string
): GanttItem[] {
  const taskMap = new Map<string, Task>();
  filteredTasks.forEach((task) => taskMap.set(task.id, task));

  return filteredTasks.map((task, index) => {
    const overdue = isOverdueTask(task, todayStr);
    const startDate = task.start_date
      ? task.start_date.slice(0, 10)
      : (task.created_at ? task.created_at.slice(0, 10) : todayStr);
    let dueDate = task.due_date ? task.due_date.slice(0, 10) : undefined;
    if (!dueDate) {
      dueDate = dayjs(startDate).add(3, 'day').format('YYYY-MM-DD');
    }

    const hasValidParent = Boolean(task.parent_id && taskMap.has(task.parent_id));

    return {
      id: task.id,
      taskId: task.id,
      type: 'task',
      parentId: hasValidParent ? (task.parent_id || undefined) : undefined,
      name: task.title,
      startDate,
      dueDate,
      progress: getTimeProgress(startDate, dueDate, todayStr),
      status: task.status,
      assigneeName: task.assignee_name,
      isDelayed: overdue,
      isCritical: task.priority === 'urgent',
      depth: depthMap.get(task.id) ?? 0,
      sortOrder: index,
    };
  });
}

/** 依据筛选状态、折叠集合与视口宽度生成完整甘特图模型。 */
export function buildTeamGanttModel(options: BuildTeamGanttModelOptions): TeamGanttModel {
  const { tasks, today, statusFilter, riskOnly, collapsedIds, availableWidth, scale, zoom, fit } = options;

  const flattenedTasks = flattenTeamTasks(tasks);
  const filteredTasks = filterTeamGanttTasks(flattenedTasks, statusFilter, today);

  const parentIds = new Set<string>();
  const taskMap = new Map<string, Task>();
  filteredTasks.forEach((task) => taskMap.set(task.id, task));
  filteredTasks.forEach((task) => {
    if (task.parent_id && taskMap.has(task.parent_id)) {
      parentIds.add(task.parent_id);
    }
  });

  const depthMap = new Map<string, number>();
  const getDepth = (id: string, visited = new Set<string>()): number => {
    if (depthMap.has(id)) return depthMap.get(id)!;
    if (visited.has(id)) return 0;
    visited.add(id);
    const item = taskMap.get(id);
    if (!item || !item.parent_id || !taskMap.has(item.parent_id)) {
      depthMap.set(id, 0);
      return 0;
    }
    const depth = getDepth(item.parent_id, visited) + 1;
    depthMap.set(id, depth);
    return depth;
  };
  filteredTasks.forEach((task) => getDepth(task.id));

  const ganttItems = buildTeamGanttItems(filteredTasks, depthMap, today);
  const allRows = buildGanttRows(ganttItems);
  const visibleRows = buildGanttRows(ganttItems, collapsedIds);
  const filteredRows = riskOnly
    ? visibleRows.filter((row) => row.isDelayed || row.isCritical)
    : visibleRows;

  // 折叠只隐藏行，不改变全览范围；风险筛选则只覆盖命中的排期。
  const rangeItems = riskOnly
    ? ganttItems.filter((item) => item.isDelayed || item.isCritical)
    : ganttItems;

  const { units, renderScale, pxPerDay, timelineWidth, taskStart, taskEnd } = buildTeamGanttLayout({
    items: rangeItems,
    scale,
    availableWidth,
    today,
    zoom,
    fit,
  });

  const placements = new Map<string, GanttGridPlacement>();
  allRows.forEach((row) => {
    const placement = getItemGridPlacement(row, units, pxPerDay);
    if (placement.startIndex !== -1) placements.set(row.id, placement);
  });

  return {
    filteredTasks,
    parentIds,
    depthMap,
    ganttItems,
    allRows,
    visibleRows,
    filteredRows,
    rangeItems,
    units,
    renderScale,
    pxPerDay,
    placements,
    taskStart,
    taskEnd,
    timelineWidth,
    statusLabel: getGanttStatusLabel(statusFilter),
  };
}
