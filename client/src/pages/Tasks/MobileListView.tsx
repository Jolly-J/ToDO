/**
 * [MOBILE ADAPTATION] 任务列表移动端视图
 * 采用卡片列表模式，整合筛选与搜索。
 */
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DateRangePicker } from '@/components/ui/date-picker';
import MobileTaskCard from '@/components/task/shared/MobileTaskCard'; // [MOBILE ONLY]
import type { Task, TaskStatus } from '@/types';

interface DateRangeFilter {
  startDate: string | null;
  endDate: string | null;
}

interface MobileListViewProps {
  tasks: Task[];
  total: number;
  loading: boolean;
  searchDraft: string;
  setSearchDraft: (val: string) => void;
  onSearch: (val: string) => void;
  statusFilter?: TaskStatus;
  onStatusChange: (val: TaskStatus | undefined) => void;
  dueDateRange: DateRangeFilter;
  onDueDateRangeChange: (range: DateRangeFilter) => void;
  onTaskClick: (id: string) => void;
}

export default function MobileListView({
  tasks,
  loading,
  searchDraft,
  setSearchDraft,
  onSearch,
  statusFilter,
  onStatusChange,
  dueDateRange,
  onDueDateRangeChange,
  onTaskClick,
}: MobileListViewProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* 1. 搜索与筛选区域 */}
      <div className="flex flex-col gap-3">
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

        <div className="flex gap-2">
          <div className="flex-1">
            <Select
              value={statusFilter ?? '__all__'}
              onValueChange={(value) => onStatusChange(value === '__all__' ? undefined : (value as TaskStatus))}
            >
              <SelectTrigger className="w-full h-9 bg-[#F9FAFB] border-none rounded-md shadow-none text-[12px]">
                <SelectValue placeholder="所有状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">所有状态</SelectItem>
                <SelectItem value="in_progress">进行中</SelectItem>
                <SelectItem value="delayed_in_progress">延期进行中</SelectItem>
                <SelectItem value="done">已完成</SelectItem>
                <SelectItem value="delayed_done">延期完成</SelectItem>
                <SelectItem value="canceled">已取消</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <DateRangePicker
              startDate={dueDateRange.startDate}
              endDate={dueDateRange.endDate}
              testId="task-mobile-due-date-range"
              onChange={onDueDateRangeChange}
            />
          </div>
        </div>
      </div>

      {/* 2. 任务列表 */}
      <div className="flex flex-col gap-3">
        {loading ? (
          <div className="py-20 text-center text-muted-foreground text-sm">加载任务中...</div>
        ) : tasks.length > 0 ? (
          tasks.map((task) => (
            <MobileTaskCard 
              key={task.id} 
              task={task} 
              onClick={() => onTaskClick(task.id)} 
            />
          ))
        ) : (
          <div className="py-20 text-center text-muted-foreground bg-accent/10 rounded-2xl border border-dashed text-sm">
            该团队暂无任务
          </div>
        )}
      </div>
    </div>
  );
}
