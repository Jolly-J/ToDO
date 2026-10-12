/**
 * 甘特图 ViewModel 纯函数层
 * 职责范围: 仅纯函数，无 React / 无副作用；输入输出统一为 YYYY-MM-DD 字符串。
 */
import dayjs, { type Dayjs } from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import type { GanttItem, GanttScale } from './types';

dayjs.extend(isoWeek);

const ISO_DATE = 'YYYY-MM-DD' as const;

/** 单个时间轴单元 (渲染网格的列) */
export interface GanttTimelineUnit {
  index: number;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD(包含)
  label: string; // 中文标题，如 "6月 第1周"
  daySpan: number; // 单元覆盖的真实天数
}

/** 行项的网格放置信息 */
export interface GanttGridPlacement {
  startIndex: number; // -1 表示日期缺失
  endIndex: number;
  span: number; // 占用列数(end - start + 1)
  leftPx: number; // 基于 timeline 真实起点的像素左偏移
  widthPx: number; // 基于真实天数的像素宽度
  startOffsetDays: number;
  durationDays: number;
}

/** 周/月/日粒度下，从起点生成 unit 序列 */
export function buildTimelineUnits(
  rangeStart: string,
  rangeEnd: string,
  scale: GanttScale
): GanttTimelineUnit[] {
  const start = dayjs(rangeStart, ISO_DATE);
  const end = dayjs(rangeEnd, ISO_DATE);
  if (!start.isValid() || !end.isValid() || end.isBefore(start)) {
    return [];
  }

  if (scale === 'day') {
    return buildDayUnits(start, end);
  }
  if (scale === 'month') {
    return buildMonthUnits(start, end);
  }
  if (scale === 'year') {
    return buildYearUnits(start, end);
  }
  return buildWeekUnits(start, end);
}

function buildYearUnits(start: Dayjs, _end?: Dayjs): GanttTimelineUnit[] {
  const units: GanttTimelineUnit[] = [];
  const year = start.year();
  for (let m = 0; m < 12; m++) {
    const monthStart = dayjs().year(year).month(m).startOf('month');
    const monthEnd = dayjs().year(year).month(m).endOf('month');
    units.push({
      index: m,
      startDate: monthStart.format(ISO_DATE),
      endDate: monthEnd.format(ISO_DATE),
      label: `${m + 1}月`,
      daySpan: monthEnd.diff(monthStart, 'day') + 1,
    });
  }
  return units;
}

function buildDayUnits(start: Dayjs, end: Dayjs): GanttTimelineUnit[] {
  const units: GanttTimelineUnit[] = [];
  let cursor = start.startOf('day');
  let index = 0;
  while (!cursor.isAfter(end, 'day')) {
    const iso = cursor.format(ISO_DATE);
    units.push({
      index,
      startDate: iso,
      endDate: iso,
      label: cursor.format('M月D日'),
      daySpan: 1,
    });
    cursor = cursor.add(1, 'day');
    index += 1;
  }
  return units;
}

function buildWeekUnits(start: Dayjs, end: Dayjs): GanttTimelineUnit[] {
  const units: GanttTimelineUnit[] = [];
  let cursor = start.startOf('isoWeek');
  let index = 0;
  while (!cursor.isAfter(end, 'day')) {
    const weekEnd = cursor.add(6, 'day');
    units.push({
      index,
      startDate: cursor.format(ISO_DATE),
      endDate: weekEnd.format(ISO_DATE),
      label: `${cursor.format('M/D')}-${weekEnd.format('M/D')}`,
      daySpan: weekEnd.diff(cursor, 'day') + 1,
    });
    cursor = cursor.add(7, 'day');
    index += 1;
  }
  return units;
}

