/**
 * 打印页甘特图区块。
 * 文件作用：以静态、全览、无滚动的方式输出当前筛选后的任务排期，高度随任务行数自适应。
 */
import {
  GanttTimelineHeader,
  GanttTimelinePane,
  type GanttGridPlacement,
  type GanttItem,
  type GanttScale,
  type GanttTimelineUnit,
} from '@/components/gantt';
import PrintSectionTitle from './PrintSectionTitle';
import {
  PRINT_GANTT_HEADER_HEIGHT_PX,
  PRINT_GANTT_ROW_HEIGHT_PX,
  PRINT_GANTT_TIMELINE_WIDTH_PX,
  PRINT_GANTT_TREE_WIDTH_PX,
} from './printLayout';

interface PrintGanttSectionProps {
  rows: GanttItem[];
  units: GanttTimelineUnit[];
  renderScale: GanttScale;
  pxPerDay: number;
  placements: Map<string, GanttGridPlacement>;
  filterSummary: string;
}

function PrintGanttRow({ row }: { row: GanttItem }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        height: PRINT_GANTT_ROW_HEIGHT_PX,
        paddingLeft: 10 + row.depth * 14,
        paddingRight: 8,
        borderBottom: '1px solid #F3F3F1',
        fontSize: 12,
        color: '#37352F',
        boxSizing: 'border-box',
      }}
    >
      <span
        style={{
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {row.name}
      </span>
      {row.assigneeName ? (
        <span
          style={{
            flexShrink: 0,
            maxWidth: 56,
            fontSize: 10,
            color: '#9B9A97',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {row.assigneeName}
        </span>
      ) : null}
      {row.isDelayed ? (
        <span style={{ flexShrink: 0, padding: '0 3px', borderRadius: 2, background: '#FBE9E1', color: '#D95F02', fontSize: 9 }}>
          逾期
        </span>
      ) : null}
      {row.isCritical ? (
        <span style={{ flexShrink: 0, padding: '0 3px', borderRadius: 2, background: '#FEE2E2', color: '#DC2626', fontSize: 9 }}>
          紧急
        </span>
      ) : null}
      <span style={{ flexShrink: 0, width: 30, textAlign: 'right', fontSize: 10, color: '#9B9A97', fontVariantNumeric: 'tabular-nums' }}>
        {row.progress}%
      </span>
    </div>
  );
}

export default function PrintGanttSection({
  rows,
  units,
  renderScale,
  pxPerDay,
  placements,
  filterSummary,
}: PrintGanttSectionProps) {
  return (
    <section>
      <PrintSectionTitle title="任务排期甘特图" meta={`${filterSummary} · 全览`} />
      {rows.length === 0 ? (
        <div
          style={{
            marginTop: 10,
            padding: '28px 16px',
            borderRadius: 8,
            border: '1px dashed #E5E7EB',
            background: '#FAFAF9',
            textAlign: 'center',
            fontSize: 12,
            color: '#9B9A97',
          }}
        >
          当前筛选条件下没有可展示的任务排期
        </div>
      ) : (
        <div
          style={{
            marginTop: 10,
            display: 'flex',
            border: '1px solid #EFEFEF',
            borderRadius: 6,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: PRINT_GANTT_TREE_WIDTH_PX,
              flexShrink: 0,
              borderRight: '1px solid #EFEFEF',
              background: '#FFFFFF',
            }}
          >
            <div
              style={{
                height: PRINT_GANTT_HEADER_HEIGHT_PX,
                display: 'flex',
                alignItems: 'center',
                padding: '0 10px',
                borderBottom: '1px solid #EFEFEF',
                background: '#FAFAF8',
                fontSize: 12,
                fontWeight: 500,
                color: '#787774',
                boxSizing: 'border-box',
              }}
            >
              任务名称
            </div>
            {rows.map((row) => (
              <PrintGanttRow key={row.id} row={row} />
            ))}
          </div>
          <div style={{ width: PRINT_GANTT_TIMELINE_WIDTH_PX, flexShrink: 0, overflow: 'hidden' }}>
            <div
              style={{
                height: PRINT_GANTT_HEADER_HEIGHT_PX,
                overflow: 'hidden',
                borderBottom: '1px solid #EFEFEF',
                background: '#FAFAF8',
                boxSizing: 'border-box',
              }}
            >
              <GanttTimelineHeader units={units} pxPerDay={pxPerDay} scale={renderScale} compactLabels />
            </div>
            <GanttTimelinePane
              units={units}
              rows={rows}
              placements={placements}
              pxPerDay={pxPerDay}
              rowHeight={PRINT_GANTT_ROW_HEIGHT_PX}
              scale={renderScale}
            />
          </div>
        </div>
      )}
    </section>
  );
}
