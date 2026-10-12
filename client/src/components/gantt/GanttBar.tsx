/**
 * 甘特图时间轴上的任务进度条 (只读 + 点击查看详情)
 */
import { cn } from '@/lib/utils';
import type { GanttItem } from './types';

interface GanttBarProps {
  item: GanttItem;
  leftPx: number;
  widthPx: number;
  rowHeight: number;
  onClick?: (item: GanttItem) => void;
}

const STATUS_COLOR: Record<string, string> = {
  in_progress: '#2383E2',
  delayed_in_progress: '#D95F02',
  done: '#0F7B0F',
  delayed_done: '#0F7B0F',
  canceled: '#787774',
};

export default function GanttBar({
  item,
  leftPx,
  widthPx,
  rowHeight,
  onClick,
}: GanttBarProps) {
  const left = leftPx;
  const width = Math.max(widthPx - 4, 16);
  const baseColor = STATUS_COLOR[item.status] ?? '#2383E2';
  const isOverdue = item.isDelayed;
  const isCritical = item.isCritical;

  return (
    <div
      className={cn('absolute top-1/2 -translate-y-1/2')}
      style={{ left, width, height: Math.max(rowHeight - 16, 18) }}
    >
      <button
        type="button"
        onClick={onClick ? () => onClick(item) : undefined}
        className={cn(
          'relative flex h-full w-full cursor-pointer items-center overflow-hidden rounded-sm border text-left text-xs leading-none text-white',
          'hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2383E2]/40',
        )}
        style={{
          background: baseColor,
          borderColor: isOverdue ? '#D95F02' : isCritical ? '#D9B33A' : 'transparent',
          borderWidth: isOverdue || isCritical ? 1 : 0,
          opacity: item.status === 'canceled' ? 0.5 : 1,
        }}
        title={`${item.name}${item.startDate ? ` · ${item.startDate} → ${item.dueDate ?? '?'}` : ''}`}
      >
        <span
          className="pointer-events-none absolute inset-y-0 left-0 bg-white/30"
          style={{ width: `${Math.max(0, Math.min(100, item.progress))}%` }}
          aria-hidden
        />
        <span className="pointer-events-none relative z-10 block flex-1 truncate px-2">
          {item.name}
        </span>
      </button>
    </div>
  );
}
