/**
 * [MOBILE ADAPTATION] 桌面端视图
 * 提取自原 MyTasks/index.tsx，保留所有表格交互逻辑。
 */
import { useMemo } from 'react';
import type { KeyboardEvent } from 'react';
import { Plus, HelpCircle, Download } from 'lucide-react';
import dayjs from 'dayjs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useTourStore } from '@/components/onboarding/tourStore';
import { exportTasksToExcel } from '@/utils/exportTasks';
import TaskWorkbenchCards from '@/components/task/workbench/TaskWorkbenchCards';
import TaskWorkbenchChips from '@/components/task/workbench/TaskWorkbenchChips';
import TaskTableView from '@/components/task/table/TaskTableView';
import {
  createTaskAssigneeColumn,
  createTaskDateColumn,
  createTaskParticipantsColumn,
  createTaskPriorityColumn,
  createTaskStatusColumn,
  createTaskTextColumn,
  createTaskTitleColumn,
} from '@/components/task/table/TaskTableColumnPresets';
import {
  createTaskDateSortingFn,
  createTaskTextSortingFn,
  taskPrioritySortingFn,
  taskStatusSortingFn,
  taskTitleSortingFn,
} from '@/components/task/table/taskTableSorting';
import { DateRangePicker } from '@/components/ui/date-picker';
import { pageHeaderStyles } from '@/pages/pageHeaderStyles';
import styles from './MyTasks.module.css';
import type { MyTaskScope, MyTaskStatusFilter } from '@/types';
import { buildTaskTree } from '@/utils/task/buildTaskTree';

interface DesktopViewProps {
  tasks: any[];
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
  pageIndex: number;
  onPageIndexChange: (pageIndex: number) => void;
  scopeOptions: any[];
  statusOptions: any[];
}

