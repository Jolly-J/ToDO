/**
 * 页面名称：回收站
 * 文件作用：展示当前用户已删除的任务，并支持恢复。
 * 主要功能：按个人维度查看删除记录、搜索任务并执行恢复操作。
 */
import { useEffect, useState } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';
import { RotateCcw, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTaskStore } from '@/store';
import { useTourStore } from '@/components/onboarding/tourStore';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import TaskDetailDrawer from '@/components/task/detail/TaskDetailDrawer';
import { pageHeaderStyles } from '@/pages/pageHeaderStyles';
import styles from './index.module.css';
import TaskTableView from '@/components/task/table/TaskTableView';
import {
  createTaskActionColumn,
  createTaskAssigneeColumn,
  createTaskAttachmentCountColumn,
  createTaskDateColumn,
  createTaskParticipantsColumn,
  createTaskPriorityColumn,
  createTaskStatusColumn,
  createTaskTextColumn,
  createTaskTitleColumn,
} from '@/components/task/table/TaskTableColumnPresets';

export default function Trash() {
  const { tasks, total, loading, fetchTrashTasks, restoreTask } = useTaskStore();
  const openTour = useTourStore((state) => state.openTour);
  const [keyword, setKeyword] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  useEffect(() => {
    fetchTrashTasks({ keyword });
    return () => useTaskStore.getState().cancelCollectionFetch();
  }, [keyword, fetchTrashTasks]);

  const handleRestore = async (taskId: string, event?: MouseEvent<HTMLElement>) => {
    event?.stopPropagation();
    await restoreTask(taskId);
    toast.success('任务已恢复');
  };

  const columns = [
    createTaskTitleColumn({
      title: '任务',
      key: 'title',
      showDescription: true,
    }),
    createTaskTextColumn({
      title: '原团队',
      dataIndex: 'team_name',
      key: 'team_name',
      width: 108,
      compact: true,
      fallback: '-',
    }),
    createTaskAssigneeColumn({
      title: '原负责人',
      key: 'assignee_name',
      width: 96,
    }),
    createTaskParticipantsColumn({
      title: '原参与人',
      width: 120,
    }),
    createTaskStatusColumn({
      width: 78,
    }),
    createTaskPriorityColumn({
      width: 68,
    }),
    createTaskDateColumn({
      title: '删除时间',
      dataIndex: 'deleted_at',
      key: 'deleted_at',
      width: 136,
      format: 'YYYY/MM/DD HH:mm',
      compact: true,
    }),
    createTaskTextColumn({
      title: '删除人',
      dataIndex: 'deleted_by_name',
      key: 'deleted_by_name',
      width: 76,
      compact: true,
      fallback: '-',
    }),
    createTaskAttachmentCountColumn({
      width: 64,
    }),
    createTaskActionColumn({
      width: 104,
      renderAction: (record) => (
        <Button
          data-tour="trash-restore-action"
          size="sm"
          variant="outline"
          className={styles.restoreButton}
          onClick={(event) => handleRestore(record.id, event)}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          恢复任务
        </Button>
      ),
    }),
  ];

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      setKeyword(searchDraft.trim());
    }
  };

  return (
    <div>
      <div style={pageHeaderStyles.toolbar}>
        <div style={pageHeaderStyles.titleBlock}>
          <div className="flex items-center gap-2">
            <h2 style={pageHeaderStyles.title}>回收站</h2>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => openTour('trash')}
                    aria-label="查看回收站操作指南"
                    className="inline-flex items-center justify-center h-6 w-6 rounded-full text-[#9B9A97] hover:text-[#37352F] hover:bg-[#EFEFEF] transition-colors cursor-pointer"
                  >
                    <HelpCircle className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  回收站操作指南
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p style={pageHeaderStyles.meta}>这里只显示你自己删除的任务，恢复后会重新回到原来的任务空间。</p>
        </div>
        <div data-tour="trash-search" style={pageHeaderStyles.actions}>
          <Input
            placeholder="搜索已删除任务"
            value={searchDraft}
            onBlur={() => setKeyword(searchDraft.trim())}
            onChange={(event) => setSearchDraft(event.target.value)}
            onKeyDown={handleSearchKeyDown}
          />
        </div>
      </div>

      <TaskTableView
        surfaceTestId="trash-workbench-surface"
        className={styles.table}
        columns={columns}
        dataSource={tasks}
        rowKey="id"
        loading={loading}
        pagination={{ total, pageSize: 20 }}
        locale={{ emptyText: '你的回收站还是空的' }}
        onRow={(record) => ({
          onClick: () => {
            setSelectedTaskId(record.id);
            setDetailVisible(true);
          },
        })}
      />

      <TaskDetailDrawer
        taskId={selectedTaskId}
        visible={detailVisible}
        source="trash"
        onClose={() => {
          setDetailVisible(false);
          setSelectedTaskId(null);
        }}
      />
    </div>
  );
}
