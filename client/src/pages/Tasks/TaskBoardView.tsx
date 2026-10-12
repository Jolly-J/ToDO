/**
 * 组件名称：任务看板视图
 * 文件作用：按任务状态分列展示团队任务。
 * 主要功能：支持跨列拖拽、拖拽预占位预览，并点击卡片打开任务详情。
 */
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { DndContext, closestCorners, DragOverlay, useDraggable, useDroppable } from '@dnd-kit/core';
import type { DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useTaskStore } from '@/store';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { DateRangePicker } from '@/components/ui/date-picker';
import TaskCard from '@/components/task/board/TaskCard';
import { statusConfig } from '@/config/taskSemanticColors';
import type { Task, TaskStatus } from '@/types';
import {
  taskToolbarHintStyle,
  taskToolbarLeadingStyle,
  taskToolbarMiddleStyle,
  taskToolbarRowStyle,
  taskToolbarTrailingStyle,
} from './toolbarStyles';
import styles from './TaskBoardView.module.css';

const TIME_RANGE_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'week', label: '周' },
  { value: 'month', label: '月' },
  { value: 'year', label: '年' },
] as const;

type QuickTimeRange = (typeof TIME_RANGE_OPTIONS)[number]['value'];
type BoardTimeRange = QuickTimeRange | 'custom';
type DueDateRange = { startDate: string | null; endDate: string | null };

function getTimeRangeBounds(range: QuickTimeRange): DueDateRange {
  if (range === 'all') {
    return { startDate: null, endDate: null };
  }

  const now = dayjs();
  const bounds = {
    week: { start: now.startOf('week'), end: now.endOf('week') },
    month: { start: now.startOf('month'), end: now.endOf('month') },
    year: { start: now.startOf('year'), end: now.endOf('year') },
  }[range];

  return {
    startDate: bounds.start.format('YYYY-MM-DD'),
    endDate: bounds.end.format('YYYY-MM-DD'),
  };
}

type BoardTask = Task & {
  assignee_name?: string;
  assignee_avatar?: string;
};

type BoardLaneId = 'in_progress' | 'delayed_in_progress' | 'done';
type BoardLaneData = Record<BoardLaneId, BoardTask[]>;

const BOARD_LANES: BoardLaneId[] = ['in_progress', 'delayed_in_progress', 'done'];

function cloneBoardData(boardData: BoardLaneData): BoardLaneData {
  return {
    in_progress: [...boardData.in_progress],
    delayed_in_progress: [...boardData.delayed_in_progress],
    done: [...boardData.done],
  };
}

function findTaskLane(boardData: BoardLaneData, taskId: string): BoardLaneId | null {
  for (const lane of BOARD_LANES) {
    if (boardData[lane].some((task) => task.id === taskId)) {
      return lane;
    }
  }

  return null;
}

function resolveDropStatus(task: BoardTask, targetLane: BoardLaneId): TaskStatus {
  if (targetLane === 'delayed_in_progress') {
    return 'delayed_in_progress';
  }

  if (targetLane === 'done') {
    return task.status === 'delayed_in_progress' || task.status === 'delayed_done'
      ? 'delayed_done'
      : 'done';
  }

  return 'in_progress';
}

function moveTaskToLane(boardData: BoardLaneData, taskId: string, targetLane: BoardLaneId): BoardLaneData {
  const nextBoardData = cloneBoardData(boardData);
  const sourceLane = findTaskLane(nextBoardData, taskId);

  if (!sourceLane || sourceLane === targetLane) {
    return nextBoardData;
  }

  const taskIndex = nextBoardData[sourceLane].findIndex((task) => task.id === taskId);
  if (taskIndex === -1) {
    return nextBoardData;
  }

  const [task] = nextBoardData[sourceLane].splice(taskIndex, 1);
  const targetStatus = resolveDropStatus(task, targetLane);
  nextBoardData[targetLane] = [
    ...nextBoardData[targetLane],
    { ...task, status: targetStatus },
  ];

  return nextBoardData;
}

