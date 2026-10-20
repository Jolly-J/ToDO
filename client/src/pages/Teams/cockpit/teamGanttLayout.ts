/** 团队甘特图的时间范围与缩放计算；全览按筛选后的完整排期适配容器。 */
import dayjs from 'dayjs';
import {
  buildTimelineUnits,
  getTimelineWidthPx,
  type GanttItem,
  type GanttScale,
} from '@/components/gantt';

const PX_PER_DAY = { day: 44, week: 18, month: 6 };

/** 按实际天数计算排期已过比例，与任务状态、子任务完成数无关。 */
export function getTimeProgress(startDate: string, dueDate: string, today: string): number {
  const start = dayjs(startDate).startOf('day');
  const end = dayjs(dueDate).startOf('day');
  const current = dayjs(today).startOf('day');
  if (!start.isValid() || !end.isValid() || !current.isValid() || end.isBefore(start)) return 0;
  if (current.isBefore(start)) return 0;
  if (!current.isBefore(end)) return 100;
  return Math.round(current.diff(start, 'day') / end.diff(start, 'day') * 100);
}

export function buildTeamGanttLayout({
  items, scale, availableWidth, today, zoom = 100, fit = false,
}: {
  items: GanttItem[];
  scale: GanttScale;
  availableWidth: number;
  today: string;
  zoom?: number;
  fit?: boolean;
}) {
  const width = Math.max(1, availableWidth);
  let renderScale = scale;
  let start = dayjs(today);
  let end = start;
  const starts = items.map((item) => item.startDate).filter((date): date is string => Boolean(date && dayjs(date).isValid())).sort();
  const ends = items.map((item) => item.dueDate).filter((date): date is string => Boolean(date && dayjs(date).isValid())).sort();
  const taskStart = starts[0];
  const taskEnd = ends.at(-1);

  if (fit && items.length > 0) {
    start = dayjs(taskStart || today).subtract(2, 'day');
    end = dayjs(taskEnd || today).add(2, 'day');
    if (end.isBefore(start)) end = start.add(4, 'day');
    // 压缩时减少日期标签密度，避免长跨度的日标签挤出容器。
    const days = end.diff(start, 'day') + 1;
    renderScale = days > 120 ? 'month' : days > 21 ? 'week' : 'day';
  } else if (scale === 'year') {
    start = start.startOf('year');
    end = start.endOf('year');
  } else {
    items.forEach((item) => {
      if (item.startDate && item.startDate < start.format('YYYY-MM-DD')) start = dayjs(item.startDate);
      if (item.dueDate && item.dueDate > end.format('YYYY-MM-DD')) end = dayjs(item.dueDate);
    });
    start = start.subtract(scale === 'month' ? 15 : 4, 'day');
    end = end.add(scale === 'month' ? 15 : 7, 'day');
    if (end.diff(start, 'day') < 14) {
      start = start.subtract(7, 'day');
      end = end.add(14, 'day');
    }
    const minDaysToFill = Math.ceil(width / (PX_PER_DAY[scale] * zoom / 100));
    if (end.diff(start, 'day') + 1 < minDaysToFill) {
      end = start.add(minDaysToFill + (scale === 'month' ? 30 : 7), 'day');
    }
  }

  const units = buildTimelineUnits(start.format('YYYY-MM-DD'), end.format('YYYY-MM-DD'), renderScale);
  const days = units.reduce((sum, unit) => sum + unit.daySpan, 0) || 1;
  const pxPerDay = fit ? width / days : scale === 'year'
    ? width / days * zoom / 100
    : PX_PER_DAY[scale] * zoom / 100;

  return { units, renderScale, pxPerDay, taskStart, taskEnd, timelineWidth: getTimelineWidthPx(units, pxPerDay) };
}
