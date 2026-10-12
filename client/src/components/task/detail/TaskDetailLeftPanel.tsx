/**
 * 任务详情左侧面板
 * 展示任务元信息（状态、优先级、负责人、截止日期、附件等）的可编辑表单区域
 */
import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import type { ButtonHTMLAttributes, ComponentPropsWithoutRef, ReactNode } from 'react';
import dayjs from 'dayjs';
import { useAuthStore, useTeamStore } from '@/store';
import {
  CalendarDays,
  Bell,
  BellOff,
  Check,
  CheckSquare2,
  ChevronDown,
  Download,
  Edit3,
  Flag,
  LoaderCircle,
  Paperclip,
  Search,
  UserCircle2,
  Users,
  X,
} from 'lucide-react';
import request from '@/api/request';
import { loadAllUsers } from '@/api/loadAllUsers';
import type { Task, TaskAttachment, TaskReminderRule, User } from '@/types';
import AttachmentPickerTrigger from '@/components/shared/file/AttachmentPickerTrigger';
import FileTypeIcon, { getFileTypePresentation } from '@/components/shared/file/FileTypeIcon';
import { isImageAttachment } from '@/components/shared/file/AttachmentImagePreviewDialog';
import { CompoundReminderSetting } from '@/components/task/shared/CompoundReminderSetting';
import {
  getPriorityMeta,
  getStatusMeta,
  withAlpha,
} from '@/config/taskSemanticColors';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DateRangePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog'; // [MOBILE ONLY]
import MarkdownContent from '@/components/shared/markdown/MarkdownContent';
import type { MarkdownPreviewImage } from '@/components/shared/markdown/MarkdownContent';
import { Editor as PagesEditor } from '@/components/ui/editor';
import type { ImageUploadHandler } from '@/components/ui/editor';
import { useIsMobile } from '@/hooks/useIsMobile'; // [MOBILE ONLY]
import { cn } from '@/lib/utils';
import { downloadAttachment } from '@/utils/downloadAttachment';
import type { TaskStatus } from '@/types';
import TaskSubtasksSection from './TaskSubtasksSection';

interface TaskDetailLeftPanelProps {
  task: Task;
  taskId: string;
  isDeletedTask: boolean;
  uploadingTaskAttachments: boolean;
  headerActions?: ReactNode;
  /** 只读模式：禁用所有编辑交互但不显示删除信息 */
  readOnly?: boolean;
  onUpdateTask: (patch: Partial<Record<string, unknown>>) => Promise<void>;
  onUploadAttachments: (files: File[]) => Promise<void>;
  onUploadRichTextImage?: (file: File) => Promise<string>;
  onDeleteAttachment: (attachmentId: string) => Promise<void>;
  onPreviewImageAttachment?: (attachment: TaskAttachment) => void;
  onPreviewRichTextImage?: (image: MarkdownPreviewImage) => void;
  pendingAuditCount?: number;
  /** 负责人视角：是否需要提示补充进展 */
  showProgressPrompt?: boolean;
  /** 桌面弹窗采用主内容 + 属性栏布局，移动端继续使用原有堆叠布局 */
  layout?: 'stacked' | 'dialog';
  /** 桌面弹窗主内容底部的信息流 */
  activityPanel?: ReactNode;
  onNavigateToTask?: (targetTaskId: string) => void;
  onUpdateSubtaskStatus?: (subtaskId: string, nextStatus: TaskStatus) => Promise<void>;
  onOpenCreateSubtaskModal?: () => void;
  onUpdateSubtask?: (subtaskId: string, patch: Partial<Task>) => Promise<void>;
}

type EditableTextField = 'title' | null;

const titleTextClassName = 'text-[19px] font-semibold leading-[1.24] tracking-[0.01em] text-(--tf-foreground)';

