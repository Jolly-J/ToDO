/**
 * 甘特图顶部工具栏 (时间范围筛选、状态筛选、日/周/月粒度、风险筛选、今天、全部折叠)
 */
import { ChevronDown, ChevronRight, Filter, RotateCcw, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { GanttScale } from './types';

export interface GanttToolbarProps {
  scale: GanttScale;
  onScaleChange: (scale: GanttScale) => void;
  riskOnly: boolean;
  onRiskOnlyChange: (next: boolean) => void;
  onScrollToToday: () => void;
  onCollapseAll: () => void;
  onExpandAll: () => void;
  statusFilter?: string;
  onStatusFilterChange?: (status: string) => void;
  taskCount?: number;
}

const SCALE_OPTIONS: Array<{ value: GanttScale; label: string }> = [
  { value: 'day', label: '日' },
  { value: 'week', label: '周' },
  { value: 'month', label: '月' },
  { value: 'year', label: '年' },
];

export default function GanttToolbar({
  scale,
  onScaleChange,
  riskOnly,
  onRiskOnlyChange,
  onScrollToToday,
  onCollapseAll,
  onExpandAll,
  statusFilter = 'in_progress',
  onStatusFilterChange,
  taskCount,
}: GanttToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2.5 border-b border-[#EFEFEF] bg-[#FAFAF8] px-3 py-2.5">
      {/* 1. 任务状态筛选下拉 */}
      {onStatusFilterChange ? (
        <div className="flex items-center gap-1.5">
          <Select value={statusFilter} onValueChange={onStatusFilterChange}>
            <SelectTrigger className="h-8 w-[130px] bg-white text-xs border-[#EFEFEF] px-2.5 gap-1.5 shadow-none [&>span]:text-left [&>span]:flex-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-[#787774] shrink-0" />
              <SelectValue placeholder="任务状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="in_progress">进行中</SelectItem>
              <SelectItem value="unfinished">未完成</SelectItem>
              <SelectItem value="overdue">仅逾期</SelectItem>
              <SelectItem value="done">已完成</SelectItem>
              <SelectItem value="all">全部状态</SelectItem>
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {/* 3. 视图粒度切换 (日/周/月) */}
      <div className="flex overflow-hidden rounded-md border border-[#EFEFEF] bg-white">
        {SCALE_OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            size="sm"
            variant={scale === opt.value ? 'default' : 'ghost'}
            className="rounded-none h-8 px-3 text-xs"
            onClick={() => onScaleChange(opt.value)}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      {/* 4. 仅看逾期与紧急任务切换 */}
      <Button
        size="sm"
        variant={riskOnly ? 'default' : 'outline'}
        className="h-8 text-xs bg-white"
        onClick={() => onRiskOnlyChange(!riskOnly)}
      >
        <Filter className="mr-1 h-3.5 w-3.5" /> 仅看逾期/紧急
      </Button>

      {/* 5. 回到今天 */}
      <Button size="sm" variant="outline" className="h-8 text-xs bg-white" onClick={onScrollToToday}>
        <RotateCcw className="mr-1 h-3.5 w-3.5" /> 回到今天
      </Button>

      {/* 任务计数 */}
      {typeof taskCount === 'number' ? (
        <span className="text-xs text-[#9B9A97] ml-1">
          共 {taskCount} 项
        </span>
      ) : null}

      {/* 6. 右侧折叠/展开 */}
      <div className="ml-auto flex items-center gap-1">
        <Button size="sm" variant="ghost" className="h-8 text-xs text-[#787774]" onClick={onCollapseAll}>
          <ChevronDown className="mr-1 h-3.5 w-3.5" /> 全部折叠
        </Button>
        <Button size="sm" variant="ghost" className="h-8 text-xs text-[#787774]" onClick={onExpandAll}>
          <ChevronRight className="mr-1 h-3.5 w-3.5" /> 全部展开
        </Button>
      </div>
    </div>
  );
}
