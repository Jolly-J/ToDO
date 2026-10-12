/**
 * 组件名称：任务列表列预设
 * 文件作用：为任务域不同页面提供统一的列工厂与单元格渲染规则。
 * 主要功能：沉淀团队空间列表视图的主列视觉和成员信息展示，供我的任务、回收站等页面复用。
 */
import { useEffect, useState, type ReactNode } from 'react';
import type { ColumnDef, SortingFn } from '@tanstack/react-table';
import dayjs from 'dayjs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Task } from '@/types';
import PriorityTag from '@/components/task/meta/PriorityTag';
import StatusTag from '@/components/task/meta/StatusTag';
import TaskTitlePreview from './TaskTitlePreview';
import { ChevronRight, CornerDownRight } from 'lucide-react';
import styles from './TaskTableColumnPresets.module.css';
import { DESKTOP_CONTENT_MIN_WIDTH } from '@/layouts/layoutTokens';

const joinClassNames = (...classNames: Array<string | false | null | undefined>) =>
  classNames.filter(Boolean).join(' ');

const isOverdueTask = (task: Task) =>
  Boolean(task.due_date && dayjs(task.due_date).isBefore(dayjs(), 'day') && task.status !== 'done' && task.status !== 'delayed_done' && task.status !== 'canceled');

const renderTextCell = (text: string, className: string) => (
  <span className={className} title={text}>
    {text}
  </span>
);

const getParticipantSummary = (participants: Task['participants']) => {
  if (!participants || participants.length === 0) {
    return '未添加';
  }

  if (participants.length <= 2) {
    return participants.map((participant) => participant.name).join('、');
  }

  return `${participants[0].name}、${participants[1].name} 等${participants.length}人`;
};

const getAvatarFallback = (name?: string) =>
  (name || '?').trim().slice(0, 1).toUpperCase();

export interface TaskColumnSizeProfile {
  title: number;
  assignee: number;
  participants: number;
}

const getColumnSizeProfile = (width: number): TaskColumnSizeProfile => {
  if (width >= 1536) {
    return { title: 300, assignee: 90, participants: 220 };
  }
  if (width >= 1280) {
    return { title: 260, assignee: 85, participants: 200 };
  }
  if (width >= 1024) {
    return { title: 220, assignee: 80, participants: 180 };
  }
  if (width >= 768) {
    return { title: 200, assignee: 75, participants: 170 };
  }
  if (width >= 640) {
    return { title: 180, assignee: 70, participants: 150 };
  }

  return { title: 170, assignee: 65, participants: 140 };
};

export const useTaskColumnSizeProfile = (): TaskColumnSizeProfile => {
  const [width, setWidth] = useState(() =>
    typeof window === 'undefined'
      ? 1280
      : Math.max(window.innerWidth, DESKTOP_CONTENT_MIN_WIDTH)
  );

  useEffect(() => {
    const handleResize = () => setWidth(Math.max(window.innerWidth, DESKTOP_CONTENT_MIN_WIDTH));

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return getColumnSizeProfile(width);
};

type TaskSortConfig = {
  enableSorting?: boolean;
  sortingFn?: SortingFn<Task>;
};

interface CreateTaskTitleColumnOptions extends TaskSortConfig {
  title?: string;
  key?: string;
  width?: number;
  showDescription?: boolean;
}

export const createTaskTitleColumn = ({
  title = '任务标题',
  key = 'title',
  width,
  showDescription = false,
  enableSorting,
  sortingFn,
}: CreateTaskTitleColumnOptions = {}): ColumnDef<Task> => ({
  accessorKey: 'title',
  cell: ({ getValue, row }) => {
    const taskTitle = String(getValue() || '');
    const isOverdue = isOverdueTask(row.original);
    const depth = row.depth;
    const canExpand = row.getCanExpand();
    const isExpanded = row.getIsExpanded();
    const subtaskCount = row.original.subtask_count || row.subRows?.length || 0;

    const titlePreview = (
      <TaskTitlePreview
        title={taskTitle}
        className={joinClassNames(
          styles.titleCell,
          isOverdue && styles.titleCellOverdue
        )}
      />
    );

    const titleNode = (
      <div
        className="flex items-center min-w-0"
        style={{ paddingLeft: depth > 0 ? `${(depth - 1) * 16 + 20}px` : undefined }}
      >
        {/* 一级父任务：折叠/展开指示器 */}
        {depth === 0 && (
          canExpand ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                row.toggleExpanded();
              }}
              className="mr-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded text-[#9B9A97] transition-colors hover:text-[#37352F] cursor-pointer"
              title={isExpanded ? '折叠子任务' : '展开子任务'}
              data-testid="toggle-subtasks-button"
            >
              <ChevronRight
                className={cn("h-3.5 w-3.5 transition-transform duration-200", isExpanded && "rotate-90 text-[#37352F]")}
              />
            </button>
          ) : (
            <span className="w-4 mr-1 shrink-0" />
          )
        )}

        {/* 二级及更深子任务：L 型折角树枝连接符 */}
        {depth > 0 && (
          <span
            className="mr-1.5 inline-flex shrink-0 items-center text-[#9B9A97] select-none"
            data-testid="subtask-tree-connector"
          >
            <CornerDownRight className="h-3.5 w-3.5 text-[#9B9A97]" />
          </span>
        )}

        <div className="flex items-center min-w-0 flex-1">
          {titlePreview}
          {depth === 0 && subtaskCount > 0 && (
            <span
              className="ml-2 inline-flex shrink-0 items-center rounded bg-[#F3F4F6] px-1.5 py-0.2 text-[10px] text-[#787774]"
              title={`包含 ${subtaskCount} 个子任务`}
            >
              {subtaskCount}
            </span>
          )}
        </div>
      </div>
    );

    if (!showDescription) {
      return titleNode;
    }

    return (
      <div className={styles.titleCellStack}>
        {titleNode}
        {row.original.description ? (
          <span
            className={styles.description}
            style={{ paddingLeft: depth > 0 ? `${(depth - 1) * 16 + 38}px` : '20px' }}
            title={row.original.description}
          >
            {row.original.description}
          </span>
        ) : null}
      </div>
    );
  },
  enableSorting: enableSorting ?? false,
  header: title,
  id: key,
  size: width,
  sortingFn: enableSorting ? sortingFn : undefined,
});

