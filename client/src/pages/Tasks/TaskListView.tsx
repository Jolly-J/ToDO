/**
 * 组件名称：任务列表视图 (容器组件)
 * 文件作用：以表格形式展示团队任务。
 * [MOBILE ADAPTATION] 统一路由模式，分发桌面表格/移动卡片视图。
 */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTaskStore } from '@/store';
import type { TaskStatus } from '@/types';
import { useIsMobile } from '@/hooks/useIsMobile';
import DesktopListView from './DesktopListView';
import MobileListView from './MobileListView';

interface TaskListViewProps {
  teamId?: string;
  onTaskClick?: (taskId: string) => void;
  toolbarStart?: React.ReactNode;
  toolbarEnd?: React.ReactNode;
}

export default function TaskListView({ teamId: teamIdProp, onTaskClick, toolbarStart, toolbarEnd }: TaskListViewProps) {
  const isMobile = useIsMobile();
  const [searchParams] = useSearchParams();
  const teamId = teamIdProp || searchParams.get('teamId') || '';
  const { tasks, total, loading, fetchTasks, setViewFilters } = useTaskStore();
  
  const [search, setSearch] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [pageIndex, setPageIndex] = useState(0);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | undefined>(
    isMobile ? 'in_progress' : undefined
  );
  const [dueDateRange, setDueDateRange] = useState<{ startDate: string | null; endDate: string | null }>({
    startDate: null,
    endDate: null,
  });

  useEffect(() => {
    if (!teamId) {
      return;
    }

    setViewFilters('list', {
      keyword: search,
      status: statusFilter,
      dueStartDate: dueDateRange.startDate || undefined,
      dueEndDate: dueDateRange.endDate || undefined,
    });
    fetchTasks(teamId);
  }, [teamId, search, statusFilter, dueDateRange, setViewFilters, fetchTasks]);

  const handleTaskClick = (id: string) => {
    onTaskClick?.(id);
  };

  const sharedProps = {
    tasks,
    total,
    loading,
    searchDraft,
    setSearchDraft,
    onSearch: (val: string) => {
      setPageIndex(0);
      setSearch(val);
    },
    statusFilter,
    onStatusChange: (nextStatus: TaskStatus | undefined) => {
      setPageIndex(0);
      setStatusFilter(nextStatus);
    },
    dueDateRange,
    onDueDateRangeChange: (nextRange: { startDate: string | null; endDate: string | null }) => {
      setPageIndex(0);
      setDueDateRange(nextRange);
    },
    onTaskClick: handleTaskClick,
    pageIndex,
    onPageIndexChange: setPageIndex,
    toolbarStart,
    toolbarEnd,
  };

  return (
    <>
      {!isMobile ? (
        <DesktopListView {...sharedProps} />
      ) : (
        <MobileListView {...sharedProps} />
      )}
    </>
  );
}
