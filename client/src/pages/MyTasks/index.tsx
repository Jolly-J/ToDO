/**
 * 页面名称：我的任务 (容器组件)
 * 文件作用：负责数据管理与视图分发。
 * [MOBILE ADAPTATION] 统一路由模式，根据设备环境加载 DesktopView 或 MobileView。
 */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTaskStore } from '@/store';
import TaskDetailDrawer from '@/components/task/detail/TaskDetailDrawer';
import type { MyTaskScope, MyTaskStatusFilter, TaskDetailSource } from '@/types';
import { useIsMobile } from '@/hooks/useIsMobile';
import CreateTaskModal from '@/components/task/form/CreateTaskModal';
import DesktopView from './DesktopView';
import MobileView from './MobileView';

const scopeOptions: Array<{ key: MyTaskScope; label: string; description: string }> = [
  { key: 'assigned', label: '分派给我的', description: '聚焦待我处理' },
  { key: 'participating', label: '我参与的', description: '跟进协作事项' },
  { key: 'created', label: '我创建的', description: '追踪我发起的' },
  { key: 'shared', label: '分享给我的', description: '他人共享的任务' },
  { key: 'all', label: '全部任务', description: '查看全部相关任务' },
];

const statusOptions: Array<{ key: MyTaskStatusFilter; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'in_progress', label: '进行中' },
  { key: 'delayed_in_progress', label: '延期进行中' },
  { key: 'done', label: '已完成' },
  { key: 'delayed_done', label: '延期完成' },
  { key: 'canceled', label: '已取消' },
  { key: 'overdue', label: '已逾期' },
];

export default function MyTasks() {
  const isMobile = useIsMobile(); // [MOBILE ONLY]
  const { tasks, total, loading, myTaskSummary, fetchMyTasks } = useTaskStore();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // 共享状态
  const [scope, setScope] = useState<MyTaskScope>('assigned');
  const [status, setStatus] = useState<MyTaskStatusFilter>(
    isMobile ? 'in_progress' : 'all'
  );
  const [keyword, setKeyword] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [dueDateRange, setDueDateRange] = useState<{ startDate: string | null; endDate: string | null }>({
    startDate: null,
    endDate: null,
  });
  const [pageIndex, setPageIndex] = useState(0);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [detailSource, setDetailSource] = useState<TaskDetailSource>('default');
  const [detailVisible, setDetailVisible] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);

  useEffect(() => {
    fetchMyTasks({
      scope,
      status,
      keyword,
      dueStartDate: dueDateRange.startDate || undefined,
      dueEndDate: dueDateRange.endDate || undefined,
    });
  }, [scope, status, keyword, dueDateRange, fetchMyTasks]);

  useEffect(() => {
    const taskId = searchParams.get('taskId');
    if (!taskId) return;

    const source = searchParams.get('source');
    setSelectedTaskId(taskId);
    setDetailSource(source === 'share' ? 'share' : 'default');
    setDetailVisible(true);

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('taskId');
    nextParams.delete('source');
    nextParams.delete('channel');
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleTaskClick = (id: string) => {
    setSelectedTaskId(id);
    setDetailSource('default');
    setDetailVisible(true);
  };

  const sharedProps = {
    tasks,
    total,
    loading,
    myTaskSummary,
    scope,
    setScope: (nextScope: MyTaskScope) => {
      setPageIndex(0);
      setScope(nextScope);
    },
    status,
    setStatus: (nextStatus: MyTaskStatusFilter) => {
      setPageIndex(0);
      setStatus(nextStatus);
    },
    searchDraft,
    setSearchDraft,
    onSearch: (val: string) => {
      setPageIndex(0);
      setKeyword(val);
    },
    dueDateRange,
    onDueDateRangeChange: (nextRange: { startDate: string | null; endDate: string | null }) => {
      setPageIndex(0);
      setDueDateRange(nextRange);
    },
    onTaskClick: handleTaskClick,
    onCreateClick: () => setCreateModalVisible(true),
    pageIndex,
    onPageIndexChange: setPageIndex,
    scopeOptions,
    statusOptions,
  };

  return (
    <>
      {/* [MOBILE ADAPTATION] 视图分发 */}
      {!isMobile ? (
        <DesktopView {...sharedProps} />
      ) : (
        <MobileView {...sharedProps} />
      )}

      {/* 创建任务弹窗 */}
      <CreateTaskModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onSuccess={() => {
          setCreateModalVisible(false);
          fetchMyTasks({
            scope,
            status,
            keyword,
            dueStartDate: dueDateRange.startDate || undefined,
            dueEndDate: dueDateRange.endDate || undefined,
          });
        }}
      />

      {/* 
        详情页抽屉组件：
        在桌面端为右侧抽屉，在移动端应通过 Responsive 改造支持全屏或底抽。
      */}
      <TaskDetailDrawer
        taskId={selectedTaskId}
        source={detailSource}
        readOnly={detailSource === 'share'}
        visible={detailVisible}
        onClose={() => {
          setDetailVisible(false);
          setSelectedTaskId(null);
          setDetailSource('default');
        }}
      />
    </>
  );
}