function DetailCard({
  title,
  titleAction,
  children,
  className,
  surface = 'card',
  ...props
}: {
  title?: string;
  titleAction?: ReactNode;
  children: ReactNode;
  className?: string;
  surface?: 'card' | 'plain';
} & ComponentPropsWithoutRef<'section'>) {
  return (
    <section
      className={cn(
        surface === 'plain'
          ? 'rounded-xl border border-(--tf-border) bg-(--tf-background) px-4 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]'
          : 'rounded-[20px] border border-(--tf-border) bg-[rgba(250,250,248,0.82)] px-3.5 py-3.5 backdrop-blur-sm',
        className
      )}
      {...props}
    >
      {titleAction ? (
        <div className="mb-2 flex items-center justify-between gap-2">
          {title ? <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-(--tf-subtle-foreground)">{title}</div> : <span />}
          <div className="shrink-0">{titleAction}</div>
        </div>
      ) : title ? (
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-(--tf-subtle-foreground)">{title}</div>
      ) : null}
      {children}
    </section>
  );
}

const statusOptions = [
  { label: '进行中', value: 'in_progress' },
  { label: '延期进行中', value: 'delayed_in_progress' },
  { label: '已完成', value: 'done' },
  { label: '延期完成', value: 'delayed_done' },
  { label: '已取消', value: 'canceled' },
] as const;

const priorityOptions = [
  { label: '紧急', value: 'urgent' },
  { label: '高', value: 'high' },
  { label: '中', value: 'medium' },
  { label: '低', value: 'low' },
] as const;

const reminderOptions: { label: string; value: TaskReminderRule }[] = [
  { label: '截止前 15 分钟', value: 'due_15m' },
  { label: '截止前 30 分钟', value: 'due_30m' },
  { label: '截止前 1 小时', value: 'due_1h' },
  { label: '截止前 3 小时', value: 'due_3h' },
  { label: '截止前 1 天', value: 'due_1d' },
  { label: '截止前 3 天', value: 'due_3d' },
];

function getInitial(name?: string) {
  return (name || '?').slice(0, 1);
}

function normalizeDate(value?: string | null) {
  if (!value) return null;
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.startOf('day') : null;
}

function formatFileSize(size?: number) {
  if (!size) return '0 B';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function getSoftToneStyle(color: string, backgroundAlpha = 0.12) {
  return {
    color,
    backgroundColor: withAlpha(color, backgroundAlpha),
  };
}

function FieldRow({
  icon,
  label,
  testId,
  multiline = false,
  labelTopTight = false,
  labelOffsetY = 0,
  iconOffsetY = 0,
  compact = false,
  children,
}: {
  icon: ReactNode;
  label: string;
  testId: string;
  multiline?: boolean;
  labelTopTight?: boolean;
  labelOffsetY?: number;
  iconOffsetY?: number;
  compact?: boolean;
  children: ReactNode;
}) {
  const labelAlignmentClass = multiline ? 'items-start' : 'items-center';
  const valueAlignmentClass = multiline ? 'items-start' : 'items-center';
  const rowMinHeightClass = labelTopTight ? '' : 'min-h-9';
  const iconAlignmentClass = multiline
    ? labelTopTight
      ? 'items-start pt-0'
      : 'items-start pt-1'
    : 'h-10 items-center';

  return (
    <div
      data-testid={testId}
      className={cn(
        'grid px-0.5 py-0.5',
        compact ? 'grid-cols-[92px_minmax(0,1fr)] gap-2' : 'grid-cols-[116px_minmax(0,1fr)] gap-4'
      )}
    >
      <div
        data-testid={`${testId}-label`}
        className={cn(
          'flex text-[13px] text-muted-foreground',
          compact ? 'gap-2' : 'gap-3',
          rowMinHeightClass,
          labelAlignmentClass
        )}
      >
        <span
          className={cn(
            'flex shrink-0 justify-center text-(--tf-subtle-foreground)',
            compact ? 'w-6' : 'w-8',
            iconAlignmentClass
          )}
          style={iconOffsetY ? { transform: `translateY(${iconOffsetY}px)` } : undefined}
          aria-hidden="true"
        >
          {icon}
        </span>
        <span className="leading-6" style={labelOffsetY ? { transform: `translateY(${labelOffsetY}px)` } : undefined}>{label}</span>
      </div>
      <div
        data-testid={`${testId}-value`}
        className={cn('min-w-0 flex', rowMinHeightClass, valueAlignmentClass)}
      >
        {children}
      </div>
    </div>
  );
}

function MemberAvatar({
  name,
  avatar,
}: {
  name?: string;
  avatar?: string;
}) {
  return (
    <Avatar className="size-8 shrink-0 border border-(--tf-border) bg-(--tf-card)">
      <AvatarImage src={avatar || undefined} alt={name || '成员头像'} className="object-cover" />
      <AvatarFallback className="bg-(--tf-card) text-[13px] font-semibold text-muted-foreground">
        {getInitial(name)}
      </AvatarFallback>
    </Avatar>
  );
}

function PersonSummary({
  name,
  avatar,
  testId,
}: {
  name?: string;
  avatar?: string;
  testId?: string;
}) {
  if (!name) {
    return <span className="text-[13px] font-medium leading-6 text-muted-foreground">未设置</span>;
  }

  return (
    <span className="inline-flex min-w-0 items-center gap-3" data-testid={testId}>
      <MemberAvatar name={name} avatar={avatar} />
      <span className="truncate text-[13px] font-medium leading-6 text-(--tf-foreground)">{name}</span>
    </span>
  );
}

const FieldValueTrigger = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, type = 'button', children, ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        'group inline-flex max-w-full items-center gap-1.5 rounded-lg border border-transparent px-2 py-1.5 text-left transition-colors duration-150 hover:border-(--tf-border) hover:bg-(--tf-card) disabled:pointer-events-none',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
);

FieldValueTrigger.displayName = 'FieldValueTrigger';

function FieldValueDisplay({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('inline-flex max-w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left', className)}>
      {children}
    </div>
  );
}

function MemberPickerPanel({
  portalContainer,
  widthClassName,
  placeholder,
  keyword,
  onKeywordChange,
  listTestId,
  listClassName,
  footer,
  children,
}: {
  portalContainer: HTMLElement | null;
  widthClassName: string;
  placeholder: string;
  keyword: string;
  onKeywordChange: (value: string) => void;
  listTestId: string;
  listClassName: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <PopoverContent portalContainer={portalContainer} className={cn(widthClassName, 'p-2.5')}>
      <div className="relative mb-2.5">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-(--tf-subtle-foreground)" />
        <Input
          value={keyword}
          onChange={(event) => onKeywordChange(event.target.value)}
          placeholder={placeholder}
          className="h-8 border-(--tf-border) bg-(--tf-card) pl-8 text-[13px] focus-visible:bg-(--tf-background)"
        />
      </div>
      <div
        data-testid={listTestId}
        className={cn('overflow-y-auto overscroll-contain pr-1', listClassName)}
      >
        <div className="space-y-1">
          {children}
        </div>
      </div>
      {footer}
    </PopoverContent>
  );
}

