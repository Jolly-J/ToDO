/**
 * 甘特图今天贯穿线
 */
import dayjs from 'dayjs';
import { getDateOffsetPx, getTimelineWidthPx, type GanttTimelineUnit } from './ganttViewModel';

interface GanttTodayLineProps {
  units: GanttTimelineUnit[];
  pxPerDay: number;
}

export default function GanttTodayLine({ units, pxPerDay }: GanttTodayLineProps) {
  if (units.length === 0) return null;
  const today = dayjs().format('YYYY-MM-DD');
  const offsetPx = getDateOffsetPx(today, units, pxPerDay);
  const totalPx = getTimelineWidthPx(units, pxPerDay);
  if (offsetPx === null || offsetPx > totalPx) return null;

  return (
    <div
      className="pointer-events-none absolute top-0 z-10 h-full"
      style={{ left: offsetPx, width: 0, borderLeft: '1px dashed #B26A1B' }}
      aria-hidden
    />
  );
}
