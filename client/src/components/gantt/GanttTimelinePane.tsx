/**
 * 甘特图时间轴 (右侧网格 + 任务条 + 今天线)
 */
import GanttBar from './GanttBar';
import GanttGridLayer from './GanttGridLayer';
import GanttTodayLine from './GanttTodayLine';
import { getTimelineWidthPx, type GanttTimelineUnit, type GanttGridPlacement } from './ganttViewModel';
import type { GanttItem, GanttScale } from './types';

interface GanttTimelinePaneProps {
  units: GanttTimelineUnit[];
  rows: GanttItem[];
  placements: Map<string, GanttGridPlacement>;
  pxPerDay: number;
  rowHeight: number;
  scale?: GanttScale;
  onClickTask?: (item: GanttItem) => void;
}

export default function GanttTimelinePane({
  units,
  rows,
  placements,
  pxPerDay,
  rowHeight,
  scale,
  onClickTask,
}: GanttTimelinePaneProps) {
  const totalWidth = getTimelineWidthPx(units, pxPerDay);
  const totalHeight = rows.length * rowHeight;

  return (
    <div className="relative flex-1 min-w-0" style={{ minWidth: totalWidth, height: totalHeight }}>
      <GanttGridLayer
        units={units}
        rowCount={rows.length}
        rowHeight={rowHeight}
        pxPerDay={pxPerDay}
        totalWidth={totalWidth}
        scale={scale}
      />
      {rows.map((row, i) => {
        const placement = placements.get(row.id);
        const top = i * rowHeight;
        if (!placement || placement.startIndex === -1) {
          return null;
        }
        return (
          <div
            key={row.id}
            className="absolute"
            style={{ top, left: 0, right: 0, height: rowHeight }}
          >
            <GanttBar
              item={row}
              leftPx={placement.leftPx}
              widthPx={placement.widthPx}
              maxWidthPx={totalWidth - placement.leftPx}
              rowHeight={rowHeight}
              onClick={onClickTask}
            />
          </div>
        );
      })}
      <GanttTodayLine units={units} pxPerDay={pxPerDay} />
    </div>
  );
}