function SortableColumn({
  id,
  title,
  count,
  children,
}: {
  id: BoardLaneId;
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  const { setNodeRef } = useDroppable({ id });
  const statusForColor: TaskStatus = id === 'done' ? 'done' : id;
  const dotColor = statusConfig[statusForColor]?.color || '#6B7280';

  return (
    <div ref={setNodeRef} className={styles.column} data-testid={`board-column-${id}`}>
      <div className={styles.columnHeader}>
        <span className={styles.columnTitle}>
          <span className={styles.statusDot} style={{ background: dotColor }} />
          {title}
        </span>
        <span className={styles.countBadge}>{count}</span>
      </div>
      <div className={styles.columnBody} data-testid={`board-column-${id}-body`}>{children}</div>
    </div>
  );
}

function EmptyDropZone() {
  return <div className={styles.emptyDropZone}>拖拽任务到这里</div>;
}

function DraggableTaskCard({
  task,
  onClick,
  isDragging,
}: {
  task: BoardTask;
  onClick?: () => void;
  isDragging?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: task.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${styles.draggableCard} ${isDragging ? styles.draggingCard : ''}`}
    >
      <TaskCard task={task} onClick={onClick} dragHandleProps={{ ...listeners, ...attributes }} />
    </div>
  );
}

function renderTaskCards({
  tasks,
  activeId,
  onTaskClick,
}: {
  tasks: BoardTask[];
  activeId: string | null;
  onTaskClick?: (taskId: string) => void;
}) {
  return tasks.map(task => (
    <DraggableTaskCard
      key={task.id}
      task={task}
      isDragging={activeId === task.id}
      onClick={() => onTaskClick?.(task.id)}
    />
  ));
}

interface TaskBoardViewProps {
  teamId?: string;
  onTaskClick?: (taskId: string) => void;
  toolbarStart?: React.ReactNode;
  toolbarEnd?: React.ReactNode;
}

export default function TaskBoardView({ teamId: teamIdProp, onTaskClick, toolbarStart, toolbarEnd }: TaskBoardViewProps) {
  const [searchParams] = useSearchParams();
  const teamId = teamIdProp || searchParams.get('teamId') || '';
  const { boardData, fetchTasks, updateTaskStatus, setViewFilters } = useTaskStore();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [previewBoardData, setPreviewBoardData] = useState<BoardLaneData | null>(null);
  const [timeRange, setTimeRange] = useState<BoardTimeRange>('week');
  const [dueDateRange, setDueDateRange] = useState<DueDateRange>({
    startDate: null,
    endDate: null,
  });
  const activeDueDateRange = useMemo<DueDateRange>(() => {
    if (timeRange === 'custom') {
      return dueDateRange;
    }

    return getTimeRangeBounds(timeRange);
  }, [timeRange, dueDateRange]);

  useEffect(() => {
    if (!teamId) return;

    setViewFilters('board', {
      dueStartDate: activeDueDateRange.startDate || undefined,
      dueEndDate: activeDueDateRange.endDate || undefined,
    });
    fetchTasks(teamId);
  }, [teamId, activeDueDateRange.startDate, activeDueDateRange.endDate, setViewFilters, fetchTasks]);

  const handleQuickRangeChange = (range: QuickTimeRange) => {
    setTimeRange(range);
    setDueDateRange({ startDate: null, endDate: null });
  };

  const handleDueDateRangeChange = (range: DueDateRange) => {
    setDueDateRange(range);
    setTimeRange(range.startDate || range.endDate ? 'custom' : 'all');
  };

  const filteredBoardData = useMemo<BoardLaneData>(() => ({
    in_progress: boardData.in_progress,
    delayed_in_progress: boardData.delayed_in_progress,
    done: [...boardData.done, ...boardData.delayed_done, ...boardData.canceled],
  }), [boardData]);

  const visibleBoardData = activeId ? (previewBoardData ?? filteredBoardData) : filteredBoardData;

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const targetLane = over.id as BoardLaneId;

    if (!BOARD_LANES.includes(targetLane)) {
      return;
    }

    setPreviewBoardData((currentPreview) =>
      moveTaskToLane((currentPreview ?? filteredBoardData) as BoardLaneData, taskId, targetLane)
    );
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) {
      setActiveId(null);
      setPreviewBoardData(null);
      return;
    }
    const taskId = active.id as string;
    const targetLane = over.id as BoardLaneId;
    if (BOARD_LANES.includes(targetLane)) {
      const sourceLane = findTaskLane(filteredBoardData, taskId);
      if (sourceLane === targetLane) {
        setActiveId(null);
        setPreviewBoardData(null);
        return;
      }
      const task = [...visibleBoardData.in_progress, ...visibleBoardData.delayed_in_progress, ...visibleBoardData.done]
        .find((item) => item.id === taskId);
      const newStatus = task ? resolveDropStatus(task, targetLane) : (targetLane === 'done' ? 'done' : targetLane);
      await updateTaskStatus(taskId, newStatus);
    }
    setActiveId(null);
    setPreviewBoardData(null);
  };

  const activeTask = activeId
    ? [...visibleBoardData.in_progress, ...visibleBoardData.delayed_in_progress, ...visibleBoardData.done].find(t => t.id === activeId)
    : null;

  return (
    <div>
      <div style={taskToolbarRowStyle}>
        <div style={taskToolbarLeadingStyle} data-testid="task-toolbar-leading">{toolbarStart}</div>
        <div style={taskToolbarMiddleStyle} data-testid="task-toolbar-middle">
          <ButtonGroup>
            {TIME_RANGE_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                variant={timeRange === opt.value ? 'default' : 'outline'}
                size="sm"
                className="h-[var(--tf-density-toolbar-control-height)] px-[var(--tf-density-button-padding-x-sm)] text-xs"
                aria-pressed={timeRange === opt.value}
                onClick={() => handleQuickRangeChange(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
          </ButtonGroup>
          <div className={styles.boardDateRange}>
            <DateRangePicker
              startDate={dueDateRange.startDate}
              endDate={dueDateRange.endDate}
              testId="task-board-due-date-range"
              onChange={handleDueDateRangeChange}
            />
          </div>
          <div style={taskToolbarHintStyle}>拖拽任务卡片即可更新状态和顺序</div>
        </div>
        <div style={taskToolbarTrailingStyle} data-testid="task-toolbar-trailing">{toolbarEnd}</div>
      </div>

      <DndContext
        collisionDetection={closestCorners}
        onDragStart={(e: DragStartEvent) => setActiveId(e.active.id as string)}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={() => {
          setActiveId(null);
          setPreviewBoardData(null);
        }}
      >
        <div className={styles.columns}>
          <SortableColumn id="in_progress" title="进行中" count={visibleBoardData.in_progress.length}>
            <SortableContext items={visibleBoardData.in_progress.map(t => t.id)} strategy={verticalListSortingStrategy}>
              {visibleBoardData.in_progress.length === 0 ? <EmptyDropZone /> : visibleBoardData.in_progress.map(task => <DraggableTaskCard key={task.id} task={task} isDragging={activeId === task.id} onClick={() => onTaskClick?.(task.id)} />)}
            </SortableContext>
          </SortableColumn>
          <SortableColumn id="delayed_in_progress" title="已延期" count={visibleBoardData.delayed_in_progress.length}>
            <SortableContext items={visibleBoardData.delayed_in_progress.map(t => t.id)} strategy={verticalListSortingStrategy}>
              {visibleBoardData.delayed_in_progress.length === 0 ? <EmptyDropZone /> : visibleBoardData.delayed_in_progress.map(task => <DraggableTaskCard key={task.id} task={task} isDragging={activeId === task.id} onClick={() => onTaskClick?.(task.id)} />)}
            </SortableContext>
          </SortableColumn>
          <SortableColumn id="done" title="已完成/已取消" count={visibleBoardData.done.length}>
            <SortableContext items={visibleBoardData.done.map(t => t.id)} strategy={verticalListSortingStrategy}>
              {visibleBoardData.done.length === 0 ? (
                <EmptyDropZone />
              ) : (
                <>
                  {renderTaskCards({
                    tasks: visibleBoardData.done.filter((task) => task.status !== 'canceled'),
                    activeId,
                    onTaskClick,
                  })}
                  {visibleBoardData.done.some((task) => task.status === 'canceled') ? (
                    <div className={styles.canceledSeparator} data-testid="board-canceled-separator">
                      <span>已取消</span>
                    </div>
                  ) : null}
                  {renderTaskCards({
                    tasks: visibleBoardData.done.filter((task) => task.status === 'canceled'),
                    activeId,
                    onTaskClick,
                  })}
                </>
              )}
            </SortableContext>
          </SortableColumn>
        </div>
        <DragOverlay>
          {activeTask ? (
            <div className={styles.overlayCard}>
              <TaskCard task={activeTask} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
