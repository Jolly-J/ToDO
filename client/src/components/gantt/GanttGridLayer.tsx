/**
 * 甘特图背景网格
 */
import type { GanttTimelineUnit } from './ganttViewModel';
import type { GanttScale } from './types';

interface GanttGridLayerProps {
  units: GanttTimelineUnit[];
  rowCount: number;
  rowHeight: number;
  pxPerDay: number;
  totalWidth: number;
  scale?: GanttScale;
}

export default function GanttGridLayer({
  units,
  rowCount,
  rowHeight,
  pxPerDay,
  totalWidth,
  scale,
}: GanttGridLayerProps) {
  const isYear = scale === 'year';

  return (
    <div className="pointer-events-none absolute inset-0">
      {isYear ? (
        <div className="flex h-full w-full">
          {units.map((unit) => (
            <div
              key={unit.index}
              className="h-full border-r border-[#F3F3F1] last:border-r-0"
              style={{ flex: `${unit.daySpan} 0 0%` }}
            />
          ))}
        </div>
      ) : (
        units.map((unit, index) => {
          const unitLeft =
            units.slice(0, index).reduce((sum, prev) => sum + prev.daySpan, 0) * pxPerDay;
          const width = unit.daySpan * pxPerDay;
          return (
            <div
              key={unit.index}
              className="absolute top-0 h-full border-r border-[#F3F3F1] last:border-r-0"
              style={{ left: unitLeft, width }}
            />
          );
        })
      )}
      {Array.from({ length: rowCount }).map((_, index) => (
        <div
          key={index}
          className="absolute border-b border-[#F3F3F1] w-full"
          style={{ top: (index + 1) * rowHeight, left: 0, minWidth: totalWidth }}
        />
      ))}
    </div>
  );
}
