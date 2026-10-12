/**
 * [MOBILE ADAPTATION] 任务列表桌面视图
 * 提取自原 TaskListView.tsx。
 */
import { useMemo } from 'react';
import type { KeyboardEvent } from 'react';
import { Download } from 'lucide-react';
import dayjs from 'dayjs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DateRangePicker } from '@/components/ui/date-picker';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useTeamStore } from '@/store';
import { exportTasksToExcel } from '@/utils/exportTasks';
import TaskTableView from '@/components/task/table/TaskTableView';
import {
  createTaskAssigneeColumn,
  createTaskDateColumn,
  createTaskParticipantsColumn,
  createTaskPriorityColumn,
  createTaskStatusColumn,
  createTaskTitleColumn,
  useTaskColumnSizeProfile,
} from '@/components/task/table/TaskTableColumnPresets';
import {
  createTaskDateSortingFn,
  createTaskTextSortingFn,
  taskPrioritySortingFn,
  taskStatusSortingFn,
} from '@/components/task/table/taskTableSorting';
import {
  taskToolbarFiltersStyle,
  taskToolbarLeadingStyle,
  taskToolbarMiddleStyle,
  taskToolbarRowStyle,
  taskToolbarTrailingStyle,
} from './toolbarStyles';
import styles from './TaskListView.module.css';
import type { Task, TaskStatus } from '@/types';

interface DateRangeFilter {
  startDate: string | null;
  endDate: string | null;
}

interface DesktopListViewProps {
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
  pageIndex?: number;
  onPageIndexChange?: (pageIndex: number) => void;
  toolbarStart?: React.ReactNode;
  toolbarEnd?: React.ReactNode;
}

import { buildTaskTree } from '@/utils/task/buildTaskTree';
export { buildTaskTree };

export default function DesktopListView({
  tasks,
  total,
  loading,
  searchDraft,
  setSearchDraft,
  onSearch,
  statusFilter,
  onStatusChange,
  dueDateRange,
  onDueDateRangeChange,
  onTaskClick,
  pageIndex,
  onPageIndexChange,
  toolbarStart,
  toolbarEnd,
}: DesktopListViewProps) {
  const columnSizeProfile = useTaskColumnSizeProfile();
  const treeTasks = useMemo(() => buildTaskTree(tasks), [tasks]);

  const columns = useMemo(
    () => [
      createTaskTitleColumn({
        title: '任务标题',
        key: 'title',
        width: columnSizeProfile.title,
      }),
      createTaskAssigneeColumn({
        width: columnSizeProfile.assignee,
        enableSorting: true,
        sortingFn: createTaskTextSortingFn(
          (task) => task.assignee_name || (task.assignee_id ? '未命名成员' : '')
        ),
      }),
      createTaskParticipantsColumn({
        width: columnSizeProfile.participants,
      }),
      createTaskPriorityColumn({
        width: 80,
        enableSorting: true,
        sortingFn: taskPrioritySortingFn,
      }),
      createTaskStatusColumn({
        width: 100,
        enableSorting: true,
        sortingFn: taskStatusSortingFn,
      }),
      createTaskDateColumn({
        title: '开始日期',
        dataIndex: 'start_date',
        key: 'start_date',
        width: 120,
        enableSorting: true,
        sortingFn: createTaskDateSortingFn('start_date'),
      }),
      createTaskDateColumn({
        title: '截止日期',
        dataIndex: 'due_date',
        key: 'due_date',
        width: 120,
        enableSorting: true,
        sortingFn: createTaskDateSortingFn('due_date'),
      }),
    ],
    [columnSizeProfile]
  );

  const currentTeam = useTeamStore((state) => state.currentTeam);

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      onSearch(searchDraft.trim());
    }
  };

  const handleExport = () => {
    const teamName = currentTeam?.name || tasks[0]?.team_name || '团队';
    const timeStr = dayjs().format('YYYYMMDD_HHmm');
    const filename = `${teamName}_任务列表_${timeStr}.xlsx`;
    exportTasksToExcel(tasks, filename);
  };

  return (
    <div>
      <div data-tour="team-workspace-toolbar" style={taskToolbarRowStyle}>
        <div style={taskToolbarLeadingStyle} data-testid="task-toolbar-leading">{toolbarStart}</div>
        <div style={taskToolbarMiddleStyle} data-testid="task-toolbar-middle">
          <div style={taskToolbarFiltersStyle}>
            <Input
              placeholder="搜索任务"
              className={styles.formalSearch}
              value={searchDraft}
              onBlur={() => onSearch(searchDraft.trim())}
              onChange={(event) => setSearchDraft(event.target.value)}
              onKeyDown={handleSearchKeyDown}
            />
            <Select
              value={statusFilter ?? '__all__'}
              onValueChange={(value) => onStatusChange(value === '__all__' ? undefined : (value as TaskStatus))}
            >
              <SelectTrigger className={styles.formalSelect}>
                <SelectValue placeholder="全部状态" />
              </SelectTrigger>
              <SelectContent className="min-w-[140px]">
                <SelectItem value="__all__">全部状态</SelectItem>
                <SelectItem value="in_progress">进行中</SelectItem>
                <SelectItem value="delayed_in_progress">延期进行中</SelectItem>
                <SelectItem value="done">已完成</SelectItem>
                <SelectItem value="delayed_done">延期完成</SelectItem>
                <SelectItem value="canceled">已取消</SelectItem>
              </SelectContent>
            </Select>
            <div className={styles.formalDateRange}>
              <DateRangePicker
                startDate={dueDateRange.startDate}
                endDate={dueDateRange.endDate}
                testId="task-list-due-date-range"
                onChange={onDueDateRangeChange}
              />
            </div>
          </div>
        </div>
        <div style={taskToolbarTrailingStyle} data-testid="task-toolbar-trailing">
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExport}
                    style={{
                      height: 'var(--tf-density-toolbar-control-height, 32px)',
                      borderRadius: 8,
                    }}
                    className="flex items-center gap-1.5 px-3 text-xs font-medium cursor-pointer"
                  >
                    <Download className="h-4 w-4" />
                    导出
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  导出当前筛选视图内容
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {toolbarEnd}
          </div>
        </div>
      </div>

      <TaskTableView
        surfaceTestId="task-list-shell"
        columns={columns}
        dataSource={treeTasks}
        rowKey="id"
        loading={loading}
        pagination={{
          total,
          pageSize: 20,
          ...(pageIndex !== undefined && onPageIndexChange
            ? { pageIndex, onPageIndexChange }
            : {}),
        }}
        onRow={(record) => ({ onClick: () => onTaskClick(record.id) })}
      />
    </div>
  );
}