interface CreateTaskAssigneeColumnOptions extends TaskSortConfig {
  title?: string;
  key?: string;
  width?: number;
  emptyText?: string;
}

export const createTaskAssigneeColumn = ({
  title = '负责人',
  key = 'assignee',
  width,
  emptyText = '尚未分配',
  enableSorting,
  sortingFn,
}: CreateTaskAssigneeColumnOptions = {}): ColumnDef<Task> => ({
  accessorFn: (row) => row.assignee_name || row.assignee_id || '',
  cell: ({ row }) => {
    const record = row.original;
    const hasAssignee = Boolean(record.assignee_id || record.assignee_name || record.assignee_avatar);

    if (!hasAssignee) {
      return <span className={styles.unassignedText}>{emptyText}</span>;
    }

    return (
      <div className={styles.assigneeCell}>
        <Avatar className={styles.assigneeAvatar}>
          <AvatarImage src={record.assignee_avatar} alt={record.assignee_name || '负责人'} />
          <AvatarFallback>{getAvatarFallback(record.assignee_name)}</AvatarFallback>
        </Avatar>
        <span className={styles.assigneeName}>{record.assignee_name || '未命名成员'}</span>
      </div>
    );
  },
  enableSorting: enableSorting ?? false,
  header: title,
  id: key,
  size: width,
  sortingFn: enableSorting ? sortingFn : undefined,
});

interface CreateTaskParticipantsColumnOptions extends TaskSortConfig {
  title?: string;
  key?: string;
  width?: number;
  emptyText?: string;
}

export const createTaskParticipantsColumn = ({
  title = '参与人',
  key = 'participants',
  width,
  emptyText = '暂无参与人',
  enableSorting,
  sortingFn,
}: CreateTaskParticipantsColumnOptions = {}): ColumnDef<Task> => ({
  accessorFn: (row) => row.participants || [],
  cell: ({ row }) => {
    const participants = row.original.participants;

    return participants && participants.length > 0 ? (
      <div className={styles.participantCell}>
        <div className={styles.participantAvatars}>
          {participants.slice(0, 3).map((participant, index) => (
            <Avatar
              key={participant.id}
              className={joinClassNames(
                styles.participantAvatar,
                index === 0 && styles.participantAvatarFirst
              )}
            >
              <AvatarImage src={participant.avatar} alt={participant.name} />
              <AvatarFallback>{getAvatarFallback(participant.name)}</AvatarFallback>
            </Avatar>
          ))}
        </div>
        <span className={styles.participantNames}>{getParticipantSummary(participants)}</span>
      </div>
    ) : (
      <span className={styles.unassignedText}>{emptyText}</span>
    );
  },
  enableSorting: enableSorting ?? false,
  header: title,
  id: key,
  size: width,
  sortingFn: enableSorting ? sortingFn : undefined,
});

interface CreateTaskPriorityColumnOptions extends TaskSortConfig {
  title?: string;
  key?: string;
  width?: number;
}