export default function DesktopView({
  tasks,
  total,
  loading,
  myTaskSummary,
  scope,
  setScope,
  status,
  setStatus,
  searchDraft,
  setSearchDraft,
  onSearch,
  dueDateRange,
  onDueDateRangeChange,
  onTaskClick,
  onCreateClick,
  pageIndex,
  onPageIndexChange,
  scopeOptions,
  statusOptions,
}: DesktopViewProps) {
  const treeTasks = useMemo(() => buildTaskTree(tasks), [tasks]);
  const columns = useMemo(
    () => [
      createTaskTitleColumn({
        title: '任务',
        key: 'title',
        width: 280,
        showDescription: true,
        enableSorting: true,
        sortingFn: taskTitleSortingFn,
      }),
      createTaskTextColumn({
        title: '团队',
        dataIndex: 'team_name',
        key: 'team_name',
        width: 96,
        formatter: (value, record) => {
          if (!record.team_id || !value) {
            return '个人任务';
          }
          return String(value);
        },
        fallback: '个人任务',
        enableSorting: true,
        sortingFn: createTaskTextSortingFn((task) => task.team_name || ''),
      }),
      createTaskAssigneeColumn({
        title: '负责人',
        key: 'assignee',
        width: 104,
        emptyText: '-',
        enableSorting: true,
        sortingFn: createTaskTextSortingFn(
          (task) => task.assignee_name || (task.assignee_id ? '未命名成员' : '')
        ),
      }),
      createTaskParticipantsColumn({
        title: '参与人',
        key: 'participants',
        width: 126,
        emptyText: '-',
      }),
      createTaskTextColumn({
        title: '我的角色',
        dataIndex: 'my_role_labels',
        key: 'my_role_labels',
        width: 88,
        fallback: '-',
        formatter: (value) => Array.isArray(value) && value.length > 0 ? value.join(' / ') : '-',
        enableSorting: true,
        sortingFn: createTaskTextSortingFn((task) => (task.my_role_labels || []).join(' / ')),
      }),
      createTaskPriorityColumn({
        width: 72,
        enableSorting: true,
        sortingFn: taskPrioritySortingFn,
      }),
      createTaskStatusColumn({
        width: 88,
        enableSorting: true,
        sortingFn: taskStatusSortingFn,
      }),
      createTaskDateColumn({
        title: '截止时间',
        dataIndex: 'due_date',
        key: 'due_date',
        width: 78,
        format: 'MM/DD',
        fallback: '未设置',
        subtle: true,
        enableSorting: true,
        sortingFn: createTaskDateSortingFn('due_date'),
      }),
    ],
    []
  );

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      onSearch(searchDraft.trim());
    }
  };

  const handleExport = () => {
    const currentScopeLabel = scopeOptions.find((item) => item.key === scope)?.label || '任务';
    const currentStatusLabel = statusOptions.find((item) => item.key === status)?.label || '全部';
    const timeStr = dayjs().format('YYYYMMDD_HHmm');
    const filename = `我的任务_${currentScopeLabel}_${currentStatusLabel}_${timeStr}.xlsx`;
    exportTasksToExcel(tasks, filename);
  };

  const openTour = useTourStore((state) => state.openTour);

  return (
    <div className={styles.page}>
      <div style={{ ...pageHeaderStyles.toolbar, marginBottom: 0 }}>
        <div style={pageHeaderStyles.titleBlock}>
          <div className="flex items-center gap-2">
            <h2 style={pageHeaderStyles.title}>我的任务</h2>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => openTour('my-tasks')}
                    aria-label="查看页面操作指南"
                    className="inline-flex items-center justify-center h-6 w-6 rounded-full text-[#9B9A97] hover:text-[#37352F] hover:bg-[#EFEFEF] transition-colors cursor-pointer"
                  >
                    <HelpCircle className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  页面操作指南
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p style={pageHeaderStyles.meta}>按你与任务的关系切换工作视角，再用状态筛选快速收敛到当前真正要处理的任务。</p>
        </div>
        <div
          data-tour="my-tasks-actions"
          style={{ ...pageHeaderStyles.actions, display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Input
            className={styles.search}
            placeholder="搜索标题或描述"
            value={searchDraft}
            onBlur={() => onSearch(searchDraft.trim())}
            onChange={(event) => setSearchDraft(event.target.value)}
            onKeyDown={handleSearchKeyDown}
          />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  className="flex items-center gap-1.5 shrink-0 h-9 px-3 text-xs font-medium rounded-md shadow-xs transition-colors cursor-pointer"
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
          <Button
            size="sm"
            onClick={onCreateClick}
            className="flex items-center gap-1.5 bg-[#2783DE] hover:bg-[#1B6BC7] text-white shrink-0 h-9 px-3 text-xs font-medium rounded-md shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            新建任务
          </Button>
        </div>
      </div>

      <section data-tour="my-tasks-scope" className={styles.scopeSection}>
        <TaskWorkbenchCards
          className={styles.scopeCards}
          items={scopeOptions.map((item) => ({
            ...item,
            value: myTaskSummary[item.key] || 0,
          }))}
          activeKey={scope}
          onChange={(key) => setScope(key as MyTaskScope)}
        />
      </section>

      <div data-tour="my-tasks-status" className={styles.filterBar}>
        <TaskWorkbenchChips
          items={statusOptions}
          activeKey={status}
          onChange={(key) => setStatus(key as MyTaskStatusFilter)}
        />
        <div className="flex items-center gap-3">
          {dueDateRange && onDueDateRangeChange && (
            <div className={styles.formalDateRange}>
              <DateRangePicker
                startDate={dueDateRange.startDate}
                endDate={dueDateRange.endDate}
                testId="my-tasks-due-date-range"
                onChange={onDueDateRangeChange}
              />
            </div>
          )}
          <span className={styles.filterHint}>
            {scopeOptions.find((item) => item.key === scope)?.description}
          </span>
        </div>
      </div>

      <div>
        <TaskTableView
          columns={columns}
          dataSource={treeTasks}
          rowKey="id"
          loading={loading}
          pagination={{ total, pageSize: 20, pageIndex, onPageIndexChange }}
          locale={{
            emptyText: status !== 'all'
              ? `当前筛选条件下暂无${statusOptions.find(s => s.key === status)?.label || ''}任务`
              : scope === 'all'
                ? '当前没有和你相关的任务'
                : scope === 'assigned'
                ? '暂无分派给你的任务，可以查看「我参与的」或「我创建的」'
                : scope === 'participating'
                  ? '暂无你参与协作的任务'
                  : '暂无你创建的任务'
          }}
          onRow={(record) => ({
            onClick: () => onTaskClick(record.id),
          })}
        />
      </div>
    </div>
  );
}
