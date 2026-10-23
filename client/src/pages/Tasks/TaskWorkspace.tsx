/**
 * 组件名称：任务工作区
 * 文件作用：组织团队任务的统一操作头部和三种视图容器。
 * 主要功能：复用统一任务工作台骨架和轻量切换条组织列表、看板、日历视图，并承载创建任务和任务详情抽屉。
 */
import { useEffect, useState, type CSSProperties } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, LayoutList, LayoutGrid, Calendar, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTaskStore } from '@/store';
import request from '@/api/request';
import type { TaskDetailSource } from '@/types';
import TaskDetailDrawer from '@/components/task/detail/TaskDetailDrawer';
import TaskWorkbenchChips from '@/components/task/workbench/TaskWorkbenchChips';
import TaskWorkbenchSurface from '@/components/task/workbench/TaskWorkbenchSurface';
import TaskListView from './TaskListView';
import TaskBoardView from './TaskBoardView';
import TaskCalendarView from './TaskCalendarView';
import TeamCockpitView from '@/pages/Teams/cockpit/TeamCockpitView';
import type { TeamGanttViewState } from '@/pages/Teams/cockpit/teamGanttModel';
import CreateTaskModal from '@/components/task/form/CreateTaskModal';
import { useIsMobile } from '@/hooks/useIsMobile'; // [MOBILE ONLY]
import { cn } from '@/lib/utils';
import styles from './TaskWorkspace.module.css';
import {
  taskHeaderActionGroupStyle,
  taskHeaderRowStyle,
  taskToolbarPrimaryActionStyle,
} from './toolbarStyles';

interface TaskWorkspaceProps {
  teamId: string;
  title?: string;
  headerExtra?: React.ReactNode;
  containerStyle?: CSSProperties;
  embedded?: boolean;
  isTeamAdmin?: boolean;
  /** 驾驶舱甘特图显示属性变化时上报，供团队空间页头的打印入口使用。 */
  onGanttViewStateChange?: (state: TeamGanttViewState) => void;
}

interface ResolvedTaskLink {
  taskId: string;
  teamId?: string;
  landing?: 'team' | 'my-tasks';
}

