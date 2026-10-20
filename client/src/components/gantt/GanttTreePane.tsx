/**
 * 甘特图左侧树形列表
 */
import { ChevronDown, ChevronRight, Folder, ListChecks } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GanttItem } from './types';

interface GanttTreePaneProps {
  rows: GanttItem[];
  collapsedIds: ReadonlySet<string>;
  parentIds?: ReadonlySet<string>;
  onToggleCollapse: (id: string) => void;
  rowHeight: number;
  onSelectItem?: (item: GanttItem) => void;
}

export default function GanttTreePane({
  rows,
  collapsedIds,
  parentIds,
  onToggleCollapse,
  rowHeight,
  onSelectItem,
}: GanttTreePaneProps) {
  return (
    <div className="border-r border-[#EFEFEF]">
      {rows.map((row) => {
        const hasChildren = parentIds ? parentIds.has(row.id) : rows.some((r) => r.parentId === row.id);
        const collapsed = collapsedIds.has(row.id);
        return (
          <div
            key={row.id}
            className={cn(
              'flex items-center gap-2 border-b border-[#F3F3F1] px-3 text-sm text-[#37352F]',
              'bg-white hover:bg-[#FAFAF8] transition-colors'
            )}
            style={{ paddingLeft: 12 + row.depth * 16, height: rowHeight }}
          >
            {hasChildren ? (
              <button
                type="button"
                onClick={() => onToggleCollapse(row.id)}
                className="text-[#9B9A97] hover:text-[#37352F]"
                aria-label={collapsed ? '展开' : '折叠'}
              >
                {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
            ) : (
              <span className="inline-block w-3.5" />
            )}
            {hasChildren ? (
              <Folder className="h-3.5 w-3.5 shrink-0 text-[#2383E2]" />
            ) : (
              <ListChecks className="h-3.5 w-3.5 shrink-0 text-[#787774]" />
            )}
            <button
              type="button"
              onClick={onSelectItem ? () => onSelectItem(row) : undefined}
              className="flex-1 truncate text-left hover:text-[#2383E2] cursor-pointer"
              title={row.name}
            >
              {row.name}
            </button>
            {row.assigneeName ? (
              <span className="shrink-0 text-xs text-[#9B9A97] max-w-[60px] truncate" title={row.assigneeName}>
                {row.assigneeName}
              </span>
            ) : null}
            {row.isDelayed ? (
              <span className="shrink-0 rounded-sm bg-[#FBE9E1] px-1 text-[10px] text-[#D95F02]">逾期</span>
            ) : null}
            {row.isCritical ? (
              <span className="shrink-0 rounded-sm bg-[#FEE2E2] px-1 text-[10px] text-[#DC2626]">紧急</span>
            ) : null}
            <span className="w-10 text-right text-xs text-[#9B9A97]" title={`时间进度：${row.progress}%`}>{row.progress}%</span>
          </div>
        );
      })}
    </div>
  );
}
