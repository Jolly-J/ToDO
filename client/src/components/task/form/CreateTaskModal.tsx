/**
 * 组件名称：创建任务弹窗
 * 文件作用：承载任务创建时的统一表单录入。
 * 主要功能：支持全局任务创建时可选团队，也支持团队空间内锁定当前团队。
 */
import { useEffect, useRef, useState } from 'react';
import { useDebounce, useFormDraft } from '@/hooks';
import { toast } from 'sonner';
import { z } from 'zod';
import type { User } from '@/types';
import { useAuthStore, useTaskStore, useTeamStore } from '@/store';
import UserSelect from '@/components/shared/form/UserSelect';
import { DateRangePicker } from '@/components/ui/date-picker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { validateTaskMemberSelection } from '@/utils/task/validateTaskMemberSelection';
import { CompoundReminderSetting } from '@/components/task/shared/CompoundReminderSetting';
import AttachmentPickerTrigger from '@/components/shared/file/AttachmentPickerTrigger';
import { Progress } from '@/components/ui/progress';
import { Bell, BellOff, Paperclip, X, Loader2 } from 'lucide-react';
import request from '@/api/request';
import { useIsMobile } from '@/hooks/useIsMobile'; // [MOBILE ONLY]
import { ResponsiveDialog } from '@/components/ui/responsive-dialog'; // [MOBILE ONLY]
import { cn } from '@/lib/utils';
import styles from './CreateTaskModal.module.css';

type TeamMode = 'optional' | 'locked';

interface PendingAttachment {
  uid: string;          // 本地唯一 ID（用于列表 key 和删除）
  file: File;
  attachmentId?: string; // 上传成功后服务端返回的 ID
  progress: number;      // 0-100
  status: 'uploading' | 'done' | 'error';
  errorMsg?: string;
}