export default function TaskWorkspace({
  teamId,
  title = '任务管理',
  headerExtra,
  containerStyle,
  embedded = false,
  isTeamAdmin = false,
  onGanttViewStateChange,
}: TaskWorkspaceProps) {
  const isMobile = useIsMobile(); // [MOBILE ONLY]
  const currentView = useTaskStore((state) => state.currentView);
  const setView = useTaskStore((state) => state.setView);
  const fetchTasks = useTaskStore((state) => state.fetchTasks);
  const tasks = useTaskStore((state) => state.tasks);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [detailSource, setDetailSource] = useState<TaskDetailSource>('default');
  const [detailVisible, setDetailVisible] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => () => useTaskStore.getState().cancelCollectionFetch(), [teamId]);

  // [MOBILE ADAPTATION] 移动端强制设为列表视图
  useEffect(() => {
    if (isMobile && currentView !== 'list') {
      setView('list');
    }
  }, [isMobile, currentView, setView]);

  // [SECURITY & INJECTION GUARD] 驾驶舱视图防注入守卫：
  // 仅允许团队管理员访问。若未授权用户通过 URL/状态强行切到 cockpit，自动拦截并回退到列表视图。
  useEffect(() => {
    if (currentView === 'cockpit' && (!embedded || !isTeamAdmin)) {
      setView('list');
    }
  }, [currentView, embedded, isTeamAdmin, setView]);

  // 从钉钉通知链接跳转时，自动解密 token，根据权限落到团队空间或我的任务。
  useEffect(() => {
    const directTaskId = searchParams.get('taskId');
    const source = searchParams.get('source');
    if (directTaskId) {
      setSelectedTaskId(directTaskId);
      setDetailSource(source === 'share' ? 'share' : 'default');
      setDetailVisible(true);

      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('taskId');
      nextParams.delete('source');
      nextParams.delete('channel');
      setSearchParams(nextParams, { replace: true });
      return;
    }

    const token = searchParams.get('token');
    const isSupportedSource = source === 'notification' || source === 'share';
    if (!isSupportedSource || !token) return;

    let cancelled = false;
    (async () => {
      try {
        const { taskId, teamId: resolvedTeamId, landing } = await request.get<ResolvedTaskLink>(
          `/notifications/resolve-link?token=${encodeURIComponent(token)}&source=${encodeURIComponent(source || '')}`
        );
        if (!cancelled && taskId) {
          const nextParams = new URLSearchParams();
          nextParams.set('taskId', taskId);
          nextParams.set('source', source || 'notification');

          if (landing === 'my-tasks') {
            navigate(`/my-tasks?${nextParams.toString()}`, { replace: true });
            return;
          }

          if (resolvedTeamId) {
            navigate(`/teams/${encodeURIComponent(resolvedTeamId)}?${nextParams.toString()}`, { replace: true });
            return;
          }

          setSelectedTaskId(taskId);
          setDetailSource(source === 'share' ? 'share' : 'default');
          setDetailVisible(true);
        }
      } catch {
        // 解密失败或无权限，静默处理
      }
    })();
    return () => { cancelled = true; };
  }, [navigate, searchParams, setSearchParams]);

  const handleTaskClick = (taskId: string) => {
    setSelectedTaskId(taskId);
    setDetailSource('default');
    setDetailVisible(true);
  };

  const createAction = (
    <Button
      variant={isMobile ? "default" : "outline"}
      className={cn(isMobile ? "rounded-md shadow-none" : "")} // [MOBILE ADAPTATION] 移除 shadow-lg，圆角改为 md
      style={isMobile ? undefined : taskToolbarPrimaryActionStyle}
      onClick={() => setCreateModalVisible(true)}
    >
      <Plus className="h-4 w-4" />
      {isMobile ? "创建" : "创建任务"}
    </Button>
  );

  const viewCards = [
    { key: 'list', label: '列表视图', icon: <LayoutList className="h-4 w-4" /> },
    { key: 'board', label: '看板视图', icon: <LayoutGrid className="h-4 w-4" /> },
    { key: 'calendar', label: '日历视图', icon: <Calendar className="h-4 w-4" /> },
    ...(embedded && isTeamAdmin
      ? [{ key: 'cockpit', label: '驾驶舱', icon: <LayoutDashboard className="h-4 w-4" /> }]
      : []),
  ];

  const viewSwitch = !isMobile ? (
    <div data-tour="team-workspace-views">
      <TaskWorkbenchChips
        items={viewCards}
        activeKey={currentView}
        onChange={(key) => setView(key as typeof currentView)}
      />
    </div>
  ) : null; // [MOBILE ONLY] 移动端隐藏视图切换

  return (
    <div style={containerStyle}>
      {!embedded || isMobile ? (
        <div 
          className={cn(
            "flex items-center justify-between mb-6",
            isMobile ? "px-1" : ""
          )}
          style={isMobile ? undefined : taskHeaderRowStyle}
        >
          <h2 style={{ margin: 0 }} className={cn(isMobile ? "text-xl font-bold" : "")}>{title}</h2>
          <div 
            className="flex items-center gap-3"
            style={isMobile ? undefined : taskHeaderActionGroupStyle}
          >
            {headerExtra && !isMobile ? <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>{headerExtra}</div> : null}
            {createAction}
          </div>
        </div>
      ) : null}

      <TaskWorkbenchSurface className={cn(styles.workspaceShell, isMobile && "p-0 border-none bg-transparent shadow-none")}>
        <div className={styles.viewStage}>
          <div key={currentView} className={styles.viewPanel}>
            {currentView === 'list' && (
              <TaskListView
                teamId={teamId}
                onTaskClick={handleTaskClick}
                toolbarStart={viewSwitch}
                toolbarEnd={embedded || isMobile ? createAction : undefined}
              />
            )}
            {!isMobile && currentView === 'board' && (
              <TaskBoardView
                teamId={teamId}
                onTaskClick={handleTaskClick}
                toolbarStart={viewSwitch}
                toolbarEnd={embedded ? createAction : undefined}
              />
            )}
            {!isMobile && currentView === 'calendar' && (
              <TaskCalendarView
                teamId={teamId}
                toolbarStart={viewSwitch}
                toolbarEnd={embedded ? createAction : undefined}
                onTaskClick={handleTaskClick}
              />
            )}
            {!isMobile && currentView === 'cockpit' && embedded && isTeamAdmin && (
              <TeamCockpitView
                teamId={teamId}
                tasks={tasks}
                toolbarStart={viewSwitch}
                toolbarEnd={embedded ? createAction : undefined}
                onTaskClick={handleTaskClick}
                onGanttViewStateChange={onGanttViewStateChange}
              />
            )}
          </div>
        </div>
      </TaskWorkbenchSurface>

      <CreateTaskModal
        teamId={teamId}
        initialTeamId={embedded ? '' : teamId}
        teamMode={embedded ? 'locked' : 'optional'}
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onSuccess={() => {
          setCreateModalVisible(false);
          fetchTasks(teamId);
        }}
      />
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
    </div>
  );
}