export const createTaskPriorityColumn = ({
  title = '优先级',
  key = 'priority',
  width = 80,
  enableSorting,
  sortingFn,
}: CreateTaskPriorityColumnOptions = {}): ColumnDef<Task> => ({
  accessorKey: 'priority',
  cell: ({ getValue }) => <PriorityTag priority={getValue() as Task['priority']} />,
  enableSorting: enableSorting ?? false,
  header: title,
  id: key,
  size: width,
  sortingFn: enableSorting ? sortingFn : undefined,
});

interface CreateTaskStatusColumnOptions extends TaskSortConfig {
  title?: string;
  key?: string;
  width?: number;
}

export const createTaskStatusColumn = ({
  title = '状态',
  key = 'status',
  width = 100,
  enableSorting,
  sortingFn,
}: CreateTaskStatusColumnOptions = {}): ColumnDef<Task> => ({
  accessorKey: 'status',
  cell: ({ getValue }) => <StatusTag status={getValue() as Task['status']} />,
  enableSorting: enableSorting ?? false,
  header: title,
  id: key,
  size: width,
  sortingFn: enableSorting ? sortingFn : undefined,
});

interface CreateTaskTextColumnOptions extends TaskSortConfig {
  title: string;
  dataIndex: keyof Task;
  key: string;
  width?: number;
  fallback?: string;
  compact?: boolean;
  subtle?: boolean;
  formatter?: (value: unknown, record: Task) => string;
}

export const createTaskTextColumn = ({
  title,
  dataIndex,
  key,
  width,
  fallback = '-',
  compact = false,
  subtle = false,
  formatter,
  enableSorting,
  sortingFn,
}: CreateTaskTextColumnOptions): ColumnDef<Task> => ({
  accessorFn: (row) => row[dataIndex],
  cell: ({ getValue, row }) => {
    const value = getValue();
    const text = formatter
      ? formatter(value, row.original)
      : typeof value === 'string' && value.trim()
        ? value
        : fallback;
    const className = subtle
      ? styles.textCellSubtle
      : compact
        ? styles.textCellCompact
        : styles.textCell;

    return renderTextCell(text || fallback, className);
  },
  enableSorting: enableSorting ?? false,
  header: title,
  id: key,
  size: width,
  sortingFn: enableSorting ? sortingFn : undefined,
});

interface CreateTaskDateColumnOptions extends TaskSortConfig {
  title: string;
  dataIndex: 'start_date' | 'due_date' | 'deleted_at';
  key: string;
  width?: number;
  format?: string;
  fallback?: string;
  compact?: boolean;
  subtle?: boolean;
}

export const createTaskDateColumn = ({
  title,
  dataIndex,
  key,
  width,
  format = 'YYYY/MM/DD',
  fallback = '未设置',
  compact = false,
  subtle = false,
  enableSorting,
  sortingFn,
}: CreateTaskDateColumnOptions): ColumnDef<Task> => ({
  accessorFn: (row) => row[dataIndex],
  cell: ({ getValue }) => {
    const value = getValue() as string | null | undefined;
    const text = value ? dayjs(value).tz('Asia/Shanghai').format(format) : fallback;
    const className = subtle
      ? styles.textCellSubtle
      : compact
        ? styles.textCellCompact
        : styles.textCell;
    return renderTextCell(text, className);
  },
  enableSorting: enableSorting ?? false,
  header: title,
  id: key,
  size: width,
  sortingFn: enableSorting ? sortingFn : undefined,
});

interface CreateTaskAttachmentCountColumnOptions extends TaskSortConfig {
  title?: string;
  key?: string;
  width?: number;
}

export const createTaskAttachmentCountColumn = ({
  title = '附件',
  key = 'attachment_count',
  width = 84,
  enableSorting,
  sortingFn,
}: CreateTaskAttachmentCountColumnOptions = {}): ColumnDef<Task> =>
  createTaskTextColumn({
    title,
    dataIndex: 'attachment_count',
    key,
    width,
    compact: true,
    enableSorting,
    sortingFn,
    formatter: (value) => `${Number(value || 0)} 个`,
  });

interface CreateTaskActionColumnOptions {
  title?: string;
  key?: string;
  width?: number;
  renderAction: (record: Task) => ReactNode;
}

export const createTaskActionColumn = ({
  title = '操作',
  key = 'actions',
  width = 96,
  renderAction,
}: CreateTaskActionColumnOptions): ColumnDef<Task> => ({
  cell: ({ row }) => <div className={styles.actionCell}>{renderAction(row.original)}</div>,
  enableSorting: false,
  header: title,
  id: key,
  size: width,
});

export const taskActionLinkClassName = cn(
  buttonVariants({
    variant: 'ghost',
    size: 'sm',
  }),
  styles.actionLink
);
