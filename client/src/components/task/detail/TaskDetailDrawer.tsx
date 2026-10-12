/**
 * 组件名称：任务详情弹窗
 * 文件作用：桌面端以大尺寸弹窗展示任务详情，移动端保留底部抽屉。
 * 主要功能：主内容展示描述、附件和活动流，右侧属性栏维护任务字段。
 */
import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import type { Editor as TiptapEditor } from '@tiptap/core';
import { Download, Paperclip, Trash2, LoaderCircle, Check, X, MessageCircle, LayoutGrid, Eye, Search, ImagePlus } from 'lucide-react';
import dayjs from 'dayjs';
import type { Attachment, Comment, CommentMessageType, CommentReadParticipant, CommentReadStatus, Task, TaskDetailSource, TaskStatus, User } from '@/types';
import { useAuthStore, useCommentStore, useTaskStore } from '@/store';
import request from '@/api/request';
import FileTypeIcon, { getFileTypePresentation } from '@/components/shared/file/FileTypeIcon';
import TaskDetailLeftPanel from '@/components/task/detail/TaskDetailLeftPanel';
import CreateTaskModal from '@/components/task/form/CreateTaskModal';
import TaskOverviewActionController from '@/components/task/detail/TaskOverviewActionController';
import NotificationPreviewPanel from '@/components/task/detail/NotificationPreviewPanel';
import { useNotificationPreview } from '@/hooks/useNotificationPreview';
import { useDingTalkRuntime } from '@/hooks/useDingTalkRuntime';
import { useIsMobile } from '@/hooks/useIsMobile'; // [MOBILE ONLY]
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import MarkdownContent from '@/components/shared/markdown/MarkdownContent';
import type { MarkdownPreviewImage } from '@/components/shared/markdown/MarkdownContent';
import { Editor as PagesEditor } from '@/components/ui/editor';
import type { EditorMentionTrigger, ImageUploadHandler } from '@/components/ui/editor';
import { cn } from '@/lib/utils';
import { createRequestId } from '@/utils/requestId';
import { downloadAttachment } from '@/utils/downloadAttachment';
import type { AttachmentSource } from '@/utils/downloadAttachment';
import AttachmentImagePreviewDialog, { isImageAttachment } from '@/components/shared/file/AttachmentImagePreviewDialog';
import { isCommentReadTrackingActive, useCommentReadReceipts } from '@/components/task/detail/commentReadReceipts';
import { toast } from 'sonner';

type ImagePreviewTarget =
  | { kind: 'attachment'; attachment: Attachment; source: AttachmentSource }
  | { kind: 'rich-text'; image: MarkdownPreviewImage };

interface TaskDetailDrawerProps {
  taskId: string | null;
  visible: boolean;
  onClose: () => void;
  source?: TaskDetailSource;
  /** 只读模式：禁止编辑、评论、操作（Admin 后台使用） */
  readOnly?: boolean;
}