interface CreateTaskModalProps {
  teamId?: string;
  initialTeamId?: string;
  teamMode?: TeamMode;
  parentTaskId?: string;
  parentTaskTitle?: string;
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const priorityOptions = [
  { label: '紧急', value: 'urgent' },
  { label: '高', value: 'high' },
  { label: '中', value: 'medium' },
  { label: '低', value: 'low' },
];

const CreateTaskSchema = z.object({
  team_id: z.string().optional().nullable(),
  title: z.string().min(1, '请输入任务标题').max(100, '任务标题最多100字符'),
  description: z.string().optional(),
  priority: z.enum(['urgent', 'high', 'medium', 'low']),
  assignee_id: z.string().optional(),
  participant_ids: z.array(z.string()),
  start_date: z.string().nullable(),
  due_date: z.string().nullable(),
  reminder_rule: z.enum(['due_15m', 'due_30m', 'due_1h', 'due_3h', 'due_1d', 'due_3d', 'none']).optional().nullable(),
  periodic_interval_days: z.number().optional().nullable(),
  periodic_time: z.string().optional().nullable(),
});

type FormState = z.infer<typeof CreateTaskSchema>;

const defaultForm = (initialTeamId = '', teamMode: TeamMode = 'optional', teamId = '', defaultAssigneeId = '', parentTaskId = ''): FormState => {
  const chosenTeamId = parentTaskId ? (teamId || '') : (teamMode === 'locked' ? teamId || '' : initialTeamId || '');
  return {
    team_id: chosenTeamId,
    title: '',
    description: '',
    priority: 'medium',
    assignee_id: chosenTeamId ? '' : defaultAssigneeId,
    participant_ids: [],
    start_date: null,
    due_date: null,
    reminder_rule: null,
    periodic_interval_days: null,
    periodic_time: null,
  };
};

export default function CreateTaskModal({
  teamId = '',
  initialTeamId = '',
  teamMode = 'optional',
  parentTaskId,
  parentTaskTitle,
  visible,
  onClose,
  onSuccess,
}: CreateTaskModalProps) {
  const isMobile = useIsMobile(); // [MOBILE ONLY]
  const isSubtask = Boolean(parentTaskId);
  const currentUser = useAuthStore((state) => state.user);
  const currentUserId = currentUser?.id || '';
  const { createTask } = useTaskStore();
  const { fetchMembers, fetchTeams, teams } = useTeamStore();
  const [loading, setLoading] = useState(false);
  const [membersLoading, setMembersLoading] = useState(false);
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [taskScope, setTaskScope] = useState<'personal' | 'team'>(() => {
    if (isSubtask) return teamId ? 'team' : 'personal';
    if (teamMode === 'locked') return 'team';
    return initialTeamId ? 'team' : 'personal';
  });
  const [form, setForm] = useState<FormState>(() => defaultForm(initialTeamId, teamMode, teamId, currentUserId, parentTaskId));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [reminderOpen, setReminderOpen] = useState(false);
  const [userSelectOpen, setUserSelectOpen] = useState(false);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const hasRestoredRef = useRef(false);

  // 草稿 key：子任务按 parentTaskId 隔离，locked 模式按 teamId 隔离，optional 模式用 global
  const draftKey = isSubtask
    ? `create-subtask-draft:${parentTaskId}`
    : (teamMode === 'locked' ? `create-task-draft:${teamId}` : 'create-task-draft:global');
  const { draft, saveDraft, clearDraft } = useFormDraft<FormState>(draftKey);

  const effectiveTeamId = taskScope === 'personal'
    ? ''
    : (isSubtask ? (form.team_id || teamId || '') : (teamMode === 'locked' ? teamId : (form.team_id || '')));

  useEffect(() => {
    if (!visible) {
      hasRestoredRef.current = false;
      return;
    }
    if (hasRestoredRef.current) return;
    hasRestoredRef.current = true;
    fetchTeams();
    const initialForm = draft ?? defaultForm(initialTeamId, teamMode, teamId, currentUserId, parentTaskId);
    setForm(initialForm);
    setTaskScope(teamMode === 'locked' || Boolean(initialForm.team_id) ? 'team' : 'personal');
    setErrors({});
    setAttachments([]);
    // 仅在弹窗首次打开时恢复草稿，故意忽略 fetchTeams/initialTeamId/teamMode/teamId 等 props 依赖
  }, [visible, draft]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!effectiveTeamId) {
      setTeamMembers([]);
      return;
    }
    setMembersLoading(true);
    fetchMembers(effectiveTeamId)
      .then((members) => setTeamMembers(members as User[]))
      .catch(() => setTeamMembers([]))
      .finally(() => setMembersLoading(false));
  }, [effectiveTeamId, fetchMembers]);

  // form 变化时 debounce 写入草稿，只在弹窗打开时写入
  const debouncedForm = useDebounce(form, 500);
  useEffect(() => {
    if (!visible) return;
    saveDraft(debouncedForm);
  // saveDraft 由 useCallback 保证稳定引用，加入依赖数组无副作用，此处省略仅为简洁
  }, [debouncedForm, visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFileSelect = (files: File[]) => {
    if (!files.length) return;
    files.forEach((file) => {
      const uid = `${Date.now()}-${Math.random()}`;
      setAttachments((prev) => [...prev, { uid, file, progress: 0, status: 'uploading' }]);

      const formData = new FormData();
      formData.append('file', file);

      void (async () => {
        try {
          const res = await request.post<{ id: string }>(
            '/attachments/task-attachments/pending',
            formData,
            {
              onUploadProgress: (e) => {
                const pct = e.total ? Math.round((e.loaded / e.total) * 100) : 0;
                setAttachments((prev) =>
                  prev.map((a) => (a.uid === uid ? { ...a, progress: pct } : a))
                );
              },
            }
          );
          const id = res?.id;
          setAttachments((prev) =>
            prev.map((a) => (a.uid === uid ? { ...a, status: 'done', progress: 100, attachmentId: id } : a))
          );
        } catch {
          setAttachments((prev) =>
            prev.map((a) => (a.uid === uid ? { ...a, status: 'error', errorMsg: '上传失败' } : a))
          );
        }
      })();
    });
  };

  const handleRemoveAttachment = (uid: string) => {
    setAttachments((prev) => prev.filter((a) => a.uid !== uid));
  };

  const validate = () => {
    const dataToValidate = { ...form, team_id: effectiveTeamId, title: form.title.trim() };
    const result = CreateTaskSchema.safeParse(dataToValidate);
    const errs: Partial<Record<keyof FormState, string>> = {};
    if (!result.success) {
      result.error.issues.forEach((err: z.ZodIssue) => {
        const key = err.path[0];
        if (typeof key === 'string') errs[key as keyof FormState] = err.message;
      });
    }
    if ((teamMode === 'locked' || (teamMode === 'optional' && taskScope === 'team')) && !effectiveTeamId) {
      errs.team_id = '团队任务必须选择所属团队';
    }
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return false;
    }
    setErrors({});
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    if (effectiveTeamId) {
      const memberValidation = validateTaskMemberSelection({
        memberIds: teamMembers.map((member) => member.id),
        assigneeId: form.assignee_id || undefined,
        participantIds: form.participant_ids,
      });
      if (memberValidation.invalidAssigneeId || memberValidation.invalidParticipantIds.length > 0) {
        toast.error('已绑定团队时只能选择该团队成员');
        return;
      }
    }

    setLoading(true);
    try {
      const doneAttachmentIds = attachments
        .filter((a) => a.status === 'done' && a.attachmentId)
        .map((a) => a.attachmentId as string);

      await createTask({
        team_id: effectiveTeamId || undefined,
        parent_id: parentTaskId || undefined,
        task_scope: taskScope,
        title: form.title.trim(),
        description: form.description?.trim() || undefined,
        priority: form.priority,
        assignee_id: form.assignee_id || (!effectiveTeamId ? currentUserId : undefined),
        participant_ids: form.participant_ids,
        start_date: form.start_date || undefined,
        due_date: form.due_date || undefined,
        reminder_rule: form.reminder_rule || undefined,
        periodic_interval_days: form.periodic_interval_days || undefined,
        periodic_time: form.periodic_time || undefined,
        attachment_ids: doneAttachmentIds.length > 0 ? doneAttachmentIds : undefined,
      });
      clearDraft();
      toast.success(isSubtask ? '子任务创建成功' : '任务创建成功');
      onSuccess();
    } catch {
      // toast 已在 request 拦截器处理
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setErrors({});
    setAttachments([]);
    onClose();
  };

  const assigneeExcludeIds = form.participant_ids;
  const participantExcludeIds = form.assignee_id ? [form.assignee_id] : [];

  return (
    <ResponsiveDialog 
      open={visible} 
      onOpenChange={(open) => { if (!open) handleClose(); }}
      title={isSubtask ? '创建子任务' : '创建任务'}
    >
      <div 
        ref={dialogRef} 
        className={cn(
          "flex flex-col min-h-0",
          isMobile ? "flex-1" : "max-h-[85dvh]"
        )}
      >
        <div className={`min-h-0 flex-1 ${userSelectOpen ? 'overflow-y-hidden' : 'overflow-y-auto'}`}>
          <div className={cn(
            styles.formBody, 
            isMobile ? "px-5 pt-2 pb-20" : "px-6 pb-8" // [MOBILE ADAPTATION] 修复桌面端 (px-6) 和移动端 (pb-20 为底部固定按钮留出空间) 的内边距分支
          )}>
            {isSubtask && parentTaskTitle && (
              <div className="mb-4 flex items-center gap-1.5 rounded-lg border border-[#E9E9E7] bg-[#FBFBFA] px-3 py-2 text-xs text-[#787774]">
                <span>父级任务：</span>
                <span className="font-semibold text-[#37352F] truncate">{parentTaskTitle}</span>
              </div>
            )}

            {(teamMode === 'optional' || isSubtask) && (
              <div className={styles.formField}>
                <label className="text-sm font-medium">任务归属</label>
                <div className="flex items-center p-1 bg-[#F3F4F6] rounded-lg w-full">
                  <button
                    type="button"
                    onClick={() => {
                      setTaskScope('personal');
                      setForm((f) => ({
                        ...f,
                        team_id: '',
                        assignee_id: currentUserId,
                        participant_ids: [],
                      }));
                      setErrors((prev) => ({ ...prev, team_id: undefined }));
                    }}
                    className={cn(
                      "flex-1 py-1.5 text-xs font-medium rounded-md transition-all text-center cursor-pointer",
                      taskScope === 'personal'
                        ? "bg-white text-[#37352F] shadow-xs font-semibold"
                        : "text-[#787774] hover:text-[#37352F]"
                    )}
                  >
                    个人任务
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTaskScope('team');
                      const defaultTeam = (isSubtask && teamId) ? teamId : (form.team_id || teams[0]?.id || '');
                      setForm((f) => ({
                        ...f,
                        team_id: defaultTeam,
                        assignee_id: '',
                        participant_ids: [],
                      }));
                    }}
                    className={cn(
                      "flex-1 py-1.5 text-xs font-medium rounded-md transition-all text-center cursor-pointer",
                      taskScope === 'team'
                        ? "bg-white text-[#37352F] shadow-xs font-semibold"
                        : "text-[#787774] hover:text-[#37352F]"
                    )}
                  >
                    团队任务
                  </button>
                </div>
              </div>
            )}

            {taskScope === 'team' && (
              isSubtask && teamId ? (
                <div className={styles.formField}>
                  <label className="text-sm font-medium">所属团队</label>
                  <div className="flex h-9 w-full items-center rounded-md border border-[#E9E9E7] bg-[#F9FAFB] px-3 text-xs text-[#37352F]">
                    {teams.find((t) => t.id === teamId)?.name || '当前所属团队'}
                  </div>
                </div>
              ) : teamMode === 'optional' ? (
                <div className={styles.formField}>
                  <label className="text-sm font-medium">所属团队 <span className="text-destructive">*</span></label>
                  <Select
                    value={form.team_id || undefined}
                    onValueChange={(v) => {
                      setForm((f) => ({
                        ...f,
                        team_id: v,
                        assignee_id: '',
                        participant_ids: [],
                      }));
                      setErrors((prev) => ({ ...prev, team_id: undefined }));
                    }}
                  >
                    <SelectTrigger className={cn(isMobile && "bg-[#F9FAFB] border-none shadow-none")}>
                      <SelectValue placeholder="请选择所属团队" />
                    </SelectTrigger>
                    <SelectContent>
                      {teams.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.team_id && <p className="text-xs text-destructive">{errors.team_id}</p>}
                </div>
              ) : null
            )}

            <div className={styles.formField}>
              <label className="text-sm font-medium">任务标题 <span className="text-destructive">*</span></label>
              <Input
                placeholder="请输入任务标题"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className={cn(isMobile && "bg-[#F9FAFB] border-none shadow-none")}
              />
              {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
            </div>

            <div className={styles.formField}>
              <label className="text-sm font-medium">任务描述</label>
              <Input
                placeholder="请输入任务描述（选填）"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className={cn(isMobile && "bg-[#F9FAFB] border-none shadow-none")}
              />
            </div>

            <div className={styles.formField}>
              <label className="text-sm font-medium">优先级</label>
              <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v as FormState['priority'] }))}>
                <SelectTrigger className={cn(isMobile && "bg-[#F9FAFB] border-none shadow-none")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {priorityOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className={styles.formField}>
              <label className="text-sm font-medium">负责人</label>
              <UserSelect
                mode="single"
                value={form.assignee_id}
                onChange={(v) => setForm((f) => ({ ...f, assignee_id: (v as string) ?? '' }))}
                users={effectiveTeamId ? teamMembers : undefined}
                excludeIds={assigneeExcludeIds}
                placeholder={effectiveTeamId && membersLoading ? '加载中…' : '请选择负责人'}
                disabled={effectiveTeamId ? membersLoading : false}
                onOpenChange={setUserSelectOpen}
                portalContainer={() => dialogRef.current}
              />
            </div>

            <div className={styles.formField}>
              <label className="text-sm font-medium">参与人</label>
              <UserSelect
                mode="multiple"
                value={form.participant_ids}
                onChange={(v) => setForm((f) => ({ ...f, participant_ids: (v as string[]) ?? [] }))}
                users={effectiveTeamId ? teamMembers : undefined}
                excludeIds={participantExcludeIds}
                placeholder={effectiveTeamId && membersLoading ? '加载中…' : '请选择参与人'}
                disabled={effectiveTeamId ? membersLoading : false}
                onOpenChange={setUserSelectOpen}
                portalContainer={() => dialogRef.current}
              />
            </div>

          <div className={styles.formField}>
            <label className="text-sm font-medium">时间与提醒</label>
            <div className="flex items-center gap-2 min-w-0 w-full">
              <div className="flex-1 min-w-0 max-w-full">
                <DateRangePicker
                  startDate={form.start_date}
                  endDate={form.due_date}
                  portalContainer={null}
                  onChange={({ startDate, endDate }) =>
                    setForm((f) => ({ ...f, start_date: startDate, due_date: endDate }))
                  }
                />
              </div>

              
              {/* [MOBILE ADAPTATION] 提醒设置逻辑分支 */}
              {isMobile ? (
                <ResponsiveDialog
                  open={reminderOpen}
                  onOpenChange={setReminderOpen}
                  title="设置提醒"
                  trigger={
                    <button
                      type="button"
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#F9FAFB] text-(--tf-foreground)"
                      aria-label="设置提醒"
                    >
                      {form.reminder_rule || form.periodic_interval_days ? <Bell className="h-4 w-4 text-amber-500" /> : <BellOff className="h-4 w-4 text-[#9B9A97]" />}
                    </button>
                  }
                >
                  <CompoundReminderSetting
                    reminderRule={form.reminder_rule}
                    onReminderRuleChange={(r) => setForm((f) => ({ ...f, reminder_rule: r }))}
                    periodicIntervalDays={form.periodic_interval_days}
                    periodicTime={form.periodic_time}
                    onPeriodicChange={(interval, time) => setForm((f) => ({ ...f, periodic_interval_days: interval, periodic_time: time }))}
                    onClose={() => setReminderOpen(false)}
                  />
                </ResponsiveDialog>
              ) : (
                <Popover open={reminderOpen} onOpenChange={setReminderOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-(--tf-border) bg-(--tf-card) transition-colors hover:border-primary/50 text-(--tf-foreground)"
                      aria-label="设置提醒"
                    >
                      {form.reminder_rule || form.periodic_interval_days ? <Bell className="h-4 w-4 text-amber-500" /> : <BellOff className="h-4 w-4 text-[#9B9A97]" />}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 z-1600" align="end" side="bottom">
                    <CompoundReminderSetting
                      reminderRule={form.reminder_rule}
                      onReminderRuleChange={(r) => setForm((f) => ({ ...f, reminder_rule: r }))}
                      periodicIntervalDays={form.periodic_interval_days}
                      periodicTime={form.periodic_time}
                      onPeriodicChange={(interval, time) => setForm((f) => ({ ...f, periodic_interval_days: interval, periodic_time: time }))}
                      onClose={() => setReminderOpen(false)}
                    />
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </div>

            <div className={styles.formField}>
              <label className="text-sm font-medium">附件</label>
              <div className="flex flex-col gap-2">
                <AttachmentPickerTrigger
                  testId="create-task-attachment"
                  buttonText="选择文件"
                  icon={<Paperclip className="h-4 w-4" />}
                  multiple
                  disabled={attachments.length >= 5}
                  onSelect={handleFileSelect}
                  className={cn(isMobile && "bg-[#F9FAFB] border-none shadow-none")}
                />
                {attachments.length > 0 && (
                  <ul className="flex flex-col gap-1.5">
                    {attachments.map((a) => (
                      <li key={a.uid} className="flex items-center gap-2 rounded-lg border border-border bg-accent/40 px-3 py-2 text-sm">
                        {a.status === 'uploading' ? (
                          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[#9B9A97]" />
                        ) : (
                          <Paperclip className="h-3.5 w-3.5 shrink-0 text-[#9B9A97]" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-medium">{a.file.name}</div>
                          {a.status === 'uploading' && (
                            <Progress value={a.progress} className="mt-1 h-1" />
                          )}
                          {a.status === 'error' && (
                            <div className="text-xs text-destructive">{a.errorMsg}</div>
                          )}
                        </div>
                        <button
                          type="button"
                          className="shrink-0 rounded-sm opacity-50 hover:opacity-100"
                          onClick={() => handleRemoveAttachment(a.uid)}
                          aria-label="移除附件"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 底部按钮区 */}
        {!isMobile ? (
          <div className="flex justify-end gap-3 px-6 py-4 border-t bg-white shrink-0">
            <Button variant="outline" onClick={handleClose} disabled={loading}>取消</Button>
            <Button onClick={() => void handleSubmit()} disabled={loading}>
              {loading ? '创建中…' : (isSubtask ? '创建子任务' : '创建任务')}
            </Button>
          </div>
        ) : (
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t pb-safe z-50">
            <Button className="w-full h-11 rounded-md font-bold shadow-none" onClick={() => void handleSubmit()} disabled={loading}>
              {loading ? <Loader2 className="animate-spin mr-2" /> : null}
              {loading ? '提交中...' : (isSubtask ? '创建子任务' : '创建任务')}
            </Button>
          </div>
        )}
      </div>
    </ResponsiveDialog>
  );
}
