/**
 * [MOBILE ADAPTATION] 移动端视图 (MOBILE ONLY)
 * 采用卡片式布局，优化小屏下的阅读与交互体验。
 */
import { Search, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import TaskWorkbenchChips from '@/components/task/workbench/TaskWorkbenchChips';
import MobileTaskCard from '@/components/task/shared/MobileTaskCard'; // [MOBILE ONLY]
import { cn } from '@/lib/utils'; // [MOBILE ONLY] 导入样式合并工具
import type { Task, MyTaskScope, MyTaskStatusFilter } from '@/types';

interface MobileViewProps {
  tasks: Task[];
  total: number;
  loading: boolean;
  myTaskSummary: Record<string, number>;
  scope: MyTaskScope;
  setScope: (scope: MyTaskScope) => void;
  status: MyTaskStatusFilter;
  setStatus: (status: MyTaskStatusFilter) => void;
  searchDraft: string;
  setSearchDraft: (val: string) => void;
  onSearch: (val: string) => void;
  dueDateRange?: { startDate: string | null; endDate: string | null };
  onDueDateRangeChange?: (range: { startDate: string | null; endDate: string | null }) => void;
  onTaskClick: (id: string) => void;
  onCreateClick: () => void;
  pageIndex?: number;
  onPageIndexChange?: (pageIndex: number) => void;
  scopeOptions: any[];
  statusOptions: any[];
}

export default function MobileView({
  tasks,
  loading,
  myTaskSummary,
  scope,
  setScope,
  status,
  setStatus,
  searchDraft,
  setSearchDraft,
  onSearch,
  onTaskClick,
  onCreateClick,
  scopeOptions,
  statusOptions,
}: MobileViewProps) {
  return (
    <div className="flex flex-col gap-4 pb-6">
      {/* 1. 简化的移动端页头 */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-[#37352F]">我的任务</h2>
          <button
            type="button"
            onClick={onCreateClick}
            className="flex items-center gap-1 bg-[#2783DE] text-white px-2.5 py-1 rounded text-xs font-medium active:bg-[#1B6BC7]"
          >
            <Plus className="h-3.5 w-3.5" />
            新建任务
          </button>
        </div>
        <div className="flex items-center bg-[#F9FAFB] rounded-md h-10 px-3 transition-colors focus-within:bg-[#F3F4F6]">
          <Search className="h-4 w-4 text-[#9B9A97] shrink-0" />
          <Input
            className="flex-1 bg-transparent border-none shadow-none h-full px-2 placeholder:text-[#9B9A97] focus-visible:ring-0"
            placeholder="搜索任务..."
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            onBlur={() => onSearch(searchDraft.trim())}
            onKeyDown={(e) => e.key === 'Enter' && onSearch(searchDraft.trim())}
          />
        </div>
      </div>

      {/* 2. 维度切换卡片 - 移动端支持横向滑动 */}
      <section className="overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
        <div className="flex gap-3 min-w-max">
          {scopeOptions.map((item) => (
            <button
              key={item.key}
              onClick={() => setScope(item.key)}
              className={cn(
                "flex flex-col items-center justify-center p-3 rounded-lg transition-all min-w-[100px]",
                scope === item.key 
                ? "bg-[#37352F] text-white" 
                : "bg-[#FAFAFA] text-[#787774] active:bg-[#EFEFEF]"
              )}
            >
              <span className="text-lg font-bold">{myTaskSummary[item.key] || 0}</span>
              <span className="text-[10px] opacity-80">{item.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* 3. 状态筛选 Chips */}
      <div className="flex items-center gap-2 overflow-x-auto -mx-4 px-4 scrollbar-hide">
        <TaskWorkbenchChips
          items={statusOptions}
          activeKey={status}
          onChange={(key) => setStatus(key as MyTaskStatusFilter)}
        />
      </div>

      {/* 4. 任务列表 - 移动端卡片 */}
      <div className="flex flex-col gap-3 mt-2">
        {loading ? (
          <div className="py-20 text-center text-muted-foreground">加载中...</div>
        ) : tasks.length > 0 ? (
          tasks.map((task) => (
            <MobileTaskCard 
              key={task.id} 
              task={task} 
              onClick={() => onTaskClick(task.id)} 
            />
          ))
        ) : (
          <div className="py-20 text-center text-muted-foreground bg-accent/20 rounded-2xl border border-dashed">
            暂无任务
          </div>
        )}
      </div>
    </div>
  );
}