export default function TaskDetailLeftPanel({
  task,
  taskId,
  isDeletedTask,
  uploadingTaskAttachments,
  headerActions,
  readOnly = false,
  pendingAuditCount = 0,
  showProgressPrompt = false,
  layout = 'stacked',
  activityPanel,
  onUpdateTask,
  onUploadAttachments,
  onUploadRichTextImage,
  onDeleteAttachment,
  onPreviewImageAttachment,
  onPreviewRichTextImage,
  onNavigateToTask,
  onUpdateSubtaskStatus,
  onOpenCreateSubtaskModal,
  onUpdateSubtask,
}: TaskDetailLeftPanelProps) {
  const isMobile = useIsMobile(); // [MOBILE ONLY] 探测是否为移动端
  const { user } = useAuthStore();

  // 判断是否为管理员、创建者或超管（全能编辑者）
  const isFullEditor = useMemo(() => {
    if (!user || !task) return false;
    const isSuperAdmin = user.globalRoleCodes?.includes('super_admin') || false;
    return isSuperAdmin || task.is_team_admin || task.creator_id === user.id;
  }, [user, task]);

  // 全局禁用（只读、已删除）
  const isDisabled = readOnly || isDeletedTask;

  // 针对特定字段的精细化禁用：
  // 如果是负责人但不是全能编辑者，则禁用核心元数据修改权 (标题、负责人、优先级、截止日期)
  const isMetaDisabled = isDisabled || (!isFullEditor && task.assignee_id === user?.id);

  const isCanceledTask = task.status === 'canceled';
  const areAttachmentsDisabled = isDisabled || isCanceledTask;
  const { teams, fetchTeams } = useTeamStore();
  const [teamOpen, setTeamOpen] = useState(false);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  const [editingTextField, setEditingTextField] = useState<EditableTextField>(null);
  const [editingDescription, setEditingDescription] = useState(false);
  const [titleDraft, setTitleDraft] = useState(task.title);
  const [descriptionDraft, setDescriptionDraft] = useState(task.description || '');
  const [descriptionPendingUploadCount, setDescriptionPendingUploadCount] = useState(0);
  const [statusOpen, setStatusOpen] = useState(false);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [participantDraft, setParticipantDraft] = useState<string[]>(task.participant_ids || task.participants?.map((participant) => participant.id) || []);
  const [userKeyword, setUserKeyword] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [savingField, setSavingField] = useState<string | null>(null);
  const titleTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const popoverContainerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (editingTextField === 'title' && titleTextareaRef.current) {
      const el = titleTextareaRef.current;
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [editingTextField]);

  const participantIds = task.participant_ids || task.participants?.map((participant) => participant.id) || [];
  const taskStatusMeta = getStatusMeta(task.status);
  const taskPriorityMeta = getPriorityMeta(task.priority);
  const startDateValue = task.start_date || '';
  const dueDateValue = task.due_date || '';
  const startDate = normalizeDate(startDateValue);
  const dueDate = normalizeDate(dueDateValue);
  const today = dayjs().startOf('day');
  const isCompletedTask = task.status === 'done' || task.status === 'delayed_done';
  const completionTimestamp = task.completed_at || task.status_updated_at || task.updated_at;
  const completedAt = isCompletedTask && completionTimestamp && dayjs(completionTimestamp).isValid()
    ? dayjs(completionTimestamp).tz('Asia/Shanghai')
    : null;

  useEffect(() => {
    if (editingTextField !== 'title') {
      setTitleDraft(task.title);
    }
  }, [task.title, editingTextField]);

  useEffect(() => {
    if (!editingDescription) {
      setDescriptionDraft(task.description || '');
    }
  }, [task.description, editingDescription]);

  useEffect(() => {
    if (!participantsOpen) {
      setParticipantDraft(participantIds);
      setUserKeyword('');
    }
  }, [participantIds, participantsOpen]);

  useEffect(() => {
    if ((assigneeOpen || participantsOpen) && !usersLoaded && !usersLoading) {
      void (async () => {
        setUsersLoading(true);
        try {
          const allUsers = await loadAllUsers(
            (params) => request.get('/users', { params }),
            { pageSize: 100 }
          );
          setUsers(allUsers);
          setUsersLoaded(true);
        } finally {
          setUsersLoading(false);
        }
      })();
    }
  }, [assigneeOpen, participantsOpen, usersLoaded, usersLoading]);

  const elapsedLabel = (() => {
    if (!startDate) return '未设置';
    const diff = today.diff(startDate, 'day');
    if (diff < 0) return `尚未开始（${Math.abs(diff)} 天后）`;
    return `${diff + 1} 天`;
  })();

  const remainingLabel = (() => {
    if (!dueDate) return '未设置';
    const diff = dueDate.diff(today, 'day');
    if (diff < 0) return `已超期 ${Math.abs(diff)} 天`;
    return `${diff} 天`;
  })();

  const durationSummary = (() => {
    if (isCompletedTask) {
      if (!startDate || !completedAt) return '任务已完成';
      const durationDays = Math.max(completedAt.startOf('day').diff(startDate, 'day') + 1, 1);
      return `任务进行 ${durationDays} 天`;
    }

    if (elapsedLabel.startsWith('尚未开始')) {
      return remainingLabel === '未设置' ? elapsedLabel : `${elapsedLabel}，距离结束 ${remainingLabel}`;
    }

    if (remainingLabel.startsWith('已超期')) {
      return elapsedLabel === '未设置' ? remainingLabel : `已进行 ${elapsedLabel}，${remainingLabel}`;
    }

    if (elapsedLabel === '未设置') {
      return `距离结束 ${remainingLabel}`;
    }

    return `已进行 ${elapsedLabel}，距离结束 ${remainingLabel}`;
  })();

  const userMap = useMemo(() => {
    const map = new Map<string, User>();
    users.forEach((user) => map.set(user.id, user));
    return map;
  }, [users]);

  const resolveUserProfile = (userId?: string | null) => {
    if (!userId) {
      return null;
    }

    const user = userMap.get(userId);
    if (user) {
      return {
        id: user.id,
        name: user.name,
        avatar: user.avatar,
        department_name: user.department_name,
      };
    }

    if (task.assignee_id === userId) {
      return {
        id: userId,
        name: task.assignee_name || userId,
        avatar: task.assignee_avatar,
      };
    }

    if (task.creator_id === userId) {
      return {
        id: userId,
        name: task.creator_name || userId,
        avatar: task.creator_avatar,
      };
    }

    const participant = task.participants?.find((member) => member.id === userId);
    if (participant) {
      return {
        id: participant.id,
        name: participant.name,
        avatar: participant.avatar,
      };
    }

    return {
      id: userId,
      name: userId,
    };
  };

  const filteredUsers = useMemo(() => {
    const keyword = userKeyword.trim().toLowerCase();
    const filtered = keyword
      ? users.filter((user) =>
          [user.name, user.department_name]
            .filter(Boolean)
            .some((value) => value?.toLowerCase().includes(keyword))
        )
      : users;

    // 已选中的参与人置顶，其余保持原顺序
    return [...filtered].sort((a, b) => {
      const aChecked = participantDraft.includes(a.id);
      const bChecked = participantDraft.includes(b.id);
      if (aChecked === bChecked) return 0;
      return aChecked ? -1 : 1;
    });
  }, [userKeyword, users, participantDraft]);

  const participantProfiles = (participantsOpen ? participantDraft : participantIds)
    .map((participantId) => resolveUserProfile(participantId))
    .filter(Boolean) as Array<{ id: string; name: string; avatar?: string }>;

  const hasPatchChanged = (patch: Partial<Record<string, unknown>>) => (
    Object.entries(patch).some(([field, value]) => {
      let currentValue: unknown = null;
      if (field === 'participant_ids') {
        currentValue = participantIds;
      } else if (field === 'start_date') {
        currentValue = task.start_date || null;
      } else if (field === 'due_date') {
        currentValue = task.due_date || null;
      } else {
        currentValue = task[field as keyof Task] ?? null;
      }
      return JSON.stringify(currentValue) !== JSON.stringify(value ?? null);
    })
  );

  const commitPatch = async (field: string, patch: Partial<Record<string, unknown>>) => {
    if (isDisabled || !taskId) {
      return;
    }

    if (!hasPatchChanged(patch)) {
      setSavingField(null);
      return;
    }

    setSavingField(field);
    try {
      await onUpdateTask(patch);
    } finally {
      setSavingField(null);
    }
  };

  const handleTitleCommit = async () => {
    const nextTitle = titleDraft.trim();
    if (!nextTitle) {
      setTitleDraft(task.title);
      setEditingTextField(null);
      return;
    }

    await commitPatch('title', { title: nextTitle });
    setEditingTextField(null);
  };

  const handleDescriptionCommit = async () => {
    await commitPatch('description', { description: descriptionDraft.trim() });
    setEditingDescription(false);
  };

  const handleDescriptionCancel = () => {
    setDescriptionDraft(task.description || '');
    setEditingDescription(false);
  };

  const handleDescriptionImageUpload: ImageUploadHandler = async (file) => {
    if (!onUploadRichTextImage) return null;

    const src = await onUploadRichTextImage(file);
    return {
      src,
      alt: file.name,
    };
  };

  const titleDisplay = (
    isDisabled ? (
      <div data-testid="task-detail-title-trigger" className="block w-full text-left">
        <span
          data-testid="task-detail-title-text"
          className={cn('block wrap-break-word', titleTextClassName)}
        >
          {task.title || '未命名任务'}
        </span>
      </div>
    ) : (
      <button
        type="button"
        data-testid="task-detail-title-trigger"
        className={cn("block w-full text-left", !isMetaDisabled ? "cursor-text" : "cursor-default")}
        onClick={() => {
          if (!isMetaDisabled) {
            setEditingTextField('title');
          }
        }}
      >
        <span
          data-testid="task-detail-title-text"
          className={cn('block wrap-break-word', titleTextClassName)}
        >
          {task.title || '未命名任务'}
        </span>
      </button>
    )
  );

  const detailSurface = layout === 'dialog' ? 'plain' : 'card';
  const attachmentsPanel = (
    <DetailCard title="附件" className={layout === 'dialog' ? 'pb-6' : 'pb-6'} surface={detailSurface}>
      <div
        data-testid="task-detail-attachments-panel"
        data-layout="block"
        className="flex flex-col gap-3 px-0.5 pb-5"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-3 text-[13px] text-muted-foreground">
            <span
              className="inline-flex h-8 w-8 items-center justify-center text-(--tf-subtle-foreground)"
              aria-hidden="true"
            >
              <Paperclip className="h-5 w-5" />
            </span>
            <span className="font-medium">附件</span>
          </div>
          {!areAttachmentsDisabled ? (
            <AttachmentPickerTrigger
              className="inline-flex"
              testId="task-attachment-input"
              buttonText="上传附件"
              icon={<Paperclip className="h-4 w-4" aria-hidden="true" />}
              loading={uploadingTaskAttachments}
              onSelect={(files) => {
                void onUploadAttachments(files);
              }}
            />
          ) : null}
        </div>

        {task.attachments?.length ? (
          <div className="w-full space-y-2">
            {task.attachments.map((attachment) => {
              const filePresentation = getFileTypePresentation({
                fileName: attachment.original_name,
                mimeType: attachment.mime_type,
              });

              return (
                <div
                  key={attachment.id}
                  data-attachment-style="card"
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-(--tf-border) bg-(--tf-background) px-3 py-3 transition-colors duration-200 hover:bg-(--tf-card)"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <FileTypeIcon
                      fileName={attachment.original_name}
                      mimeType={attachment.mime_type}
                      className="h-10 w-10 shrink-0"
                    />
                    {isImageAttachment(attachment) && onPreviewImageAttachment ? (
                      <button
                        type="button"
                        aria-label={`预览图片 ${attachment.original_name}`}
                        className="min-w-0 flex-1 rounded-md text-left outline-none transition-colors hover:text-(--tf-foreground) focus-visible:ring-2 focus-visible:ring-ring/40"
                        onClick={() => onPreviewImageAttachment(attachment)}
                      >
                        <div className="truncate text-[13px] font-medium text-(--tf-foreground)">{attachment.original_name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {filePresentation.label} · {formatFileSize(attachment.file_size)}
                        </div>
                      </button>
                    ) : (
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-medium text-(--tf-foreground)">{attachment.original_name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {filePresentation.label} · {formatFileSize(attachment.file_size)}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-(--tf-card) hover:text-(--tf-foreground)"
                      aria-label="下载附件"
                      onClick={() => {
                        downloadAttachment(attachment.id, attachment.original_name);
                      }}
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    {!isDisabled ? (
                      <button
                        type="button"
                        aria-label="删除附件"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-rose-50 hover:text-rose-600"
                        onClick={() => {
                          void onDeleteAttachment(attachment.id);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-[13px] text-muted-foreground">该任务暂无附件</div>
        )}
      </div>
    </DetailCard>
  );

  const subtasksPanel = !isDeletedTask ? (
    <TaskSubtasksSection
      parentTaskId={task.id}
      subtasks={task.subtasks || []}
      subtaskCount={task.subtask_count || 0}
      subtaskDoneCount={task.subtask_done_count || 0}
      users={users}
      disabled={isDisabled}
      onNavigateToSubtask={(subtaskId) => {
        onNavigateToTask?.(subtaskId);
      }}
      onToggleStatus={async (subtaskId, currentStatus) => {
        const nextStatus = currentStatus === 'done' || currentStatus === 'delayed_done' ? 'in_progress' : 'done';
        await onUpdateSubtaskStatus?.(subtaskId, nextStatus);
      }}
      onOpenCreateSubtaskModal={onOpenCreateSubtaskModal}
      onUpdateSubtask={onUpdateSubtask}
    />
  ) : null;

  return (
    <section
      ref={popoverContainerRef}
      data-testid="task-detail-document-shell"
      data-layout={layout}
      className={cn(
        'min-h-0',
        layout === 'dialog'
          ? 'grid h-full grid-cols-[320px_minmax(300px,1fr)_340px] overflow-hidden bg-(--tf-background-soft) xl:grid-cols-[360px_minmax(340px,1fr)_380px] 2xl:grid-cols-[380px_minmax(360px,1fr)_420px]'
          : 'flex flex-col gap-3.5'
      )}
    >
      <main
        data-testid="task-detail-main-scroll"
        className={layout === 'dialog'
          ? 'order-2 flex min-h-0 flex-col gap-4 overflow-y-auto overscroll-contain bg-(--tf-background-soft) px-5 py-5 lg:px-6'
          : 'contents'}
      >
      <DetailCard className="gap-0" title="任务概览" surface={detailSurface}>
        {task.breadcrumbs && task.breadcrumbs.length > 0 && (
          <nav className="mb-2.5 flex flex-wrap items-center gap-1.5 text-xs text-[#787774]" aria-label="Breadcrumb">
            {task.breadcrumbs.map((bc) => (
              <span key={bc.id} className="inline-flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onNavigateToTask?.(bc.id)}
                  className="max-w-[140px] truncate hover:text-[#2783DE] hover:underline cursor-pointer"
                  title={bc.title}
                >
                  {bc.title}
                </button>
                <span className="text-[#D1D5DB]">/</span>
              </span>
            ))}
            <span className="max-w-[140px] truncate font-medium text-[#37352F]">{task.title}</span>
          </nav>
        )}
        <div
          data-testid="task-detail-title-surface"
          className="min-w-0 rounded-2xl border border-transparent bg-transparent px-0 py-0"
        >
          <div
            data-testid="task-detail-title-frame"
            data-mode={editingTextField === 'title' ? 'editing' : 'inline'}
            className="w-full"
          >
            {editingTextField === 'title' && !isDisabled ? (
              <textarea
                ref={titleTextareaRef}
                aria-label="任务标题"
                value={titleDraft}
                autoFocus
                rows={1}
                onChange={(event) => {
                  setTitleDraft(event.target.value);
                  event.target.style.height = 'auto';
                  event.target.style.height = `${event.target.scrollHeight}px`;
                }}
                onBlur={() => { void handleTitleCommit(); }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void handleTitleCommit();
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    setTitleDraft(task.title);
                    setEditingTextField(null);
                  }
                }}
                className={cn('block w-full resize-none overflow-hidden border-none bg-transparent px-0 py-0 shadow-none outline-none focus-visible:outline-none', titleTextClassName)}
              />
            ) : (
              titleDisplay
            )}
          </div>
        </div>

        <div data-testid="task-detail-overview-meta-row" className="mt-2.5 flex items-start justify-between gap-3">
          <div data-testid="task-detail-overview-chip-group" className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <span
              data-testid="task-detail-status-chip"
              data-color={taskStatusMeta.color}
              className="inline-flex min-h-6 items-center rounded-full px-2.5 text-[12px] font-medium transition-colors duration-200"
              style={getSoftToneStyle(taskStatusMeta.color)}
            >
              {taskStatusMeta.label}
            </span>
            <span
              data-testid="task-detail-priority-chip"
              data-color={taskPriorityMeta.color}
              className="inline-flex min-h-6 items-center rounded-full px-2.5 text-[12px] font-medium"
              style={getSoftToneStyle(taskPriorityMeta.color, 0.1)}
            >
              优先级 {taskPriorityMeta.label}
            </span>
            {task.due_date ? (
              <span className="inline-flex min-h-6 items-center rounded-full bg-(--tf-background) px-2.5 text-[12px] font-medium text-muted-foreground">
                截止 {dayjs(task.due_date).format('MM/DD')}
              </span>
            ) : null}
          </div>
          {headerActions ? (
            <div data-testid="task-detail-overview-action-slot" className="flex shrink-0 items-center justify-end">
              {headerActions}
            </div>
          ) : null}
        </div>
      </DetailCard>

      <DetailCard
        title="任务描述"
        className="pb-4"
        surface={detailSurface}
        titleAction={!isDisabled ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="编辑任务描述"
            title="编辑任务描述"
            data-testid="task-detail-description-edit-trigger"
            className="text-(--tf-subtle-foreground) hover:text-(--tf-foreground)"
            onClick={() => setEditingDescription(true)}
          >
            <Edit3 aria-hidden="true" />
          </Button>
        ) : null}
      >
        <div
          className="tf-task-description-transition flex flex-col gap-3 px-0.5"
          data-state={editingDescription && !isDisabled ? 'editing' : 'reading'}
        >
          {editingDescription && !isDisabled ? (
            <div className="tf-task-description-edit flex flex-col gap-3">
              <PagesEditor
                value={descriptionDraft}
                onChange={setDescriptionDraft}
                format="markdown"
                placeholder="输入任务描述，按 / 插入内容"
                disabled={savingField === 'description'}
                enableImages
                enableImagePasteDrop
                imageFallback="none"
                showImageButton
                onUploadImage={handleDescriptionImageUpload}
                onPendingUploadsChange={setDescriptionPendingUploadCount}
                imageToolbarClassName="rounded-none border-0 bg-transparent px-0 pb-2 pt-0"
                editorClassName="min-h-44 rounded-none border-0 bg-transparent px-0 py-0 text-[13px] leading-6 shadow-none focus-visible:border-transparent focus-visible:ring-0 focus-visible:shadow-none"
              />
              <div className="tf-task-description-actions flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleDescriptionCancel}
                  disabled={savingField === 'description'}
                >
                  取消
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => { void handleDescriptionCommit(); }}
                  disabled={savingField === 'description' || descriptionPendingUploadCount > 0}
                >
                  {savingField === 'description' || descriptionPendingUploadCount > 0 ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : '保存'}
                </Button>
              </div>
            </div>
          ) : (
            <div
              data-testid="task-detail-description-display"
              className={cn(
                'tf-task-description-read min-h-20 px-0.5 py-1',
                !isDisabled && 'cursor-text rounded-lg transition-colors hover:bg-(--tf-card)/55'
              )}
              onClick={(event) => {
                if (isDisabled) return;
                const target = event.target as HTMLElement;
                if (target.closest('a, img, button')) return;
                setEditingDescription(true);
              }}
            >
              <MarkdownContent
                markdown={task.description}
                emptyText="暂无描述"
                onImageClick={onPreviewRichTextImage}
              />
            </div>
          )}
        </div>
      </DetailCard>

      {pendingAuditCount > 0 && !isDeletedTask && !readOnly ? (
        <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-amber-800 border border-amber-200 shadow-sm" data-testid="task-pending-audit-alert">
          <Bell className="h-4 w-4 shrink-0 text-amber-600" />
          <div className="text-[13px] font-medium leading-5">当前有 {pendingAuditCount} 条进展需要您的审核</div>
        </div>
      ) : null}

      {showProgressPrompt && !isDeletedTask && !readOnly ? (
        <div className="flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2.5 text-blue-800 border border-blue-200 shadow-sm" data-testid="task-progress-prompt-alert">
          <Bell className="h-4 w-4 shrink-0 text-blue-600" />
          <div className="text-[13px] font-medium leading-5">请补充任务进展，您已超过周期未提交进展报告</div>
        </div>
      ) : null}

      {isDeletedTask ? (
        <DetailCard title="删除信息" className="pb-4" data-testid="task-detail-deletion-card" surface={detailSurface}>
          <div className="px-0.5 text-[13px] leading-6 text-muted-foreground">
            {task.deleted_by_name || '未知成员'}
            {task.deleted_at ? ` 于 ${dayjs(task.deleted_at).tz('Asia/Shanghai').format('YYYY/MM/DD HH:mm')}` : ''}
          </div>
        </DetailCard>
      ) : null}

      {subtasksPanel}
      {layout === 'dialog' ? attachmentsPanel : null}
      </main>

      <aside
        data-testid="task-detail-field-list"
        className={cn(
          'flex flex-col',
          layout === 'dialog'
            ? 'order-1 min-h-0 gap-3 overflow-y-auto overscroll-contain border-r border-(--tf-border) bg-[rgba(244,245,247,0.92)] px-4 py-5'
            : 'gap-3.5'
        )}
      >
        <DetailCard
          title="协作信息"
          surface={detailSurface}
          className={layout === 'dialog' ? 'order-2' : undefined}
        >
          <div className="flex flex-col gap-1">
            <FieldRow icon={<UserCircle2 className="h-5 w-5" />} label="负责人" testId="task-detail-field-row-assignee" compact={layout === 'dialog'}>
              <Popover
                open={assigneeOpen}
                onOpenChange={(open) => {
                  setAssigneeOpen(open);
                  if (!open) {
                    setUserKeyword('');
                  }
                }}
              >
                <PopoverTrigger asChild disabled={isMetaDisabled}>
                  <FieldValueTrigger className={cn('pr-2', layout === 'dialog' && 'w-full justify-between')}>
                    <PersonSummary
                      name={task.assignee_name}
                      avatar={task.assignee_avatar}
                      testId="task-detail-assignee-profile"
                    />
                    {!isDisabled ? <ChevronDown className="h-4 w-4 shrink-0 text-(--tf-subtle-foreground) opacity-0 transition-opacity duration-150 group-hover:opacity-100 data-[state=open]:opacity-100" /> : null}
                  </FieldValueTrigger>
                </PopoverTrigger>
                <MemberPickerPanel
                  portalContainer={popoverContainerRef.current}
                  widthClassName="w-[320px]"
                  placeholder="搜索负责人"
                  keyword={userKeyword}
                  onKeywordChange={setUserKeyword}
                  listTestId="task-detail-assignee-options"
                  listClassName="max-h-44"
                >
                  {usersLoading ? (
                    <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                      <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                      加载成员中...
                    </div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">没有匹配成员</div>
                  ) : filteredUsers.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-colors duration-150 hover:bg-(--tf-card)"
                      onClick={() => {
                        setAssigneeOpen(false);
                        setUserKeyword('');
                        void commitPatch('assignee', { assignee_id: user.id });
                      }}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <MemberAvatar name={user.name} avatar={user.avatar} />
                        <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium text-(--tf-foreground)">{user.name}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">{user.department_name || '未设置部门'}</span>
                        </span>
                      </span>
                      {task.assignee_id === user.id ? <Check className="h-4 w-4 text-(--tf-foreground)" /> : null}
                    </button>
                  ))}
                </MemberPickerPanel>
              </Popover>
            </FieldRow>

            <FieldRow icon={<Users className="h-5 w-5" />} label="参与人" testId="task-detail-field-row-participants" compact={layout === 'dialog'}>
              <Popover
                open={participantsOpen}
                onOpenChange={(open) => {
                  setParticipantsOpen(open);
                  if (!open) {
                    setParticipantDraft(participantIds);
                    setUserKeyword('');
                  }
                }}
              >
                <PopoverTrigger asChild disabled={isDisabled}>
                  <FieldValueTrigger className={cn('pr-2', layout === 'dialog' && 'w-full justify-between')}>
                    {participantProfiles.length > 0 ? (
                      <div className="flex min-w-0 flex-wrap items-center gap-3" data-testid="task-detail-participant-list">
                        {participantProfiles.map((participant) => (
                          <span key={participant.id} className="inline-flex min-w-0 items-center gap-2">
                            <MemberAvatar name={participant.name} avatar={participant.avatar} />
                            <span className="truncate text-[13px] font-medium leading-5 text-(--tf-foreground)">{participant.name}</span>
                          </span>
                        ))}
                      </div>
                    ) : (
                    <span className="whitespace-nowrap text-[13px] font-medium leading-6 text-muted-foreground">未设置</span>
                    )}
                    {!isDisabled ? <ChevronDown className="h-4 w-4 shrink-0 text-(--tf-subtle-foreground) opacity-0 transition-opacity duration-150 group-hover:opacity-100 data-[state=open]:opacity-100" /> : null}
                  </FieldValueTrigger>
                </PopoverTrigger>
                <MemberPickerPanel
                  portalContainer={popoverContainerRef.current}
                  widthClassName="w-[360px]"
                  placeholder="搜索参与人"
                  keyword={userKeyword}
                  onKeywordChange={setUserKeyword}
                  listTestId="task-detail-participants-options"
                  listClassName="max-h-48"
                  footer={(
                    <div
                      data-testid="task-detail-participants-footer"
                      className="mt-2.5 flex items-center justify-between border-t border-(--tf-border) pt-2.5"
                    >
                      <span className="text-xs text-muted-foreground">已选择 {participantDraft.length} 人</span>
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setParticipantsOpen(false);
                            setParticipantDraft(participantIds);
                          }}
                        >
                          取消
                        </Button>
                        <Button
                          size="sm"
                          data-testid="task-detail-participants-save"
                          disabled={savingField === 'participants'}
                          onClick={() => {
                            setParticipantsOpen(false);
                            void commitPatch('participants', { participant_ids: participantDraft });
                          }}
                        >
                          完成
                        </Button>
                      </div>
                    </div>
                  )}
                >
                  {usersLoading ? (
                    <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                      <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                      加载成员中...
                    </div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">没有匹配成员</div>
                  ) : filteredUsers.map((user) => {
                    const checked = participantDraft.includes(user.id);
                    return (
                      <button
                        key={user.id}
                        type="button"
                        data-testid={`task-detail-participant-option-${user.id}`}
                        data-state={checked ? 'checked' : 'unchecked'}
                        className={cn(
                          'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-all duration-200',
                          checked ? 'bg-accent' : 'hover:bg-(--tf-card)'
                        )}
                        onClick={() => {
                          setParticipantDraft((current) => (
                            current.includes(user.id)
                              ? current.filter((id) => id !== user.id)
                              : [...current, user.id]
                          ));
                        }}
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <span
                            aria-hidden="true"
                            className={cn(
                              'inline-flex size-4 shrink-0 items-center justify-center rounded-sm border border-(--tf-border) bg-(--tf-background) text-primary',
                              checked && 'border-primary bg-primary text-white'
                            )}
                          >
                            {checked ? <Check className="size-3.5" aria-hidden="true" /> : null}
                          </span>
                          <MemberAvatar name={user.name} avatar={user.avatar} />
                          <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium text-(--tf-foreground)">{user.name}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">{user.department_name || '未设置部门'}</span>
                          </span>
                        </span>
                        {checked ? <span className="text-xs font-medium text-muted-foreground">已选</span> : null}
                      </button>
                    );
                  })}
                </MemberPickerPanel>
              </Popover>
            </FieldRow>
          </div>
        </DetailCard>

        <DetailCard
          title="任务属性"
          surface={detailSurface}
          className={layout === 'dialog' ? 'order-1' : undefined}
        >
          <div className="flex flex-col gap-1">
            <FieldRow icon={<CheckSquare2 className="h-5 w-5" />} label="状态" testId="task-detail-field-row-status" compact={layout === 'dialog'}>
              <Popover open={statusOpen} onOpenChange={setStatusOpen}>
                <PopoverTrigger asChild disabled={isDisabled}>
                  <FieldValueTrigger className={cn('text-[13px]', layout === 'dialog' && 'w-full justify-between')}>
                    <span
                      className="inline-flex min-h-6 items-center whitespace-nowrap rounded-full px-2.5 text-[13px] font-medium transition-colors duration-200"
                      style={getSoftToneStyle(taskStatusMeta.color)}
                    >
                      {taskStatusMeta.label}
                    </span>
                    {!isDisabled ? <ChevronDown className="h-4 w-4 text-(--tf-subtle-foreground) opacity-0 transition-opacity duration-150 group-hover:opacity-100 data-[state=open]:opacity-100" /> : null}
                  </FieldValueTrigger>
                </PopoverTrigger>
                <PopoverContent portalContainer={popoverContainerRef.current} className="w-56 p-2">
                  <div className="space-y-1">
                    {statusOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-[13px] text-muted-foreground transition-colors duration-150 hover:bg-(--tf-card) hover:text-(--tf-foreground)"
                        onClick={() => {
                          setStatusOpen(false);
                          void commitPatch('status', { status: option.value });
                        }}
                      >
                        <span style={{ color: getStatusMeta(option.value).color }}>{option.label}</span>
                        {task.status === option.value ? <Check className="h-4 w-4 text-(--tf-foreground)" /> : null}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </FieldRow>

            <FieldRow icon={<CalendarDays className="h-5 w-5" />} label="时间" testId="task-detail-field-row-schedule" multiline compact={layout === 'dialog'}>
              <div className="w-full space-y-2">
                <div className="flex items-center gap-1.5">
                  <div className={cn(
                    'min-w-0 flex-1 overflow-hidden',
                    layout === 'dialog' && '[&_button]:min-w-0 [&_button]:gap-1.5 [&_button]:px-2 [&_button_span]:truncate'
                  )}>
                    <DateRangePicker
                      startDate={startDateValue}
                      endDate={dueDateValue}
                      disabled={isMetaDisabled}
                      displayMode="dialog"
                      portalContainer={popoverContainerRef.current}
                      testId="task-detail-schedule-range-input"
                      onChange={({ startDate: nextStart, endDate: nextEnd }) => {
                        void commitPatch('schedule', {
                          start_date: nextStart || null,
                          due_date: nextEnd || null,
                        });
                      }}
                    />
                  </div>
                  {(() => {
                    const reminderDisabled = isMetaDisabled || isCanceledTask || !dueDateValue || task.status === 'done' || task.status === 'delayed_done';
                    const triggerProps = {
                      type: 'button' as const,
                      className: cn(
                        'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors duration-150',
                        isMobile ? 'bg-[#FAFAFA] border-none shadow-none' : 'border border-transparent', // [MOBILE ADAPTATION]
                        reminderDisabled
                          ? 'cursor-not-allowed text-(--tf-subtle-foreground)/40'
                          : (task.reminder_rule && task.reminder_rule !== 'none') || task.periodic_interval_days
                            ? 'text-amber-500 hover:border-(--tf-border) hover:bg-(--tf-card)'
                            : 'text-(--tf-subtle-foreground) hover:border-(--tf-border) hover:bg-(--tf-card)'
                      ),
                      'aria-label': '设置提醒',
                      'data-testid': 'task-detail-reminder-trigger',
                      children: (task.reminder_rule && task.reminder_rule !== 'none') || task.periodic_interval_days ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4 text-[#9B9A97]" />,
                    };

                    if (isMobile) {
                      return (
                        <ResponsiveDialog
                          open={reminderOpen}
                          onOpenChange={setReminderOpen}
                          title="设置提醒"
                          trigger={<button {...triggerProps} onClick={() => !reminderDisabled && setReminderOpen(true)} />}
                        >
                          <CompoundReminderSetting
                            reminderRule={task.reminder_rule}
                            onReminderRuleChange={(r) => { void commitPatch('reminder', { reminder_rule: r }); }}
                            periodicIntervalDays={task.periodic_interval_days}
                            periodicTime={task.periodic_time}
                            onPeriodicChange={(interval, time) => { void commitPatch('periodic', { periodic_interval_days: interval, periodic_time: time }); }}
                            onClose={() => setReminderOpen(false)}
                          />
                        </ResponsiveDialog>
                      );
                    }

                    return (
                      <Popover open={reminderOpen} onOpenChange={setReminderOpen}>
                        <PopoverTrigger asChild disabled={reminderDisabled}>
                          <button {...triggerProps} />
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 z-1600" align="end" side="bottom">
                          <CompoundReminderSetting
                            reminderRule={task.reminder_rule}
                            onReminderRuleChange={(r) => { void commitPatch('reminder', { reminder_rule: r }); }}
                            periodicIntervalDays={task.periodic_interval_days}
                            periodicTime={task.periodic_time}
                            onPeriodicChange={(interval, time) => { void commitPatch('periodic', { periodic_interval_days: interval, periodic_time: time }); }}
                            onClose={() => setReminderOpen(false)}
                          />
                        </PopoverContent>
                      </Popover>
                    );
                  })()}
                </div>
                <span className="inline-flex items-start text-[13px] leading-6 text-muted-foreground" data-testid="task-detail-duration-row">
                  {durationSummary}
                </span>
                {completedAt ? (
                  <span className="inline-flex items-center text-[12px] leading-5 text-emerald-600" data-testid="task-detail-completed-at-row">
                    {completedAt.format('YYYY/MM/DD HH:mm')} 完成
                  </span>
                ) : null}
                {task.reminder_rule && task.reminder_rule !== 'none' ? (
                  <span className="inline-flex items-center gap-1.5 text-[12px] leading-5 text-amber-600" data-testid="task-detail-reminder-label">
                    <Bell className="h-3 w-3" />
                    {reminderOptions.find((o) => o.value === task.reminder_rule)?.label || '已设置提醒'}
                  </span>
                ) : null}
              </div>
            </FieldRow>

            <FieldRow icon={<Flag className="h-5 w-5" />} label="优先级" testId="task-detail-field-row-priority" compact={layout === 'dialog'}>
              <Popover open={priorityOpen} onOpenChange={setPriorityOpen}>
                <PopoverTrigger asChild disabled={isMetaDisabled}>
                  <FieldValueTrigger className={layout === 'dialog' ? 'w-full justify-between' : undefined}>
                    <span
                      className="text-[13px] font-semibold leading-6"
                      style={{ color: taskPriorityMeta.color }}
                    >
                      {taskPriorityMeta.label}
                    </span>
                    {!isDisabled ? <ChevronDown className="h-4 w-4 text-(--tf-subtle-foreground) opacity-0 transition-opacity duration-150 group-hover:opacity-100 data-[state=open]:opacity-100" /> : null}
                  </FieldValueTrigger>
                </PopoverTrigger>
                <PopoverContent portalContainer={popoverContainerRef.current} className="w-56 p-2">
                  <div className="space-y-1">
                    {priorityOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-[13px] text-muted-foreground transition-colors duration-150 hover:bg-(--tf-card) hover:text-(--tf-foreground)"
                        onClick={() => {
                          setPriorityOpen(false);
                          void commitPatch('priority', { priority: option.value });
                        }}
                      >
                        <span className="font-medium" style={{ color: getPriorityMeta(option.value).color }}>{option.label}</span>
                        {task.priority === option.value ? <Check className="h-4 w-4 text-(--tf-foreground)" /> : null}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </FieldRow>

            <FieldRow icon={<Users className="h-5 w-5" />} label="所属团队" testId="task-detail-field-row-team" compact={layout === 'dialog'}>
              <Popover open={teamOpen} onOpenChange={setTeamOpen}>
                <PopoverTrigger asChild disabled={isMetaDisabled || !isFullEditor}>
                  <FieldValueTrigger className={layout === 'dialog' ? 'w-full justify-between' : undefined}>
                    <span className="text-[13px] font-medium leading-6 text-(--tf-foreground)">
                      {task.team_name || '个人任务'}
                    </span>
                    {!isDisabled && isFullEditor ? (
                      <ChevronDown className="h-4 w-4 text-(--tf-subtle-foreground) opacity-0 transition-opacity duration-150 group-hover:opacity-100 data-[state=open]:opacity-100" />
                    ) : null}
                  </FieldValueTrigger>
                </PopoverTrigger>
                <PopoverContent portalContainer={popoverContainerRef.current} className="w-56 p-2">
                  <div className="space-y-1 max-h-60 overflow-y-auto">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-[13px] text-muted-foreground transition-colors duration-150 hover:bg-(--tf-card) hover:text-(--tf-foreground)"
                      onClick={() => {
                        setTeamOpen(false);
                        void commitPatch('team', { team_id: null });
                      }}
                    >
                      <span className="font-medium">个人任务</span>
                      {!task.team_id ? <Check className="h-4 w-4 text-(--tf-foreground)" /> : null}
                    </button>
                    {teams.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-[13px] text-muted-foreground transition-colors duration-150 hover:bg-(--tf-card) hover:text-(--tf-foreground)"
                        onClick={() => {
                          setTeamOpen(false);
                          void commitPatch('team', { team_id: t.id });
                        }}
                      >
                        <span className="truncate">{t.name}</span>
                        {task.team_id === t.id ? <Check className="h-4 w-4 text-(--tf-foreground) shrink-0" /> : null}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </FieldRow>

            {layout === 'dialog' ? (
              <Collapsible className="group/more mt-2 border-t border-(--tf-border-soft) pt-2">
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex h-9 w-full items-center justify-between rounded-lg px-2 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-(--tf-card) hover:text-(--tf-foreground)"
                  >
                    <span>更多属性</span>
                    <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]/more:rotate-180" aria-hidden="true" />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-1 pt-1">
                  <FieldRow icon={<UserCircle2 className="h-5 w-5" />} label="创建人" testId="task-detail-field-row-creator" compact>
                    <FieldValueDisplay>
                      <PersonSummary
                        name={task.creator_name}
                        avatar={task.creator_avatar}
                        testId="task-detail-creator-profile"
                      />
                    </FieldValueDisplay>
                  </FieldRow>
                  <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-2 px-0.5 py-2 text-[12px] text-muted-foreground">
                    <span className="pl-8">创建时间</span>
                    <span className="whitespace-nowrap">{dayjs(task.created_at).format('YYYY/MM/DD HH:mm')}</span>
                  </div>
                  <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-2 px-0.5 py-2 text-[12px] text-muted-foreground">
                    <span className="pl-8">更新时间</span>
                    <span className="whitespace-nowrap">{dayjs(task.updated_at).format('YYYY/MM/DD HH:mm')}</span>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ) : (
              <FieldRow icon={<UserCircle2 className="h-5 w-5" />} label="创建人" testId="task-detail-field-row-creator">
                <FieldValueDisplay>
                  <PersonSummary
                    name={task.creator_name}
                    avatar={task.creator_avatar}
                    testId="task-detail-creator-profile"
                  />
                </FieldValueDisplay>
              </FieldRow>
            )}
          </div>
        </DetailCard>

        {layout === 'stacked' ? (
          <>
            {subtasksPanel}
            {attachmentsPanel}
          </>
        ) : null}
      </aside>
      {layout === 'dialog' && activityPanel ? (
        <aside
          data-testid="task-detail-activity-panel"
          className="order-3 min-h-0 overflow-hidden border-l border-(--tf-border) bg-(--tf-background)"
        >
          {activityPanel}
        </aside>
      ) : null}
      {layout === 'stacked' ? <div data-testid="task-detail-bottom-spacer" aria-hidden="true" className="h-6 shrink-0" /> : null}
    </section>
  );
}