function formatFileSize(size?: number) {
  if (!size) return '0 B';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function getInitial(name?: string) {
  return (name || '?').slice(0, 1);
}

function resolveCommentMessageType(comment?: Pick<Comment, 'message_type'> | null): CommentMessageType {
  return comment?.message_type === 'progress' ? 'progress' : 'message';
}

function buildCommentDraftSignature(
  content: string,
  files: File[] = [],
  mentionedUserIds: string[] = []
) {
  const fileSignature = (files || [])
    .map((file) => `${file.name}:${file.size}:${file.type}:${file.lastModified}`)
    .join('|');
  const mentionSignature = [...new Set(mentionedUserIds)].sort().join('|');

  return `${content.trim()}::${fileSignature}::${mentionSignature}`;
}

function getTaskParticipantIds(task?: Pick<Task, 'participant_ids' | 'participants'> | null) {
  return task?.participant_ids || task?.participants?.map((participant) => participant.id) || [];
}

function getTaskRelatedRole(task: Task | null | undefined, userId: string) {
  if (!task || !userId) return '';
  if (task.creator_id === userId) return '发起人';
  if (task.assignee_id === userId) return '负责人';
  if (getTaskParticipantIds(task).includes(userId)) return '协作者';
  return '';
}

function memberMatchesMentionQuery(member: User, query: string) {
  const keyword = query.trim().toLowerCase();
  if (!keyword) return true;

  return [
    member.name,
    member.department_name,
    member.job_number,
    member.mobile,
    member.email,
  ].some((value) => String(value || '').toLowerCase().includes(keyword));
}

function buildMentionUser(id?: string, name?: string, avatar?: string | null): User | null {
  if (!id) return null;

  return {
    id,
    name: name || '未知成员',
    avatar: avatar || '',
    is_dept_manager: 0,
    status: 1,
    created_at: '',
    updated_at: '',
  };
}

function buildTaskStakeholderMentionUsers(task?: Task | null) {
  if (!task) return [];

  const members: User[] = [];
  const seen = new Set<string>();
  const addMember = (member: User | null) => {
    if (!member || seen.has(member.id)) return;
    seen.add(member.id);
    members.push(member);
  };

  addMember(buildMentionUser(task.creator_id, task.creator_name, task.creator_avatar));
  addMember(buildMentionUser(task.assignee_id, task.assignee_name, task.assignee_avatar));

  for (const participant of task.participants || []) {
    addMember(buildMentionUser(participant.id, participant.name, participant.avatar));
  }

  return members;
}

function mergeMentionUsers(primaryMembers: User[], fallbackMembers: User[]) {
  const merged: User[] = [];
  const seen = new Set<string>();

  for (const member of [...primaryMembers, ...fallbackMembers]) {
    if (!member?.id || seen.has(member.id)) continue;
    seen.add(member.id);
    merged.push(member);
  }

  return merged;
}

function CommentAvatar({
  name,
  avatar,
}: {
  name?: string;
  avatar?: string | null;
}) {
  return (
    <Avatar className="size-8 border border-(--tf-border) bg-(--tf-background)">
      <AvatarImage src={avatar || undefined} alt={name || '成员头像'} />
      <AvatarFallback>{getInitial(name)}</AvatarFallback>
    </Avatar>
  );
}

function CommentInput({
  value,
  onChange,
  submitting,
  onSubmit,
  task,
  teamMembers,
  canMentionTaskExternalMembers,
  mentionedUsers,
  onMentionUsersChange,
  pendingFiles,
  uploadingAttachments,
  onAttachFiles,
  onRemoveFile,
  onUploadImage,
}: {
  value: string;
  onChange: (v: string) => void;
  submitting: boolean;
  onSubmit: () => void;
  task?: Task | null;
  teamMembers?: User[];
  canMentionTaskExternalMembers?: boolean;
  mentionedUsers?: User[];
  onMentionUsersChange?: (users: User[]) => void;
  pendingFiles?: File[];
  uploadingAttachments?: boolean;
  onAttachFiles?: (files: File[]) => void;
  onRemoveFile?: (index: number) => void;
  onUploadImage?: (file: File) => Promise<string>;
}) {
  const [focused, setFocused] = useState(false);
  const [mentionTrigger, setMentionTrigger] = useState<EditorMentionTrigger | null>(null);
  const [pendingInlineImageUploadCount, setPendingInlineImageUploadCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<TiptapEditor | null>(null);
  const inlineImagePickerRef = useRef<(() => void) | null>(null);
  const mentionPanelRef = useRef<HTMLDivElement>(null);

  const handleImagePickerReady = useCallback((openImagePicker: (() => void) | null) => {
    inlineImagePickerRef.current = openImagePicker;
  }, []);

  const mentionGroups = useMemo(() => {
    const members = (teamMembers || []).filter((member) => memberMatchesMentionQuery(member, mentionTrigger?.query || ''));
    const related: User[] = [];
    const others: User[] = [];

    for (const member of members) {
      if (getTaskRelatedRole(task, member.id)) {
        related.push(member);
      } else if (canMentionTaskExternalMembers) {
        others.push(member);
      }
    }

    return { related, others };
  }, [canMentionTaskExternalMembers, mentionTrigger?.query, task, teamMembers]);

  const mentionPanelOpen = Boolean(mentionTrigger);

  const isMentionPanelTarget = (target: EventTarget | null) => {
    const targetNode = target as Node | null;
    return Boolean(targetNode && mentionPanelRef.current?.contains(targetNode));
  };

  const closeMentionPanel = () => {
    setMentionTrigger(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length && onAttachFiles) {
      onAttachFiles(files);
    }
    e.target.value = '';
  };

  const handleInlineImageUpload: ImageUploadHandler = async (file) => {
    if (!onUploadImage) return null;

    const src = await onUploadImage(file);
    return { src, alt: file.name };
  };

  const handleSubmitRequest = () => {
    if (!value.trim() || submitting || pendingInlineImageUploadCount > 0) return;
    onSubmit();
  };

  const handleMentionSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const editor = editorRef.current;
    if (!mentionTrigger || !editor) return;

    const nextQuery = e.target.value.replace(/[\s@]/g, '');
    editor
      .chain()
      .deleteRange(mentionTrigger.range)
      .insertContent(`@${nextQuery}`)
      .run();
    setMentionTrigger({
      query: nextQuery,
      range: {
        from: mentionTrigger.range.from,
        to: mentionTrigger.range.from + nextQuery.length + 1,
      },
    });
  };

  const handleMentionSelect = (member: User) => {
    const editor = editorRef.current;
    if (!mentionTrigger || !editor) return;

    const inserted = `@${member.name} `;
    editor
      .chain()
      .focus()
      .deleteRange(mentionTrigger.range)
      .insertContent(inserted)
      .run();
    setMentionTrigger(null);
    onMentionUsersChange?.([
      ...((mentionedUsers || []).filter((user) => user.id !== member.id)),
      member,
    ]);
  };

  const renderMentionGroup = (title: string, members: User[]) => {
    if (members.length === 0) return null;

    return (
      <div className="py-1">
        <div className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground">{title}</div>
        {members.map((member) => {
          const roleLabel = getTaskRelatedRole(task, member.id);

          return (
            <button
              key={member.id}
              type="button"
              aria-label={`${member.name}${roleLabel ? ` ${roleLabel}` : ''}`}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition-colors hover:bg-(--tf-background-soft)"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => handleMentionSelect(member)}
            >
              <Avatar className="size-6 border border-(--tf-border) bg-(--tf-background)">
                <AvatarImage src={member.avatar || undefined} alt={member.name || '成员头像'} />
                <AvatarFallback className="text-[10px]">{getInitial(member.name)}</AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-(--tf-foreground)">{member.name}</span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {roleLabel || member.department_name || '团队成员'}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div
      className={cn(
        'relative flex flex-col overflow-visible rounded-lg border bg-background transition-[border-color,box-shadow]',
        focused ? 'border-primary ring-1 ring-ring/20' : 'border-input'
      )}
    >
      <div
        onFocusCapture={() => setFocused(true)}
        onBlurCapture={(event) => {
          if (isMentionPanelTarget(event.relatedTarget)) {
            return;
          }
          setFocused(false);
          closeMentionPanel();
        }}
      >
        <PagesEditor
          value={value}
          onChange={onChange}
          format="markdown"
          placeholder="请输入内容，按 / 打开格式与插入菜单"
          enableImages={Boolean(onUploadImage)}
          enableImagePasteDrop
          imageFallback="none"
          onUploadImage={handleInlineImageUpload}
          onPendingUploadsChange={setPendingInlineImageUploadCount}
          onEditorReady={(editor) => {
            editorRef.current = editor;
          }}
          onImagePickerReady={handleImagePickerReady}
          onMentionTriggerChange={setMentionTrigger}
          onSubmitShortcut={handleSubmitRequest}
          className="rounded-none"
          editorClassName="min-h-24 max-h-40 overflow-y-auto rounded-none border-0 bg-transparent text-[13px] leading-6 shadow-none focus-visible:ring-0"
        />
      </div>

      {mentionPanelOpen ? (
        <div
          ref={mentionPanelRef}
          data-testid="mention-suggestion-panel"
          data-position="above-composer"
          className="absolute right-3 bottom-[calc(100%+8px)] left-3 z-50 max-h-80 overflow-hidden rounded-lg border border-(--tf-border) bg-(--tf-background) shadow-lg"
        >
          <div className="border-b border-(--tf-border) px-2 py-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input
                type="text"
                aria-label="搜索团队成员"
                placeholder="搜索团队成员"
                value={mentionTrigger?.query || ''}
                onChange={handleMentionSearchChange}
                onFocus={() => setFocused(true)}
                onBlur={(e) => {
                  if (isMentionPanelTarget(e.relatedTarget)) {
                    return;
                  }
                  setFocused(false);
                  closeMentionPanel();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    closeMentionPanel();
                  }
                }}
                className="h-8 w-full rounded-md border border-(--tf-border) bg-(--tf-background-soft) pr-2 pl-7 text-[13px] outline-none transition-colors placeholder:text-muted-foreground focus:border-(--tf-border-strong) focus:bg-(--tf-background)"
              />
            </div>
          </div>
          <div className="max-h-64 overflow-auto py-1">
            {mentionGroups.related.length === 0 && mentionGroups.others.length === 0 ? (
              <div className="px-3 py-3 text-[12px] text-muted-foreground">未找到成员</div>
            ) : (
              <>
                {renderMentionGroup('任务相关人', mentionGroups.related)}
                {mentionGroups.related.length > 0 && mentionGroups.others.length > 0 ? (
                  <div className="mx-3 my-1 h-px bg-(--tf-border)" />
                ) : null}
                {renderMentionGroup('团队其他成员', mentionGroups.others)}
              </>
            )}
          </div>
        </div>
      ) : null}

      {/* 待发送附件列表 */}
      {pendingFiles && pendingFiles.length > 0 && (
        <div className="border-t border-(--tf-border) px-3 py-2.5">
          <div data-testid="pending-comment-attachments" data-layout="stack" className="flex flex-col gap-2">
            {pendingFiles.map((file, index) => {
              const filePresentation = getFileTypePresentation({
                fileName: file.name,
                mimeType: file.type,
              });

              return (
                <div
                  key={`${file.name}-${index}`}
                  data-attachment-style="card"
                  data-attachment-state="pending"
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-(--tf-border) bg-[rgba(250,250,248,0.84)] px-3 py-2.5"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <FileTypeIcon
                      fileName={file.name}
                      mimeType={file.type}
                      className="h-9 w-9 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium text-(--tf-foreground)">{file.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {uploadingAttachments ? '上传中' : filePresentation.label} · {formatFileSize(file.size)}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label={`移除 ${file.name}`}
                    onClick={() => onRemoveFile?.(index)}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-(--tf-card) hover:text-(--tf-foreground)"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 底部工具栏 */}
      <div data-testid="comment-input-toolbar" className="flex items-center justify-between gap-3 border-t border-(--tf-border) px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="插入图片"
            title="插入图片"
            disabled={!onUploadImage}
            onClick={() => inlineImagePickerRef.current?.()}
          >
            <ImagePlus aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="添加附件"
            title="添加附件"
            disabled={uploadingAttachments}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploadingAttachments ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : (
              <Paperclip aria-hidden="true" />
            )}
          </Button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          className="hidden"
          onChange={handleFileChange}
          data-testid="comment-attachment-input"
        />

        <Button
          type="button"
          size="sm"
          disabled={!value.trim() || submitting || pendingInlineImageUploadCount > 0}
          onClick={handleSubmitRequest}
        >
          {submitting || pendingInlineImageUploadCount > 0
            ? <LoaderCircle className="animate-spin" aria-hidden="true" />
            : '发送'
          }
        </Button>
      </div>
    </div>
  );
}

const COMMENT_READ_ROLE_LABELS: Record<CommentReadParticipant['role'], string> = {
  creator: '发起人',
  assignee: '负责人',
  participant: '协作者',
};

function CommentReadPeopleList({
  title,
  people,
  emptyText,
}: {
  title: string;
  people: CommentReadParticipant[];
  emptyText: string;
}) {
  return (
    <div className="space-y-2">
      <div className="text-[11px] font-semibold text-muted-foreground">{title}</div>
      {people.length === 0 ? (
        <div className="rounded-lg bg-(--tf-background-soft) px-3 py-2 text-[12px] text-muted-foreground">{emptyText}</div>
      ) : (
        <div className="space-y-1.5">
          {people.map((person) => (
            <div key={person.id} className="flex min-w-0 items-center justify-between gap-3 rounded-lg px-1 py-1">
              <div className="flex min-w-0 items-center gap-2">
                <Avatar className="size-6 border border-(--tf-border) bg-(--tf-background)">
                  <AvatarImage src={person.avatar || undefined} alt={person.name || '成员头像'} />
                  <AvatarFallback className="text-[10px]">{getInitial(person.name || undefined)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="truncate text-[12px] font-medium text-(--tf-foreground)">{person.name || '未命名成员'}</div>
                  <div className="truncate text-[10px] text-muted-foreground">
                    {COMMENT_READ_ROLE_LABELS[person.role]}
                    {person.department_name ? ` · ${person.department_name}` : ''}
                  </div>
                </div>
              </div>
              {person.read_at ? (
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {dayjs(person.read_at).tz('Asia/Shanghai').format('MM-DD HH:mm')}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CommentReadStatusPopover({
  comment,
  onLoadStatus,
}: {
  comment: Comment;
  onLoadStatus: (commentId: string) => Promise<CommentReadStatus>;
}) {
  const readState = comment.read_state;
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<CommentReadStatus | null>(null);
  const [loading, setLoading] = useState(false);

  if (!readState || readState.recipient_count <= 0) {
    return null;
  }

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen || status || loading) return;

    setLoading(true);
    onLoadStatus(comment.id)
      .then((result) => {
        setStatus(result);
      })
      .catch(() => {
        setStatus(null);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const label = readState.unread_count > 0
    ? `已读 ${readState.read_count}/${readState.recipient_count}`
    : '全部已读';

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-(--tf-background-soft) hover:text-(--tf-foreground)"
          aria-label="查看评论已读状态"
        >
          <Eye className="size-3" aria-hidden="true" />
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[296px] space-y-3">
        {loading ? (
          <div className="flex items-center gap-2 px-1 py-2 text-[12px] text-muted-foreground">
            <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
            正在加载
          </div>
        ) : status ? (
          <>
            <CommentReadPeopleList title={`已读 ${status.read.length}`} people={status.read} emptyText="暂无已读成员" />
            <Separator />
            <CommentReadPeopleList title={`未读 ${status.unread.length}`} people={status.unread} emptyText="暂无未读成员" />
          </>
        ) : (
          <div className="px-1 py-2 text-[12px] text-muted-foreground">暂无已读数据</div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default function TaskDetailDrawer({ taskId: propTaskId, visible, onClose, source = 'default', readOnly = false }: TaskDetailDrawerProps) {
  const isMobile = useIsMobile(); // [MOBILE ONLY] 探测是否为移动端
  const [activeTab, setActiveTab] = useState<'info' | 'chat'>('info'); // [MOBILE ONLY] 移动端 Tab 状态
  const [activeTaskId, setActiveTaskId] = useState<string | null>(propTaskId);
  const [createSubtaskModalVisible, setCreateSubtaskModalVisible] = useState(false);

  useEffect(() => {
    setActiveTaskId(propTaskId);
  }, [propTaskId, visible]);

  const taskId = activeTaskId || propTaskId;
  const { user } = useAuthStore();
  const {
    getTaskById,
    fetchTaskDetail,
    updateTask,
    updateTaskStatus,
    getTaskShareLink,
    deleteTask,
    restoreTask,
    uploadTaskAttachments,
    deleteTaskAttachment,
  } = useTaskStore();
  const {
    comments,
    loading: commentsLoading,
    fetchComments,
    createComment,
    markCommentsRead,
    fetchCommentReadStatus,
    resetComments,
  } = useCommentStore();
  const taskFromStore = taskId ? getTaskById(taskId) || null : null;
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const task = taskFromStore || detailTask;

  // 判定当前用户是否为该任务的相关人
  const isRelated = useMemo(() => {
    if (!task || !user?.id) return false;
    const participantIds = task.participant_ids || task.participants?.map(p => p.id) || [];
    return task.creator_id === user.id || 
           task.assignee_id === user.id || 
           participantIds.includes(user.id);
  }, [task, user?.id]);

  // 是否为超级管理员
  const isSuperAdmin = useMemo(() => {
    return user?.globalRoleCodes?.includes('super_admin') || false;
  }, [user]);

  const isDeletedTask = Boolean(task && (task.is_deleted || task.deleted_at));
  const isTrashDetail = source === 'trash' || isDeletedTask;

  // 最终的只读状态：如果是分享链接、在回收站、已取消、或者【既不是相关人也不是该团队管理员且不是超管】
  const effectiveReadOnly = Boolean(readOnly || isTrashDetail || (task && !isRelated && !task.is_team_admin && !isSuperAdmin));
  const [commentDraft, setCommentDraft] = useState('');
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [commentMentionUsers, setCommentMentionUsers] = useState<User[]>([]);
  const [pendingCommentFiles, setPendingCommentFiles] = useState<File[]>([]);
  const [pendingCommentAttachmentIds, setPendingCommentAttachmentIds] = useState<string[]>([]);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [uploadingTaskAttachments, setUploadingTaskAttachments] = useState(false);
  const [uploadingCommentAttachments, setUploadingCommentAttachments] = useState(false);
  const [newestCommentId, setNewestCommentId] = useState<string | null>(null);
  const [imagePreviewTarget, setImagePreviewTarget] = useState<ImagePreviewTarget | null>(null);
  const [documentVisible, setDocumentVisible] = useState(() => (
    typeof document === 'undefined' ? true : document.visibilityState === 'visible'
  ));
  const commentFeedRef = useRef<HTMLDivElement>(null);
  const commentSubmitInFlightRef = useRef(false);
  const commentRequestRef = useRef<{ signature: string; requestId: string } | null>(null);
  const {
    isDingTalkEnvironment,
    ensureReady: ensureDingTalkReady,
    errorMessage: dingtalkRuntimeError,
  } = useDingTalkRuntime();

  const notificationPreview = useNotificationPreview({
    scopeId: taskId,
    onSend: (_changes, notificationTaskId) => {
      if (!notificationTaskId) return;
      return request.post('/notifications/aggregation/flush', { taskId: notificationTaskId });
    },
  });

  const taskStakeholderMentionUsers = useMemo(() => buildTaskStakeholderMentionUsers(task), [task]);
  const mentionableMembers = useMemo(
    () => mergeMentionUsers(teamMembers, taskStakeholderMentionUsers),
    [taskStakeholderMentionUsers, teamMembers]
  );

  useEffect(() => {
    const handleVisibilityChange = () => {
      setDocumentVisible(document.visibilityState === 'visible');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const handleMarkVisibleCommentsRead = useCallback(async (commentIds: string[]) => {
    if (!taskId || commentIds.length === 0) return;
    await markCommentsRead(taskId, commentIds);
  }, [markCommentsRead, taskId]);

  const readTrackingActive = Boolean(
    task &&
      !readOnly &&
      !commentsLoading &&
      isCommentReadTrackingActive({
        drawerVisible: visible,
        isMobile,
        activeTab,
        documentVisible,
      })
  );

  useCommentReadReceipts({
    active: readTrackingActive,
    comments,
    currentUserId: user?.id,
    containerRef: commentFeedRef,
    onMarkRead: handleMarkVisibleCommentsRead,
  });

  const resetCommentComposer = () => {
    setCommentDraft('');
    setCommentMentionUsers([]);
    setPendingCommentFiles([]);
    setPendingCommentAttachmentIds([]);
    commentRequestRef.current = null;
  };

  useEffect(() => {
    if (taskFromStore) {
      setDetailTask(taskFromStore);
    }
  }, [taskFromStore]);

  useEffect(() => {
    if (!visible || !taskId) {
      resetComments();
      resetCommentComposer();
      setDetailTask(null);
      setImagePreviewTarget(null);
      return;
    }

    let cancelled = false;

    setDetailTask(taskFromStore);
    resetCommentComposer();
    void Promise.resolve(
      fetchTaskDetail(taskId, isTrashDetail ? { source: 'trash' } : undefined)
    ).then((fetchedTask) => {
      if (!cancelled && fetchedTask) {
        setDetailTask(fetchedTask);
      }
    });
    fetchComments(taskId);

    return () => {
      cancelled = true;
    };
  }, [visible, taskId, fetchTaskDetail, fetchComments, isTrashDetail, resetComments]);

  useEffect(() => {
    const currentSignature = buildCommentDraftSignature(
      commentDraft,
      pendingCommentFiles,
      commentMentionUsers.map((member) => member.id)
    );

    if (commentRequestRef.current && commentRequestRef.current.signature !== currentSignature) {
      commentRequestRef.current = null;
    }
  }, [commentDraft, pendingCommentFiles, commentMentionUsers]);

  useEffect(() => {
    if (!visible || !task?.team_id || task.can_view_team_members !== true) {
      setTeamMembers([]);
      return;
    }

    let cancelled = false;
    request.get<User[]>(`/teams/${task.team_id}/members`)
      .then((members) => {
        if (!cancelled) {
          setTeamMembers(Array.isArray(members) ? members : []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTeamMembers([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [task?.can_view_team_members, task?.team_id, visible]);

  const canShareTask = Boolean(
    task &&
      !isDeletedTask &&
      user?.id &&
      (
        task.creator_id === user.id ||
        task.assignee_id === user.id ||
        (task.participant_ids || task.participants?.map((participant) => participant.id) || []).includes(user.id) ||
        isSuperAdmin
      )
  );
  const canMentionTaskExternalMembers = Boolean(
    task &&
      user?.id &&
      (
        task.creator_id === user.id ||
        task.assignee_id === user.id ||
        task.is_team_admin ||
        isSuperAdmin
      )
  );
  const isCanceledTask = task?.status === 'canceled';
  const canDeleteTask = Boolean(task && user?.id && task.creator_id === user.id && !isDeletedTask);
  const canRestoreTask = Boolean(taskId && isDeletedTask);
  const canAuditTaskProgress = Boolean(task && user?.id && task.creator_id === user.id && !isDeletedTask && !isCanceledTask);
  const isCommentingDisabled = effectiveReadOnly || isDeletedTask || isCanceledTask;
  const pendingAuditCount = comments.filter((c) => (c.message_type === 'progress' && c.audit_status === 'pending')).length;

  // 负责人视角：是否需要提示补充进展
  // 逻辑：找到最近一次周期触发时刻，检查该时刻之后是否有进展提交
  const showProgressPrompt = (() => {
    if (!task || !user?.id || isDeletedTask || readOnly) return false;
    if (isCanceledTask) return false;
    if (task.assignee_id !== user.id) return false;
    if (!task.periodic_interval_days || Number(task.periodic_interval_days) <= 0) return false;
    if (task.status === 'done' || task.status === 'delayed_done') return false;

    const myProgressComments = comments.filter(
      (c) => c.message_type === 'progress' && c.user_id === user.id
    );
    if (myProgressComments.length === 0) return true; // 从未提交过进展

    // 计算最近一次周期触发时刻
    const intervalDays = Number(task.periodic_interval_days);
    const [rh, rm] = (task.periodic_time || '09:00').split(':').map(Number);
    const now = new Date();

    // 今天的触发时刻
    const todayTrigger = new Date(now);
    todayTrigger.setHours(rh || 9, rm || 0, 0, 0);

    // 确定"最近一次触发时刻"：如果已过今天触发点则取今天的，否则取上一个周期的
    const lastTriggerPoint = now.getTime() >= todayTrigger.getTime()
      ? todayTrigger
      : new Date(todayTrigger.getTime() - intervalDays * 24 * 60 * 60 * 1000);

    // 检查最近一次触发时刻之后是否有进展评论
    const hasProgressAfterTrigger = myProgressComments.some(
      (c) => new Date(c.created_at).getTime() >= lastTriggerPoint.getTime()
    );
    return !hasProgressAfterTrigger;
  })();

  useEffect(() => {
    if (!visible || !taskId || !canShareTask || !isDingTalkEnvironment) {
      return;
    }
    void ensureDingTalkReady();
  }, [visible, taskId, canShareTask, isDingTalkEnvironment, ensureDingTalkReady]);

  const handleRequestClose = async () => {
    await notificationPreview.flush();
    resetCommentComposer();
    onClose();
  };

  const ensureCommentRequestId = () => {
    const signature = buildCommentDraftSignature(
      commentDraft,
      pendingCommentFiles,
      commentMentionUsers.map((member) => member.id)
    );

    if (!commentRequestRef.current || commentRequestRef.current.signature !== signature) {
      commentRequestRef.current = {
        signature,
        requestId: createRequestId('comment'),
      };
    }

    return commentRequestRef.current.requestId;
  };

  const handleCreateComment = async () => {
    if (!taskId || !commentDraft.trim() || isDeletedTask || isCanceledTask || commentSubmitInFlightRef.current) return;

    const requestId = ensureCommentRequestId();
    const activeMentionedUserIds = commentMentionUsers
      .filter((member) => commentDraft.includes(`@${member.name}`))
      .map((member) => member.id);
    commentSubmitInFlightRef.current = true;
    setSubmittingComment(true);
    try {
      const result = await createComment(taskId, {
        content: commentDraft.trim(),
        parent_id: null,
        attachment_ids: pendingCommentAttachmentIds,
        message_type: 'message',
        mentioned_user_ids: activeMentionedUserIds,
        request_id: requestId,
      });
      resetCommentComposer();
      if (result?.mentioned_users?.some((member) => member.auto_added_to_task)) {
        void fetchTaskDetail(taskId).then((fetchedTask) => {
          if (fetchedTask) {
            setDetailTask(fetchedTask);
          }
        });
      }
      if (result?.id) {
        setNewestCommentId(result.id);
        requestAnimationFrame(() => {
          if (typeof commentFeedRef.current?.scrollTo === 'function') {
            commentFeedRef.current.scrollTo({ top: commentFeedRef.current.scrollHeight, behavior: 'smooth' });
          }
        });
      }
    } catch {
      // Axios 拦截器已统一提示错误；这里吞掉异常，允许用户原地重试并复用同一个 request_id。
    } finally {
      commentSubmitInFlightRef.current = false;
      setSubmittingComment(false);
    }
  };

  const handleTaskAttachmentSelection = async (files: File[]) => {
    if (!taskId || !files.length || isCanceledTask) return;

    setUploadingTaskAttachments(true);
    try {
      await uploadTaskAttachments(taskId, files);
    } finally {
      setUploadingTaskAttachments(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!taskId || isDeletedTask) return;
    await deleteTaskAttachment(taskId, attachmentId);
  };

  const handleCommentAttachmentSelection = async (files: File[]) => {
    if (!files.length || !taskId || isCanceledTask) return;

    // 先存储 File 对象用于 UI 显示
    setPendingCommentFiles((current) => [...current, ...files]);
    setUploadingCommentAttachments(true);

    try {
      // 逐个上传附件
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('taskId', taskId);

        const response = await request.post<{ id: string }>('/attachments/comment-attachments', formData);
        if (response?.id) {
          setPendingCommentAttachmentIds((ids) => [...ids, response.id]);
        }
      }
    } finally {
      setUploadingCommentAttachments(false);
    }
  };

  const handleRemovePendingCommentAttachment = (indexToRemove: number) => {
    // 同时移除 File 对象和附件 ID
    setPendingCommentFiles((files) => files.filter((_, index) => index !== indexToRemove));
    setPendingCommentAttachmentIds((ids) => ids.filter((_, index) => index !== indexToRemove));
  };

  const handleRichTextImageUpload = useCallback(async (file: File) => {
    if (!taskId) {
      throw new Error('缺少任务 ID，无法上传图片');
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('taskId', taskId);

    const response = await request.post<{ url: string }>('/attachments/rich-text-images', formData);
    if (!response?.url) {
      throw new Error('图片上传失败');
    }

    return response.url;
  }, [taskId]);

  const handlePreviewImageAttachment = (attachment: Attachment, source: AttachmentSource) => {
    if (!isImageAttachment(attachment)) return;
    setImagePreviewTarget({ kind: 'attachment', attachment, source });
  };

  const handlePreviewRichTextImage = useCallback((image: MarkdownPreviewImage) => {
    setImagePreviewTarget({ kind: 'rich-text', image });
  }, []);

  const handleShareTask = async () => {
    if (!taskId) return;

    const result = await getTaskShareLink(taskId);
    if (!result) return;

    if (!window.dd?.biz?.util?.share) {
      // 非钉钉环境降级：直接复制链接到剪贴板
      try {
        await navigator.clipboard.writeText(result.url);
        toast.success('链接已复制到剪贴板');
      } catch {
        toast.error('复制链接失败，请手动复制');
      }
      return;
    }

    const runtimeReady = await ensureDingTalkReady();
    if (!runtimeReady) {
      toast.error(dingtalkRuntimeError || '钉钉分享暂不可用，请稍后重试');
      return;
    }

    // 钉钉环境：唤起原生分享面板后立即返回，不阻塞等待用户选人
    try {
      window.dd.biz.util.share({
        type: 1,
        url: result.url,
        title: result.title,
        content: result.content,
        onSuccess: () => {
          toast.success('已唤起钉钉分享');
        },
        onFail: (error) => {
          const message =
            (error as { errorMessage?: string; message?: string } | null | undefined)?.errorMessage ||
            (error as { message?: string } | null | undefined)?.message ||
            '钉钉分享失败，请稍后重试';
          toast.error(message);
          console.error('[share] dd.biz.util.share onFail', error);
        },
      });
    } catch (error) {
      const message =
        (error as { message?: string } | null | undefined)?.message ||
        '钉钉分享失败，请稍后重试';
      toast.error(message);
      console.error('[share] dd.biz.util.share exception', error);
    }
  };

  const handleDeleteTask = async () => {
    if (!taskId || !canDeleteTask) return;

    await deleteTask(taskId);
    handleRequestClose();
  };

  const handleRestoreTask = async () => {
    if (!taskId || !canRestoreTask) return;

    await restoreTask(taskId);
    handleRequestClose();
  };

  const handleNavigateToTask = (targetTaskId: string) => {
    setActiveTaskId(targetTaskId);
  };

  const handleUpdateSubtaskStatus = async (subtaskId: string, nextStatus: TaskStatus) => {
    await updateTaskStatus(subtaskId, nextStatus);
    if (taskId) {
      await fetchTaskDetail(taskId);
    }
  };

  const handleUpdateSubtask = async (subtaskId: string, patch: Partial<Task>) => {
    await updateTask(subtaskId, patch);
    if (taskId) {
      await fetchTaskDetail(taskId);
    }
  };

  const handleAuditComment = async (commentId: string, action: 'approve' | 'reject') => {
    if (!canAuditTaskProgress) return;
    try {
      await useCommentStore.getState().auditComment(commentId, { action });
      toast.success(action === 'approve' ? '已通过进展审核' : '已驳回进展审核');
    } catch {
      // 错误由 axios 拦截器统一处理
    }
  };

  const renderAttachmentList = (
    list: Attachment[],
    options?: {
      emptyText?: string;
      onDelete?: (attachmentId: string) => void;
      compact?: boolean;
      emptyVariant?: 'card' | 'inline';
      displayStyle?: 'card';
    }
  ) => {
    const attachmentStyle = options?.compact ? 'compact' : options?.displayStyle === 'card' ? 'card' : 'default';

    if (list.length === 0) {
      if (options?.emptyVariant === 'inline') {
        return <div className="text-[13px] text-muted-foreground">{options.emptyText || '暂无附件'}</div>;
      }

      return (
        <div className="flex items-center justify-center rounded-2xl border border-dashed border-(--tf-border) bg-(--tf-background) px-4 py-6 text-[13px] text-muted-foreground">
          {options?.emptyText || '暂无附件'}
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-2" data-attachment-collection-style={attachmentStyle}>
        {list.map((attachment) => {
          const filePresentation = getFileTypePresentation({
            fileName: attachment.original_name,
            mimeType: attachment.mime_type,
          });

          return (
            <div
              key={attachment.id}
              className={cn(
                "flex items-center justify-between gap-3 transition-colors",
                isMobile 
                  ? "bg-[#FAFAFA] rounded-lg px-3 py-3" // [MOBILE ADAPTATION] Notion 风格极简卡片
                  : "rounded-2xl border border-(--tf-border) bg-(--tf-background) px-3 py-3"
              )}
              data-attachment-style={attachmentStyle}
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <FileTypeIcon
                  fileName={attachment.original_name}
                  mimeType={attachment.mime_type}
                />
                {isImageAttachment(attachment) ? (
                  <button
                    type="button"
                    aria-label={`预览图片 ${attachment.original_name}`}
                    className="min-w-0 flex-1 rounded-md text-left outline-none transition-colors hover:text-(--tf-foreground) focus-visible:ring-2 focus-visible:ring-ring/40"
                    onClick={() => handlePreviewImageAttachment(attachment, 'comment')}
                  >
                    <div className="truncate text-[13px] font-medium text-(--tf-foreground)">{attachment.original_name}</div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {filePresentation.label} · {formatFileSize(attachment.file_size)}
                    </div>
                  </button>
                ) : (
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium text-(--tf-foreground)">{attachment.original_name}</div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {filePresentation.label} · {formatFileSize(attachment.file_size)}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-(--tf-foreground)"
                  aria-label="下载附件"
                  onClick={() => {
                    downloadAttachment(attachment.id, attachment.original_name, 'comment').catch(() => {
                      toast.error('附件下载失败，请重试');
                    });
                  }}
                >
                  <Download className="size-4" aria-hidden="true" />
                </button>
                {options?.onDelete ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:bg-red-50 hover:text-red-600"
                    aria-label="删除附件"
                    onClick={() => options.onDelete?.(attachment.id)}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderCommentItem = (comment: Comment) => {
    const messageType = resolveCommentMessageType(comment);
    const isProgressComment = messageType === 'progress';

    return (
      <div
        key={comment.id}
        className={cn(
          'flex flex-col gap-2.5 px-3.5 py-3.5 transition-all',
          isMobile 
            ? "bg-[#FAFAFA] rounded-lg" // [MOBILE ADAPTATION] 移动端极简
            : "rounded-2xl border border-(--tf-border) bg-(--tf-background)", 
          isProgressComment && (
            isMobile 
              ? "bg-[#F6F9F6]" 
              : cn(
                  'bg-[rgba(246,249,246,0.96)]',
                  comment.audit_status === 'approved'
                    ? 'border-green-500'
                    : comment.audit_status === 'pending' || comment.audit_status === 'rejected'
                      ? 'border-amber-400'
                      : 'border-[rgba(97,126,104,0.14)]'
                )
          )
        )}
        data-comment-item
        data-comment-style="card"
        data-comment-id={comment.id}
        data-message-type={messageType}
        data-new-comment={comment.id === newestCommentId ? '' : undefined}
      >
        <div className="flex items-start gap-2.5" data-comment-main>
          <CommentAvatar name={comment.user_name} avatar={comment.user_avatar} />
          <div className="min-w-0 flex-1" data-comment-body>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground" data-comment-meta>
              <span className="text-[13px] font-semibold text-(--tf-foreground)">{comment.user_name || '未命名成员'}</span>
              {isProgressComment ? (
                <>
                  <span className="inline-flex items-center rounded-md border border-[rgba(97,126,104,0.12)] bg-[rgba(97,126,104,0.08)] px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.04em] text-[#496454]">
                    进展
                  </span>
                  {comment.audit_status === 'pending' ? (
                    <span className="inline-flex items-center rounded-md bg-amber-100 text-amber-700 px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.04em]">待审核</span>
                  ) : comment.audit_status === 'approved' ? (
                    <span className="inline-flex items-center rounded-md bg-green-100 text-green-700 px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.04em]">已通过</span>
                  ) : comment.audit_status === 'rejected' ? (
                    <span className="inline-flex items-center rounded-md bg-red-100 text-red-700 px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.04em]">已驳回</span>
                  ) : null}

                  {/* 审核人交互入口 */}
                  {comment.audit_status === 'pending' && canAuditTaskProgress ? (
                    <div className="ml-2 flex items-center gap-1">
                      <button
                        type="button"
                        title="通过"
                        className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-50 text-green-600 transition-colors hover:bg-green-100"
                        onClick={() => void handleAuditComment(comment.id, 'approve')}
                      >
                        <Check className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        title="驳回"
                        className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-50 text-red-600 transition-colors hover:bg-red-100"
                        onClick={() => void handleAuditComment(comment.id, 'reject')}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : null}
                </>
              ) : null}
              {comment.department_name ? <span data-comment-department-block>{comment.department_name}</span> : null}
              <span>·</span>
              <span>{dayjs(comment.created_at).tz('Asia/Shanghai').format('MM-DD HH:mm')}</span>
            </div>
            <MarkdownContent
              markdown={comment.content}
              mentions={comment.mentioned_users}
              onImageClick={handlePreviewRichTextImage}
              className="mt-2"
            />
          </div>
        </div>
        {comment.attachments?.length ? (
          <div className="pl-11" data-comment-attachments>
            {renderAttachmentList(comment.attachments, { displayStyle: 'card' })}
          </div>
        ) : null}
        <div className="flex justify-end pl-11">
          <CommentReadStatusPopover comment={comment} onLoadStatus={fetchCommentReadStatus} />
        </div>
      </div>
    );
  };

  const inspectorActions = task ? (
    readOnly ? null : isDeletedTask ? (
      <Button type="button" variant="outline" size="sm" onClick={handleRestoreTask}>
        恢复任务
      </Button>
    ) : (
      <TaskOverviewActionController
        canShare={canShareTask}
        canDelete={canDeleteTask}
        onShare={handleShareTask}
        onDelete={handleDeleteTask}
      />
    )
  ) : null;

  const desktopActivityPanel = task ? (
    <section aria-label="任务讨论区" className="flex h-full min-h-0 flex-col">
      <div ref={commentFeedRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain bg-(--tf-background-soft) px-4 py-4">
        {commentsLoading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
          </div>
        ) : (task && !isRelated && !task.is_team_admin && !isSuperAdmin) ? (
          <div className="rounded-xl border border-dashed border-(--tf-border) bg-(--tf-background-soft) px-4 py-8 text-center text-[13px] text-muted-foreground">
            非任务参与者无法查看评论
          </div>
        ) : comments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-(--tf-border) bg-(--tf-background-soft) px-4 py-8 text-center text-[13px] text-muted-foreground">
            还没有活动记录，先写下第一条评论吧
          </div>
        ) : (
          comments.map(renderCommentItem)
        )}
      </div>

      {!isCommentingDisabled ? (
        <div className="shrink-0 bg-(--tf-background) px-4 py-4">
          <CommentInput
            value={commentDraft}
            onChange={setCommentDraft}
            submitting={submittingComment}
            onSubmit={handleCreateComment}
            task={task}
            teamMembers={mentionableMembers}
            canMentionTaskExternalMembers={canMentionTaskExternalMembers}
            mentionedUsers={commentMentionUsers}
            onMentionUsersChange={setCommentMentionUsers}
            pendingFiles={pendingCommentFiles}
            uploadingAttachments={uploadingCommentAttachments}
            onAttachFiles={handleCommentAttachmentSelection}
            onRemoveFile={handleRemovePendingCommentAttachment}
            onUploadImage={handleRichTextImageUpload}
          />
        </div>
      ) : null}
    </section>
  ) : null;

  const imagePreviewDialog = (
    <AttachmentImagePreviewDialog
      attachment={imagePreviewTarget?.kind === 'attachment' ? imagePreviewTarget.attachment : null}
      source={imagePreviewTarget?.kind === 'attachment' ? imagePreviewTarget.source : undefined}
      directImage={
        imagePreviewTarget?.kind === 'rich-text'
          ? {
              src: imagePreviewTarget.image.src,
              name: imagePreviewTarget.image.title || imagePreviewTarget.image.alt,
              alt: imagePreviewTarget.image.alt,
            }
          : null
      }
      open={Boolean(imagePreviewTarget)}
      onOpenChange={(open) => {
        if (!open) {
          setImagePreviewTarget(null);
        }
      }}
    />
  );

  // --- [MOBILE ONLY] 移动端 UI 分支逻辑 ---
  if (isMobile) {
    return (
      <>
        <Sheet open={visible} onOpenChange={(nextOpen) => { if (!nextOpen) void handleRequestClose(); }}>
          <SheetContent 
            side="bottom" 
            data-task-detail-floating-layer-root=""
            className="h-[92vh] overflow-hidden p-0 rounded-t-xl border-none shadow-none bg-white"
          >
            <div className="flex h-full min-h-0 flex-col bg-white">
              <SheetHeader className="sr-only">
                <SheetTitle>任务详情</SheetTitle>
              </SheetHeader>

              {/* 1. 灵动岛占位区 (Notification Island) */}
              <div className="fixed top-2 left-0 right-0 z-100 flex justify-center pointer-events-none px-4">
                <NotificationPreviewPanel
                  visible={notificationPreview.visible}
                  sent={notificationPreview.sent}
                  changes={notificationPreview.changes}
                  recipients={notificationPreview.recipients}
                  countdown={notificationPreview.countdown}
                  countdownMax={notificationPreview.countdownMax}
                  onSend={notificationPreview.send}
                  onDismiss={notificationPreview.dismiss}
                  isMobile={true} // 告诉组件进入灵动岛模式
                />
              </div>

              {!task ? (
                <div className="flex min-h-0 flex-1 flex-col gap-4 px-6 py-6">
                  <Skeleton className="h-9 w-2/5" />
                  <Skeleton className="h-28 w-full" />
                  <Skeleton className="h-40 w-full" />
                </div>
              ) : (
                <div className="flex flex-col flex-1 min-h-0 relative">
                  {/* 内容展示区 */}
                  <div className="flex-1 overflow-y-auto px-5 pt-6 pb-24">
                    {activeTab === 'info' ? (
                      <TaskDetailLeftPanel
                        task={task}
                        taskId={task.id}
                        isDeletedTask={isDeletedTask}
                        uploadingTaskAttachments={uploadingTaskAttachments}
                        headerActions={inspectorActions}
                        pendingAuditCount={canAuditTaskProgress ? pendingAuditCount : 0}
                        showProgressPrompt={showProgressPrompt}
                        onUpdateTask={async (patch) => {
                          if (!taskId || effectiveReadOnly || isDeletedTask) return;
                          await updateTask(taskId, patch);
                          if (task) {
                            for (const field of Object.keys(patch)) {
                              notificationPreview.trackChange(
                                field,
                                (task as unknown as Record<string, unknown>)[field],
                                (patch as Record<string, unknown>)[field]
                              );
                            }
                          }
                        }}
                        onUploadAttachments={effectiveReadOnly || isCanceledTask ? async () => {} : handleTaskAttachmentSelection}
                        onUploadRichTextImage={effectiveReadOnly ? undefined : handleRichTextImageUpload}
                        onDeleteAttachment={effectiveReadOnly ? async () => {} : handleDeleteAttachment}
                        onPreviewImageAttachment={(attachment) => handlePreviewImageAttachment(attachment, 'task')}
                        onPreviewRichTextImage={handlePreviewRichTextImage}
                        readOnly={effectiveReadOnly}
                        onNavigateToTask={handleNavigateToTask}
                        onUpdateSubtaskStatus={handleUpdateSubtaskStatus}
                        onOpenCreateSubtaskModal={() => setCreateSubtaskModalVisible(true)}
                        onUpdateSubtask={handleUpdateSubtask}
                      />
                    ) : (
                      <div className="flex flex-col gap-4 pb-20">
                        <div className="text-[15px] font-bold text-[#37352F] mb-1 px-1">讨论中心</div>
                        <div ref={commentFeedRef} className="flex flex-col gap-3">
                          {commentsLoading ? (
                            <Skeleton className="h-24 w-full rounded-lg" />
                          ) : (task && !isRelated && !task.is_team_admin && !isSuperAdmin) ? (
                            <div className="rounded-lg border border-dashed border-[#E9E9E7] px-4 py-8 text-center text-[13px] text-[#9B9A97] bg-[#FBFBFA]">
                              非任务参与者无法查看评论
                            </div>
                          ) : comments.length === 0 ? (
                            <div className="rounded-lg border border-dashed border-[#E9E9E7] px-4 py-12 text-center text-[13px] text-[#9B9A97]">
                              还没有讨论，开始交流吧
                            </div>
                          ) : (
                            comments.map(renderCommentItem)
                          )}
                        </div>
                        {!isCommentingDisabled && (
                          <div className="mt-4 pt-4 border-t border-[#E9E9E7] pb-10">
                             <CommentInput
                              value={commentDraft}
                              onChange={setCommentDraft}
                              submitting={submittingComment}
                              onSubmit={handleCreateComment}
                              task={task}
                              teamMembers={mentionableMembers}
                              canMentionTaskExternalMembers={canMentionTaskExternalMembers}
                              mentionedUsers={commentMentionUsers}
                              onMentionUsersChange={setCommentMentionUsers}
                              pendingFiles={pendingCommentFiles}
                              uploadingAttachments={uploadingCommentAttachments}
                              onAttachFiles={handleCommentAttachmentSelection}
                              onRemoveFile={handleRemovePendingCommentAttachment}
                              onUploadImage={handleRichTextImageUpload}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 移动端底部 Dock 栏 */}
                  <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E9E9E7] flex px-4 pb-safe h-16 items-center z-50">
                    <button
                      onClick={() => setActiveTab('info')}
                      className={cn(
                        "flex-1 flex flex-col items-center gap-1 py-1 transition-colors",
                        activeTab === 'info' ? "text-[#37352F]" : "text-[#9B9A97]"
                      )}
                    >
                      <LayoutGrid size={20} />
                      <span className="text-[10px] font-medium">任务详情</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('chat')}
                      className={cn(
                        "flex-1 flex flex-col items-center gap-1 py-1 transition-colors relative",
                        activeTab === 'chat' ? "text-[#37352F]" : "text-[#9B9A97]"
                      )}
                    >
                      <MessageCircle size={20} />
                      <span className="text-[10px] font-medium">讨论区</span>
                      {comments.length > 0 && activeTab !== 'chat' && (
                        <span className="absolute top-1 right-[35%] w-1.5 h-1.5 bg-[#2783DE] rounded-full" />
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>
        {imagePreviewDialog}
      </>
    );
  }

  return (
    <>
      <Dialog open={visible} onOpenChange={(nextOpen) => { if (!nextOpen) void handleRequestClose(); }}>
        <DialogContent
          data-task-detail-floating-layer-root=""
          data-testid="task-detail-dialog"
          className="h-[min(82vh,960px)] max-h-[calc(100vh-48px)] w-[calc(100vw-18vh)] max-w-[calc(100vw-48px)] gap-0 overflow-hidden rounded-2xl border-(--tf-border) bg-(--tf-background) p-0 shadow-2xl data-[state=open]:animate-[task-detail-dialog-in_260ms_cubic-bezier(0.16,1,0.3,1)_backwards] data-[state=closed]:animate-[task-detail-dialog-out_180ms_ease-in_forwards]"
        >
          <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-(--tf-border-soft) px-5">
            <DialogHeader className="min-w-0 flex-1 gap-0 text-left">
              <DialogTitle className="truncate text-[16px] font-semibold text-(--tf-foreground)">
                {task?.team_name || '任务详情'}
              </DialogTitle>
              <DialogDescription className="sr-only">
                在主内容区查看任务描述、附件与活动，在右侧属性栏编辑任务信息。
              </DialogDescription>
            </DialogHeader>
            <div className="flex shrink-0 items-center gap-2">
              <NotificationPreviewPanel
                visible={notificationPreview.visible}
                sent={notificationPreview.sent}
                changes={notificationPreview.changes}
                recipients={notificationPreview.recipients}
                countdown={notificationPreview.countdown}
                countdownMax={notificationPreview.countdownMax}
                onSend={notificationPreview.send}
                onDismiss={notificationPreview.dismiss}
              />
              {inspectorActions}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="关闭任务详情"
                onClick={() => { void handleRequestClose(); }}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-hidden">
            {!task ? (
              <div className="grid h-full grid-cols-[320px_minmax(300px,1fr)_340px] xl:grid-cols-[360px_minmax(340px,1fr)_380px] 2xl:grid-cols-[380px_minmax(360px,1fr)_420px]">
                <div className="space-y-4 border-r border-(--tf-border) bg-(--tf-background-soft) px-4 py-5">
                  <Skeleton className="h-44 w-full rounded-xl" />
                  <Skeleton className="h-32 w-full rounded-xl" />
                </div>
                <div className="space-y-5 bg-(--tf-background-soft) px-6 py-5">
                  <Skeleton className="h-9 w-2/5" />
                  <Skeleton className="h-28 w-full" />
                  <Skeleton className="h-40 w-full" />
                </div>
                <div className="space-y-4 border-l border-(--tf-border) bg-(--tf-background) px-4 py-5">
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-32 w-full" />
                </div>
              </div>
            ) : (
              <TaskDetailLeftPanel
                task={task}
                taskId={task.id}
                isDeletedTask={isDeletedTask}
                uploadingTaskAttachments={uploadingTaskAttachments}
                layout="dialog"
                activityPanel={desktopActivityPanel}
                pendingAuditCount={canAuditTaskProgress ? pendingAuditCount : 0}
                showProgressPrompt={showProgressPrompt}
                onUpdateTask={async (patch) => {
                  if (!taskId || effectiveReadOnly || isDeletedTask) return;
                  await updateTask(taskId, patch);
                  for (const field of Object.keys(patch)) {
                    notificationPreview.trackChange(
                      field,
                      (task as unknown as Record<string, unknown>)[field],
                      (patch as Record<string, unknown>)[field]
                    );
                  }
                }}
                onUploadAttachments={effectiveReadOnly || isCanceledTask ? async () => {} : handleTaskAttachmentSelection}
                onUploadRichTextImage={effectiveReadOnly ? undefined : handleRichTextImageUpload}
                onDeleteAttachment={effectiveReadOnly ? async () => {} : handleDeleteAttachment}
                onPreviewImageAttachment={(attachment) => handlePreviewImageAttachment(attachment, 'task')}
                onPreviewRichTextImage={handlePreviewRichTextImage}
                readOnly={effectiveReadOnly}
                onNavigateToTask={handleNavigateToTask}
                onUpdateSubtaskStatus={handleUpdateSubtaskStatus}
                onOpenCreateSubtaskModal={() => setCreateSubtaskModalVisible(true)}
                onUpdateSubtask={handleUpdateSubtask}
              />
            )}
          </div>

        </DialogContent>
      </Dialog>
      {createSubtaskModalVisible && task && (
        <CreateTaskModal
          visible={createSubtaskModalVisible}
          parentTaskId={task.id}
          parentTaskTitle={task.title}
          teamId={task.team_id || undefined}
          teamMode="optional"
          onClose={() => setCreateSubtaskModalVisible(false)}
          onSuccess={async () => {
            setCreateSubtaskModalVisible(false);
            if (taskId) {
              await fetchTaskDetail(taskId);
            }
          }}
        />
      )}
      {imagePreviewDialog}
    </>
  );
}