function buildMonthUnits(start: Dayjs, end: Dayjs): GanttTimelineUnit[] {
  const units: GanttTimelineUnit[] = [];
  let cursor = start.startOf('month');
  let index = 0;
  while (!cursor.isAfter(end, 'day')) {
    const monthEnd = cursor.endOf('month');
    const unitEnd = monthEnd.isAfter(end, 'day') ? end : monthEnd;
    units.push({
      index,
      startDate: cursor.format(ISO_DATE),
      endDate: unitEnd.format(ISO_DATE),
      label: cursor.format('YYYY年M月'),
      daySpan: unitEnd.diff(cursor, 'day') + 1,
    });
    cursor = cursor.add(1, 'month').startOf('month');
    index += 1;
  }
  return units;
}

/** 按 parentId + sortOrder 输出可见行；折叠的 id 集合对应的子树不展示 */
export function buildGanttRows(
  items: GanttItem[],
  collapsedIds: ReadonlySet<string> = new Set()
): GanttItem[] {
  if (items.length === 0) return [];
  const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder);
  const childrenMap = new Map<string | undefined, GanttItem[]>();
  sorted.forEach((item) => {
    const key = item.parentId;
    const bucket = childrenMap.get(key) ?? [];
    bucket.push(item);
    childrenMap.set(key, bucket);
  });

  const result: GanttItem[] = [];
  const walk = (parentId: string | undefined) => {
    const children = childrenMap.get(parentId) ?? [];
    children.forEach((child) => {
      result.push(child);
      if (!collapsedIds.has(child.id)) {
        walk(child.id);
      }
    });
  };
  walk(undefined);
  return result;
}

/** 计算行项在 units 网格中的起止列 */
export function getItemGridPlacement(
  item: GanttItem,
  units: GanttTimelineUnit[],
  pxPerDay = 1
): GanttGridPlacement {
  if (!item.startDate || !item.dueDate || units.length === 0) {
    return emptyPlacement();
  }
  const rangeStart = units[0].startDate;
  const rangeEnd = units[units.length - 1].endDate;
  const itemStart = clampDate(item.startDate, rangeStart, rangeEnd);
  const itemEnd = clampDate(item.dueDate, itemStart, rangeEnd);

  const startIndex = units.findIndex((u) => u.endDate >= itemStart);
  let endIndex = -1;
  for (let i = units.length - 1; i >= 0; i -= 1) {
    if (units[i].startDate <= itemEnd) {
      endIndex = i;
      break;
    }
  }
  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    return emptyPlacement();
  }
  const startOffsetDays = dayjs(itemStart, ISO_DATE).diff(dayjs(rangeStart, ISO_DATE), 'day');
  const durationDays = dayjs(itemEnd, ISO_DATE).diff(dayjs(itemStart, ISO_DATE), 'day') + 1;
  return {
    startIndex,
    endIndex,
    span: endIndex - startIndex + 1,
    leftPx: startOffsetDays * pxPerDay,
    widthPx: Math.max(durationDays * pxPerDay, pxPerDay),
    startOffsetDays,
    durationDays,
  };
}

function emptyPlacement(): GanttGridPlacement {
  return {
    startIndex: -1,
    endIndex: -1,
    span: 0,
    leftPx: 0,
    widthPx: 0,
    startOffsetDays: 0,
    durationDays: 0,
  };
}

export function getTimelineTotalDays(units: GanttTimelineUnit[]): number {
  return units.reduce((sum, unit) => sum + unit.daySpan, 0);
}

export function getTimelineWidthPx(units: GanttTimelineUnit[], pxPerDay: number): number {
  return getTimelineTotalDays(units) * pxPerDay;
}

export function getDateOffsetPx(date: string, units: GanttTimelineUnit[], pxPerDay: number): number | null {
  if (units.length === 0) return null;
  const timelineStart = units[0].startDate;
  const timelineEnd = units[units.length - 1].endDate;
  if (date < timelineStart || date > timelineEnd) return null;
  return dayjs(date, ISO_DATE).diff(dayjs(timelineStart, ISO_DATE), 'day') * pxPerDay;
}

function clampDate(date: string, min: string, max: string): string {
  if (date < min) return min;
  if (date > max) return max;
  return date;
}
