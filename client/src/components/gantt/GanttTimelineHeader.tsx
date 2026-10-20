/**
 * 甘特图时间轴表头
 */
import dayjs from 'dayjs';
import { getDateOffsetPx, getTimelineWidthPx, type GanttTimelineUnit } from './ganttViewModel';

import type { GanttScale } from './types';

interface GanttTimelineHeaderProps {
  units: GanttTimelineUnit[];
  pxPerDay: number;
  scale?: GanttScale;
  compactLabels?: boolean;
}

export default function GanttTimelineHeader({ units, pxPerDay, scale, compactLabels = false }: GanttTimelineHeaderProps) {
  const today = dayjs().format('YYYY-MM-DD');
  const todayOffsetPx = getDateOffsetPx(today, units, pxPerDay);
  const totalPx = getTimelineWidthPx(units, pxPerDay);
  const showTodayMarker = todayOffsetPx !== null && todayOffsetPx <= totalPx;
  const isYear = scale === 'year';
  const labelStride = compactLabels ? Math.max(1, Math.ceil(56 / (totalPx / units.length || 1))) : 1;

  return (
    <div className="relative flex flex-1 min-w-0 border-b border-[#EFEFEF] bg-[#FAFAF8]">
      {units.map((unit) => {
        const itemStyle = isYear
          ? { flex: `${unit.daySpan} 0 0%` }
          : { width: unit.daySpan * pxPerDay };

        return (
          <div
            key={unit.index}
            className="relative shrink-0 border-r border-[#F3F3F1] px-2 py-2 text-xs text-[#787774] text-center truncate last:border-r-0"
            style={{
              ...itemStyle,
              minWidth: 0,
              paddingInline: Math.min(compactLabels ? 4 : 8, Math.max(0, (unit.daySpan * pxPerDay - 1) / 2)),
              overflow: compactLabels ? 'visible' : undefined,
            }}
            title={`${unit.startDate} → ${unit.endDate}`}
          >
            {compactLabels ? (
              <span
                className="block truncate"
                style={{
                  width: Math.max(0, units.slice(unit.index, unit.index + labelStride)
                    .reduce((sum, next) => sum + next.daySpan * pxPerDay, 0) - 8),
                  visibility: unit.index % labelStride === 0 ? 'visible' : 'hidden',
                }}
              >
                {dayjs(unit.startDate).format(scale === 'month' ? 'YY/M' : 'M/D')}
              </span>
            ) : unit.label}
          </div>
        );
      })}
      {showTodayMarker ? (
        <div
          className="pointer-events-none absolute top-1 z-20 -translate-x-1/2 rounded-[3px] bg-[#B26A1B] px-1.5 py-0.5 text-[10px] font-medium leading-4 text-white shadow-sm"
          style={{ left: todayOffsetPx }}
        >
          今天 {today.slice(5)}
        </div>
      ) : null}
    </div>
  );
}
