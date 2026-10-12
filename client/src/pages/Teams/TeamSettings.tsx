/**
 * 页面名称：团队设置
 * 文件作用：单卡片内以分隔线划分基础信息、成员权限与危险操作三个区域。
 * 主要功能：紧凑 key-value 展示团队资料，内联编辑，成员列表与解散团队统一收口。
 */
import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, Plus, LoaderCircle, Clock, Info, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore, useTeamStore } from '@/store';
import { useTourStore } from '@/components/onboarding/tourStore';
import { useUnsavedChangesGuard } from '@/hooks';
import UserSelect from '@/components/shared/form/UserSelect';
import { teamLevelLabels } from './teamMeta';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type {
  Team,
  TeamDissolveCheck,
  TeamMemberRole,
  TeamMemberTaskCheck,
  TeamMemberTaskVisibilityScope,
  TeamGroupReminderConfig,
  TeamGroupReminderRule,
  SaveTeamGroupReminderPayload,
} from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { pageHeaderStyles } from '@/pages/pageHeaderStyles';
import styles from './TeamSettings.module.css';

const memberRoleLabels: Record<string, string> = {
  owner: '创建者',
  admin: '管理员',
  member: '成员',
};

const memberRoleBadgeVariant: Record<string, 'default' | 'secondary' | 'outline'> = {
  owner: 'default',
  admin: 'secondary',
  member: 'outline',
};

const memberRoleWeight: Record<string, number> = {
  owner: 0,
  admin: 1,
  member: 2,
};

const memberTaskVisibilityLabels: Record<TeamMemberTaskVisibilityScope, string> = {
  all: '所有',
  self: '仅自己',
};

const DEFAULT_REMINDER_HEADING = '请各位负责人关注未完成任务：';
const DEFAULT_REMINDER_SEND_TIME = '09:30';
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0'));
const BASE_MINUTE_OPTIONS = Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, '0'));

const defaultReminderConfig: TeamGroupReminderConfig = {
  webhook_url: '',
  secret: '',
  enabled: false,
};

const defaultReminderRule: TeamGroupReminderRule & { task_ids: string[] } = {
  enabled: false,
  send_time: DEFAULT_REMINDER_SEND_TIME,
  workday_only: true,
  heading: DEFAULT_REMINDER_HEADING,
  task_ids: [],
};

function splitReminderTime(value?: string | null) {
  const text = String(value || DEFAULT_REMINDER_SEND_TIME);
  const match = text.match(/^(\d{2}):(\d{2})$/);
  if (!match) {
    return { hour: '09', minute: '30' };
  }
  return { hour: match[1], minute: match[2] };
}

function getMinuteOptions(currentMinute: string) {
  return BASE_MINUTE_OPTIONS.includes(currentMinute)
    ? BASE_MINUTE_OPTIONS
    : [...BASE_MINUTE_OPTIONS, currentMinute].sort();
}

function ReminderTimePicker({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const { hour, minute } = splitReminderTime(value);
  const minuteOptions = getMinuteOptions(minute);

  const updateTime = (next: { hour?: string; minute?: string }) => {
    const nextHour = next.hour ?? hour;
    const nextMinute = next.minute ?? minute;
    onChange(`${nextHour}:${nextMinute}`);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          aria-label={`选择发送时间 ${value}`}
          className={styles.reminderTimeTrigger}
        >
          <Clock data-icon="inline-start" />
          <span>{value}</span>
          <span className="text-xs text-muted-foreground">北京时间</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">选择发送时间</p>
            <Badge variant="outline">{value}</Badge>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex min-w-0 flex-col gap-2">
              <p className="text-xs text-muted-foreground">小时</p>
              <ScrollArea className="h-52 rounded-md border">
                <div className="grid grid-cols-2 gap-1 p-1">
                  {HOUR_OPTIONS.map((option) => (
                    <Button
                      key={option}
                      type="button"
                      variant={hour === option ? 'default' : 'ghost'}
                      size="sm"
                      aria-pressed={hour === option}
                      onClick={() => updateTime({ hour: option })}
                    >
                      {option}时
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </div>
            <div className="flex min-w-0 flex-col gap-2">
              <p className="text-xs text-muted-foreground">分钟</p>
              <ScrollArea className="h-52 rounded-md border">
                <div className="grid grid-cols-2 gap-1 p-1">
                  {minuteOptions.map((option) => (
                    <Button
                      key={option}
                      type="button"
                      variant={minute === option ? 'default' : 'ghost'}
                      size="sm"
                      aria-pressed={minute === option}
                      onClick={() => updateTime({ minute: option })}
                    >
                      {option}分
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function getMemberTaskVisibilityScope(scope?: string): TeamMemberTaskVisibilityScope {
  return scope === 'self' ? 'self' : 'all';
}

function formatJoinedAt(joinedAt?: string) {
  if (!joinedAt) return '-';
  const date = new Date(joinedAt);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function formatDateTime(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatReminderDueDate(value?: string | null) {
  if (!value) return '未设置';
  const dateOnly = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateOnly) {
    return `${dateOnly[1]}/${dateOnly[2]}/${dateOnly[3]}`;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

interface FormState {
  name: string;
  level: Team['level'] | '';
  description: string;
}

export default function TeamSettings() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    currentTeam,
    members,
    fetchTeamDetail,
    fetchMembers,
    updateTeam,
    addMembers,
    updateMemberRole,
    updateMemberTaskVisibilityScope,
    batchUpdateTaskVisibilityScope,
    checkMemberRemoval,
    removeMember,
    checkMyExit,
    exitTeam,
    checkTeamDissolve,
    dissolveTeam,
    groupReminder,
    groupReminderTaskPool,
    fetchGroupReminder,
    fetchGroupReminderTaskPool,
    saveGroupReminder,
    testSendGroupReminder,
    syncGroupReminderCalendar,
  } = useTeamStore();
  const { user } = useAuthStore();

  // 受控表单 state
  const [form, setForm] = useState<FormState>({ name: '', level: '', description: '' });
  const [isEditing, setIsEditing] = useState(false);
  const [snapshot, setSnapshot] = useState<FormState | null>(null);
  const isDirty = isEditing && JSON.stringify(form) !== JSON.stringify(snapshot);

  // 用 useEditableFormMode 的简化版（不依赖 antd Form）
  const enterEdit = () => {
    setSnapshot({ ...form });
    setIsEditing(true);
  };
  const cancelEdit = () => {
    if (snapshot) setForm({ ...snapshot });
    setIsEditing(false);
  };
  const finishEdit = () => {
    setSnapshot(null);
    setIsEditing(false);
  };

  const { confirmIfNeeded } = useUnsavedChangesGuard({
    enabled: isDirty,
    confirmTitle: '基础资料有未保存的修改',
  });

  // 批量调整团队任务可见范围
  const [batchVisibilityDialogOpen, setBatchVisibilityDialogOpen] = useState(false);
  const [targetBatchScope, setTargetBatchScope] = useState<TeamMemberTaskVisibilityScope | null>(null);
  const [batchVisibilityLoading, setBatchVisibilityLoading] = useState(false);
  const [isPersonalizedUnlocked, setIsPersonalizedUnlocked] = useState(false);

  // 成员管理 sheet
  const [addMemberSheetOpen, setAddMemberSheetOpen] = useState(false);
  const [addMemberIds, setAddMemberIds] = useState<string[]>([]);
  const [addMemberRole, setAddMemberRole] = useState<TeamMemberRole>('member');
  const [addMemberLoading, setAddMemberLoading] = useState(false);

  // 移除成员 dialog
  const [removeCheck, setRemoveCheck] = useState<TeamMemberTaskCheck | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [removeReassignId, setRemoveReassignId] = useState<string>('');
  const [removeLoading, setRemoveLoading] = useState(false);

  // 退出团队 dialog
  const [exitCheck, setExitCheck] = useState<TeamMemberTaskCheck | null>(null);
  const [exitReassignId, setExitReassignId] = useState<string>('');
  const [exitLoading, setExitLoading] = useState(false);

  // 解散团队 dialog
  const [dissolveCheck, setDissolveCheck] = useState<TeamDissolveCheck | null>(null);
  const [dissolveConfirmName, setDissolveConfirmName] = useState('');
  const [dissolveLoading, setDissolveLoading] = useState(false);

  // 保存基础信息 loading
  const [saveLoading, setSaveLoading] = useState(false);

  // 群聊机器人提醒
  const [reminderConfig, setReminderConfig] = useState<TeamGroupReminderConfig>(defaultReminderConfig);
  const [reminderRule, setReminderRule] = useState<TeamGroupReminderRule & { task_ids: string[] }>(defaultReminderRule);
  const [reminderSaveLoading, setReminderSaveLoading] = useState(false);
  const [reminderTestLoading, setReminderTestLoading] = useState(false);
  const [calendarSyncLoading, setCalendarSyncLoading] = useState(false);
  const [headingDialogOpen, setHeadingDialogOpen] = useState(false);
  const [headingDraft, setHeadingDraft] = useState(DEFAULT_REMINDER_HEADING);

  useEffect(() => {
    if (id) {
      fetchTeamDetail(id);
      fetchMembers(id);
      fetchGroupReminder(id);
      fetchGroupReminderTaskPool(id);
    }
  }, [id, fetchTeamDetail, fetchMembers, fetchGroupReminder, fetchGroupReminderTaskPool]);

  useEffect(() => {
    if (currentTeam) {
      setForm({
        name: currentTeam.name ?? '',
        level: currentTeam.level ?? '',
        description: currentTeam.description ?? '',
      });
    }
  }, [currentTeam]);

  useEffect(() => {
    setReminderConfig({
      ...defaultReminderConfig,
      ...(groupReminder?.config ?? {}),
      secret: groupReminder?.config?.secret ?? '',
    });
    setReminderRule({
      ...defaultReminderRule,
      ...(groupReminder?.rule ?? {}),
      task_ids: groupReminder?.selectedTaskIds ?? groupReminder?.rule?.task_ids ?? [],
    });
  }, [groupReminder]);

  const isOwner = currentTeam?.owner_id === user?.id;
  const isAdmin = members.some((m) => m.id === user?.id && (m.role_id === 'owner' || m.role_id === 'admin'));

  const sortedMembers = useMemo(
    () => [...members].sort((a, b) => (memberRoleWeight[a.role_id] ?? 9) - (memberRoleWeight[b.role_id] ?? 9)),
    [members]
  );

  const regularMembers = useMemo(() => members.filter((m) => m.role_id === 'member'), [members]);
  const teamVisibilityScopeSummary = useMemo(() => {
    if (regularMembers.length === 0) return 'all';
    const allCount = regularMembers.filter((m) => getMemberTaskVisibilityScope(m.task_visibility_scope) === 'all').length;
    if (allCount === regularMembers.length) return 'all';
    const selfCount = regularMembers.filter((m) => getMemberTaskVisibilityScope(m.task_visibility_scope) === 'self').length;
    if (selfCount === regularMembers.length) return 'self';
    return 'mixed';
  }, [regularMembers]);

  // 是否处于个性化微调模式：若成员设置本身不一致，或管理员主动开启个性化模式
  const isPersonalized = isPersonalizedUnlocked || teamVisibilityScopeSummary === 'mixed';
  const effectiveScopeValue = isPersonalized ? 'mixed' : teamVisibilityScopeSummary;

  const handleRequestBatchVisibilityScopeChange = (nextScope: string) => {
    if (!isAdmin) return;
    if (nextScope === 'mixed') {
      setIsPersonalizedUnlocked(true);
      toast.info('已开启个性化单独设置，您可在下方表格中针对每位成员调整可见范围');
      return;
    }
    setTargetBatchScope(nextScope as TeamMemberTaskVisibilityScope);
    setBatchVisibilityDialogOpen(true);
  };

  const handleConfirmBatchVisibilityScope = async () => {
    if (!id || !targetBatchScope) return;
    setBatchVisibilityLoading(true);
    try {
      await batchUpdateTaskVisibilityScope(id, targetBatchScope);
      setIsPersonalizedUnlocked(false);
      toast.success('团队任务可见范围已统一调整');
      setBatchVisibilityDialogOpen(false);
      setTargetBatchScope(null);
    } catch {
      // handled
    } finally {
      setBatchVisibilityLoading(false);
    }
  };

  const handleTaskVisibilityScopeChange = async (memberId: string, scope: TeamMemberTaskVisibilityScope) => {
    if (!id) return;
    try {
      await updateMemberTaskVisibilityScope(id, memberId, scope);
      toast.success('成员可见范围已更新');
    } catch {
      // handled
    }
  };

  const handleSave = async () => {
    if (!id || !form.name.trim()) { toast.error('团队名称不能为空'); return; }
    setSaveLoading(true);
    try {
      await updateTeam(id, { name: form.name.trim(), level: form.level || undefined, description: form.description.trim() });
      toast.success('保存成功');
      finishEdit();
    } catch {
      // toast 已在拦截器处理
    } finally {
      setSaveLoading(false);
    }
  };

  const handleRoleChange = async (memberId: string, role: TeamMemberRole) => {
    if (!id) return;
    try {
      await updateMemberRole(id, memberId, role);
      toast.success('角色已更新');
    } catch {
      // handled
    }
  };

  const handleRemoveClick = async (memberId: string) => {
    if (!id) return;
    setRemovingMemberId(memberId);
    try {
      const check = await checkMemberRemoval(id, memberId);
      setRemoveCheck(check as TeamMemberTaskCheck);
      setRemoveReassignId('');
    } catch {
      setRemovingMemberId(null);
    }
  };

  const handleRemoveConfirm = async () => {
    if (!id || !removingMemberId) return;
    setRemoveLoading(true);
    try {
      await removeMember(
        id,
        removingMemberId,
        removeReassignId
          ? { transferToUserId: removeReassignId }
          : { removeParticipantAssignments: true }
      );
      toast.success('成员已移除');
      setRemoveCheck(null);
      setRemovingMemberId(null);
    } catch {
      // handled
    } finally {
      setRemoveLoading(false);
    }
  };

  const handleExitClick = async () => {
    if (!id) return;
    try {
      const check = await checkMyExit(id);
      setExitCheck(check as TeamMemberTaskCheck);
      setExitReassignId('');
    } catch {
      // handled
    }
  };

  const handleExitConfirm = async () => {
    if (!id) return;
    setExitLoading(true);
    try {
      await exitTeam(id);
      toast.success('已退出团队');
      navigate('/teams');
    } catch {
      // handled
    } finally {
      setExitLoading(false);
    }
  };

  const handleDissolveClick = async () => {
    if (!id) return;
    try {
      const check = await checkTeamDissolve(id);
      setDissolveCheck(check as TeamDissolveCheck);
      setDissolveConfirmName('');
    } catch {
      // handled
    }
  };

  const handleDissolveConfirm = async () => {
    if (!id) return;
    setDissolveLoading(true);
    try {
      await dissolveTeam(id);
      toast.success('团队已解散');
      navigate('/teams');
    } catch {
      // handled
    } finally {
      setDissolveLoading(false);
    }
  };

  const handleAddMembers = async () => {
    if (!id || addMemberIds.length === 0) return;
    setAddMemberLoading(true);
    try {
      await addMembers(id, addMemberIds, addMemberRole);
      toast.success('成员已添加');
      setAddMemberSheetOpen(false);
      setAddMemberIds([]);
      setAddMemberRole('member');
    } catch {
      // handled
    } finally {
      setAddMemberLoading(false);
    }
  };

  const existingMemberIds = members.map((m) => m.id);
  const removeHasTasks = (removeCheck?.openTaskCount ?? 0) > 0;
  const exitHasTasks = (exitCheck?.openTaskCount ?? 0) > 0;
  const calendarSummary = groupReminder?.calendarSummary;
  const calendarSyncedAt = formatDateTime(
    calendarSummary?.synced_at ?? calendarSummary?.last_synced_at ?? calendarSummary?.lastSyncedAt
  );
  const calendarOverrideCount = calendarSummary?.override_count ?? calendarSummary?.overrideCount;
  const calendarStatus = calendarSummary
    ? [
        calendarSummary.status || '已同步',
        calendarOverrideCount != null ? `${calendarOverrideCount} 条节假日规则` : '',
        calendarSyncedAt ? `最近 ${calendarSyncedAt}` : '',
      ].filter(Boolean).join(' · ')
    : '未同步';
  const reminderSelectedTasks = groupReminderTaskPool.filter((task) => reminderRule.task_ids.includes(task.id));
  const reminderMentionNames = Array.from(
    new Map(
      reminderSelectedTasks
        .map((task) => {
          const dingtalkUserId = String(task.dingtalk_user_id || '').trim();
          const displayName = String(task.assignee_name || '').trim() || dingtalkUserId;
          return dingtalkUserId ? [dingtalkUserId, displayName] : null;
        })
        .filter((item): item is [string, string] => Boolean(item))
    ).values()
  );
  const reminderMentionText = reminderMentionNames.length > 0
    ? `请以上负责人关注：${reminderMentionNames.map((name) => `@${name}`).join(' ')}`
    : '当前选中的任务还没有可 @ 的负责人';

  const updateReminderConfig = <Key extends keyof TeamGroupReminderConfig>(
    key: Key,
    value: TeamGroupReminderConfig[Key]
  ) => {
    setReminderConfig((current) => ({ ...current, [key]: value }));
  };

  const updateReminderRule = <Key extends keyof (TeamGroupReminderRule & { task_ids: string[] })>(
    key: Key,
    value: (TeamGroupReminderRule & { task_ids: string[] })[Key]
  ) => {
    setReminderRule((current) => ({ ...current, [key]: value }));
  };

  const buildReminderSavePayload = (
    config: TeamGroupReminderConfig = reminderConfig,
    rule: TeamGroupReminderRule & { task_ids: string[] } = reminderRule
  ): SaveTeamGroupReminderPayload => ({
    config: {
      webhook_url: config.webhook_url.trim(),
      secret: config.secret?.trim() ?? '',
      enabled: config.enabled,
    },
    rule: {
      enabled: config.enabled,
      send_time: rule.send_time || DEFAULT_REMINDER_SEND_TIME,
      workday_only: rule.workday_only,
      heading: rule.heading?.trim() || DEFAULT_REMINDER_HEADING,
      task_ids: rule.task_ids,
    },
  });

  const handleReminderEnabledChange = async (checked: boolean) => {
    if (!id) return;
    const previousConfig = reminderConfig;
    const previousRule = reminderRule;
    const nextConfig = { ...reminderConfig, enabled: checked };
    const nextRule = { ...reminderRule, enabled: checked };

    setReminderConfig(nextConfig);
    setReminderRule(nextRule);
    setReminderSaveLoading(true);
    try {
      await saveGroupReminder(id, buildReminderSavePayload(nextConfig, nextRule));
      toast.success(checked ? '群聊提醒已开启' : '群聊提醒已关闭');
    } catch {
      setReminderConfig(previousConfig);
      setReminderRule(previousRule);
    } finally {
      setReminderSaveLoading(false);
    }
  };

  const handleReminderTaskToggle = (taskId: string, checked: boolean) => {
    setReminderRule((current) => ({
      ...current,
      task_ids: checked
        ? Array.from(new Set([...current.task_ids, taskId]))
        : current.task_ids.filter((id) => id !== taskId),
    }));
  };

  const openHeadingDialog = () => {
    setHeadingDraft(reminderRule.heading || DEFAULT_REMINDER_HEADING);
    setHeadingDialogOpen(true);
  };

  const handleHeadingDialogSave = () => {
    updateReminderRule('heading', headingDraft.trim() || DEFAULT_REMINDER_HEADING);
    setHeadingDialogOpen(false);
  };

  const handleReminderSave = async () => {
    if (!id) return;
    setReminderSaveLoading(true);
    try {
      await saveGroupReminder(id, buildReminderSavePayload());
      toast.success('群聊提醒设置已保存');
    } catch {
      // handled
    } finally {
      setReminderSaveLoading(false);
    }
  };

  const handleReminderTestSend = async () => {
    if (!id) return;
    setReminderTestLoading(true);
    try {
      await testSendGroupReminder(id);
      toast.success('测试消息已发送');
    } catch {
      // handled
    } finally {
      setReminderTestLoading(false);
    }
  };

  const handleCalendarSync = async () => {
    if (!id) return;
    setCalendarSyncLoading(true);
    try {
      await syncGroupReminderCalendar(id);
      toast.success('工作日历已同步');
    } catch {
      // handled
    } finally {
      setCalendarSyncLoading(false);
    }
  };

  const openTour = useTourStore((state) => state.openTour);

  if (!currentTeam) return null;

  return (
    <div className={styles.contentContainer}>
      <div style={pageHeaderStyles.toolbar}>
        <div style={pageHeaderStyles.titleBlock}>
          <p style={pageHeaderStyles.breadcrumb}>
            <span style={pageHeaderStyles.breadcrumbLink} onClick={() => confirmIfNeeded(() => navigate(`/teams/${id}`))}>
              <ArrowLeft className="inline h-3.5 w-3.5 mr-1" />
              返回团队空间
            </span>
          </p>
          <div className="flex items-center gap-2">
            <h2 style={pageHeaderStyles.title}>团队设置</h2>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => openTour('team-settings')}
                    aria-label="查看团队管理指南"
                    className="inline-flex items-center justify-center h-6 w-6 rounded-full text-[#9B9A97] hover:text-[#37352F] hover:bg-[#EFEFEF] transition-colors cursor-pointer"
                  >
                    <HelpCircle className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  团队管理指南
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p style={pageHeaderStyles.meta}>{currentTeam.name}</p>
        </div>
      </div>

      <div className="space-y-4">
        <Card data-tour="team-settings-basic">
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
            <CardTitle className="text-base">基础信息</CardTitle>
            {!isEditing ? (
              isAdmin ? <Button variant="outline" size="sm" onClick={enterEdit}>编辑</Button> : null
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={cancelEdit}>取消</Button>
                <Button size="sm" onClick={() => void handleSave()} disabled={saveLoading}>
                  {saveLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : '保存'}
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className={styles.settingRow}>
              <p className="text-sm text-muted-foreground">团队名称</p>
              {isEditing ? (
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="max-w-md"
                />
              ) : (
                <p className="text-sm">{currentTeam.name}</p>
              )}
            </div>
            <Separator />
            <div className={styles.settingRow}>
              <p className="text-sm text-muted-foreground">团队层级</p>
              {isEditing ? (
                <Select value={form.level} onValueChange={(v) => setForm((f) => ({ ...f, level: v as Team['level'] }))}>
                  <SelectTrigger className="max-w-md">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['company', 'department', 'team', 'group', 'project'].map((lv) => (
                      <SelectItem key={lv} value={lv}>{teamLevelLabels[lv] ?? lv}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm">{teamLevelLabels[currentTeam.level] ?? currentTeam.level}</p>
              )}
            </div>
            <Separator />
            <div className={styles.settingRow}>
              <p className="text-sm text-muted-foreground">团队描述</p>
              {isEditing ? (
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="max-w-md"
                  placeholder="选填"
                />
              ) : (
                <p className="text-sm text-muted-foreground">{currentTeam.description || '暂无描述'}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card data-tour="team-settings-reminder">
          <CardHeader className={styles.reminderHeader}>
            <div className="flex min-w-0 flex-col gap-1">
              <CardTitle className="text-base">群聊机器人提醒</CardTitle>
              <p className="text-sm text-muted-foreground">
                开启后，系统会按发送规则把选中的未完成任务同步到钉钉群。
              </p>
            </div>
            <label className="flex shrink-0 items-center gap-3 text-sm font-medium">
              <span>{reminderConfig.enabled ? '已开启' : '未开启'}</span>
              <Switch
                id="group-reminder-enabled"
                aria-label="启用群聊机器人提醒"
                checked={reminderConfig.enabled}
                disabled={!isAdmin || reminderSaveLoading}
                onCheckedChange={handleReminderEnabledChange}
              />
            </label>
          </CardHeader>
          {reminderConfig.enabled ? (
            <CardContent className="flex flex-col gap-4">
                <div className={styles.settingRow}>
                  <label htmlFor="group-reminder-webhook" className="text-sm text-muted-foreground">Webhook</label>
                  <Input
                    id="group-reminder-webhook"
                    value={reminderConfig.webhook_url}
                    disabled={!isAdmin}
                    onChange={(event) => updateReminderConfig('webhook_url', event.target.value)}
                    className="max-w-xl"
                    placeholder="https://oapi.dingtalk.com/robot/send?access_token=..."
                  />
                </div>
                <Separator />
                <div className={styles.settingRow}>
                  <label htmlFor="group-reminder-secret" className="text-sm text-muted-foreground">Secret</label>
                  <Input
                    id="group-reminder-secret"
                    value={reminderConfig.secret ?? ''}
                    disabled={!isAdmin}
                    onChange={(event) => updateReminderConfig('secret', event.target.value)}
                    className="max-w-xl"
                    placeholder="选填"
                  />
                </div>
                <Separator />
                <div className={styles.settingRowStart}>
                  <p className="text-sm text-muted-foreground">发送规则</p>
                  <div className="flex min-w-0 flex-col gap-3">
                    <div className={styles.reminderRuleControls}>
                      <ReminderTimePicker
                        value={reminderRule.send_time}
                        disabled={!isAdmin}
                        onChange={(nextTime) => updateReminderRule('send_time', nextTime)}
                      />
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          id="group-reminder-workday-only"
                          checked={reminderRule.workday_only}
                          disabled={!isAdmin}
                          onCheckedChange={(checked) => updateReminderRule('workday_only', checked === true)}
                        />
                        仅中国工作日发送
                      </label>
                    </div>
                    <div className="relative min-w-0 rounded-md border border-border bg-background px-3 py-2 pr-20 text-sm">
                      <p className="pr-1 text-xs text-muted-foreground">消息头文案</p>
                      <p className="truncate">{reminderRule.heading || DEFAULT_REMINDER_HEADING}</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-label="编辑消息头文案"
                        className="absolute right-2 top-2"
                        disabled={!isAdmin}
                        onClick={openHeadingDialog}
                      >
                        编辑
                      </Button>
                    </div>
                  </div>
                </div>
                <Separator />
                <div className={styles.reminderWorkspace}>
                  <section className="flex min-w-0 flex-col gap-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium">任务池</p>
                      <Badge variant="outline">{reminderRule.task_ids.length} 已选</Badge>
                    </div>
                    <ScrollArea
                      role="region"
                      aria-label="群聊提醒任务池"
                      className="h-80 max-h-[min(420px,60vh)] min-w-0 rounded-md border border-border [&_[data-radix-scroll-area-viewport]>div]:!block [&_[data-radix-scroll-area-viewport]>div]:!w-full"
                    >
                      <div className="flex w-full min-w-0 flex-col gap-2 p-2">
                        {groupReminderTaskPool.length > 0 ? (
                          groupReminderTaskPool.map((task) => (
                            <label
                              key={task.id}
                              htmlFor={`group-reminder-task-${task.id}`}
                              className={styles.taskPoolItem}
                            >
                              <span className="flex min-w-0 flex-1 items-start gap-3">
                                <Checkbox
                                  id={`group-reminder-task-${task.id}`}
                                  aria-label={`选择任务：${task.title}`}
                                  checked={reminderRule.task_ids.includes(task.id)}
                                  disabled={!isAdmin}
                                  onCheckedChange={(checked) => handleReminderTaskToggle(task.id, checked === true)}
                                />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate font-medium">{task.title}</span>
                                  <span className="block text-xs text-muted-foreground">
                                    负责人：{task.assignee_name || '未分配'}
                                  </span>
                                </span>
                              </span>
                              <Badge className="shrink-0" variant={task.can_mention ? 'secondary' : 'outline'}>
                                {task.can_mention ? '可 @' : '不可 @'}
                              </Badge>
                            </label>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground">暂无未完成任务</p>
                        )}
                      </div>
                    </ScrollArea>
                  </section>
                  <section className="flex min-w-0 flex-col gap-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium">消息预览</p>
                      <Badge variant="secondary">钉钉样式</Badge>
                    </div>
                    <div className="min-h-80 rounded-md border border-border bg-muted/20 p-3">
                      <div className="flex max-w-full flex-col gap-3">
                        <div className="rounded-lg border border-border bg-background p-3 shadow-sm">
                          <p className="text-sm font-medium">{reminderRule.heading || DEFAULT_REMINDER_HEADING}</p>
                          <div className="mt-3 overflow-x-auto rounded-md border border-border">
                            <table className="w-full min-w-[360px] text-left text-xs">
                              <thead className="bg-muted/50 text-muted-foreground">
                                <tr>
                                  <th className="px-2 py-2 font-medium">任务名称</th>
                                  <th className="px-2 py-2 font-medium">责任人</th>
                                  <th className="px-2 py-2 font-medium">截止日期</th>
                                </tr>
                              </thead>
                              <tbody>
                                {reminderSelectedTasks.length > 0 ? (
                                  reminderSelectedTasks.map((task) => (
                                    <tr key={task.id} className="border-t border-border">
                                      <td className="max-w-[180px] px-2 py-2 align-top">
                                        <span className="block truncate">{task.title}</span>
                                      </td>
                                      <td className="px-2 py-2 align-top">{task.assignee_name || '未分配'}</td>
                                      <td className="px-2 py-2 align-top">{formatReminderDueDate(task.due_date)}</td>
                                    </tr>
                                  ))
                                ) : (
                                  <tr className="border-t border-border">
                                    <td className="px-2 py-3 text-muted-foreground" colSpan={3}>
                                      请选择需要提醒的任务
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                        <div className="rounded-lg border border-border bg-background p-3 text-sm shadow-sm">
                          {reminderMentionText}
                        </div>
                      </div>
                    </div>
                  </section>
                </div>
                <Separator />
                <div className={styles.settingRow}>
                  <p className="text-sm text-muted-foreground">工作日历</p>
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-sm">{calendarStatus}</p>
                    {calendarSummary?.source ? (
                      <Badge variant="outline">{calendarSummary.source}</Badge>
                    ) : null}
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button size="sm" onClick={() => void handleReminderSave()} disabled={reminderSaveLoading}>
                      {reminderSaveLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : '保存设置'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleReminderTestSend()}
                      disabled={reminderTestLoading}
                    >
                      {reminderTestLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : '测试发送'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleCalendarSync()}
                      disabled={calendarSyncLoading}
                    >
                      {calendarSyncLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : '同步工作日历'}
                    </Button>
                  </div>
                )}
            </CardContent>
          ) : null}
        </Card>

        <Card>
          <CardHeader data-tour="team-settings-members" className="flex flex-row items-center justify-between gap-3 space-y-0">
            <CardTitle className="text-base">成员管理</CardTitle>
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={() => setAddMemberSheetOpen(true)}>
                <Plus className="h-4 w-4" />
                添加成员
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            {isAdmin && (
              <div data-tour="team-settings-visibility" className="flex flex-col gap-3 rounded-lg border border-border bg-muted/20 p-3.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium">可见范围</span>
                    <TooltipProvider delayDuration={150}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            aria-label="查看可见范围说明"
                            className="inline-flex cursor-help text-muted-foreground hover:text-foreground focus:outline-none"
                          >
                            <Info className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="block max-w-none p-3.5 rounded-lg shadow-lg">
                          <div className="flex flex-col gap-2 w-80 text-xs leading-relaxed text-left">
                            <p className="font-semibold text-sm text-background">团队任务可见范围说明</p>
                            <div className="space-y-2 text-background/90">
                              <div>
                                <p className="font-medium text-background">成员仅可见相关任务</p>
                                <p className="mt-0.5 text-[11px] text-background/75 leading-normal">
                                  普通成员仅能查看由自己创建、负责或作为参与人的任务。
                                </p>
                              </div>
                              <div>
                                <p className="font-medium text-background">全员共享团队任务清单</p>
                                <p className="mt-0.5 text-[11px] text-background/75 leading-normal">
                                  团队内所有成员均可查阅本团队名下的全部任务清单。
                                </p>
                              </div>
                              <div>
                                <p className="font-medium text-background">部分成员个性化设置</p>
                                <p className="mt-0.5 text-[11px] text-background/75 leading-normal">
                                  支持在下方成员列表中，针对每位普通成员单独配置其查阅范围（“所有”或“仅自己”）。
                                </p>
                              </div>
                            </div>
                            <p className="border-t border-background/20 pt-1.5 text-[11px] text-background/60">
                              ※ 团队创建者与管理员默认可见全部任务，不受此选项影响。
                            </p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    控制团队普通成员的任务查阅权限（管理员和创建者默认可见全团队任务）
                  </p>
                </div>
                <div className="flex shrink-0 items-center">
                  <Select
                    value={effectiveScopeValue}
                    disabled={!isAdmin || batchVisibilityLoading}
                    onValueChange={(v) => handleRequestBatchVisibilityScopeChange(v)}
                  >
                    <SelectTrigger
                      data-testid="batch-visibility-trigger"
                      aria-label="一键调整可见范围"
                      className="h-8 w-56 text-xs bg-background"
                    >
                      <SelectValue placeholder="选择可见范围" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="self">成员仅可见相关任务</SelectItem>
                      <SelectItem value="all">全员共享团队任务清单</SelectItem>
                      <SelectItem value="mixed">部分成员个性化设置</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <Table className="min-w-[760px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[30%] bg-muted/20 pl-6 text-muted-foreground">成员</TableHead>
                  <TableHead className="w-[18%] bg-muted/20 text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <span>角色</span>
                      <TooltipProvider delayDuration={150}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex cursor-help text-muted-foreground hover:text-foreground">
                              <Info className="h-3.5 w-3.5" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="block max-w-none p-3 rounded-lg shadow-lg">
                            <div className="flex flex-col gap-2 w-64 text-xs leading-relaxed text-left">
                              <p className="font-semibold text-background">团队角色权限说明</p>
                              <div className="space-y-1.5 text-background/90">
                                <p>• <strong className="text-background">创建者</strong>：拥有团队全部管理权限。</p>
                                <p>• <strong className="text-background">管理员</strong>：可管理成员与全部任务，并实时接收团队内所有任务的状态调整、延期、评论等全部动态。</p>
                                <p>• <strong className="text-background">成员</strong>：团队普通成员，根据可见范围查看和协同任务。</p>
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </TableHead>
                  <TableHead className="w-[20%] bg-muted/20 text-muted-foreground">可见范围</TableHead>
                  <TableHead className="w-[18%] bg-muted/20 text-muted-foreground">加入时间</TableHead>
                  <TableHead className="w-[14%] bg-muted/20 pr-6 text-center text-muted-foreground">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedMembers.map((member) => {
                  const isSelf = member.id === user?.id;
                  const canEdit = isOwner && member.role_id !== 'owner';
                  const canRemove = isAdmin && member.role_id !== 'owner' && !isSelf;
                  const visibilityScope = getMemberTaskVisibilityScope(member.task_visibility_scope);
                  return (
                    <TableRow key={member.id}>
                      <TableCell className="pl-6">
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar className="size-8 shrink-0">
                            <AvatarImage src={member.avatar} />
                            <AvatarFallback>{member.name?.slice(0, 1)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {member.name}
                              {isSelf ? <span className="ml-1 text-xs text-muted-foreground">(我)</span> : null}
                            </p>
                            {member.department_name ? (
                              <p className="truncate text-xs text-muted-foreground">{member.department_name}</p>
                            ) : null}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {canEdit ? (
                          <Select value={member.role_id} onValueChange={(v) => void handleRoleChange(member.id, v as TeamMemberRole)}>
                            <SelectTrigger className="h-8 w-24 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">管理员</SelectItem>
                              <SelectItem value="member">成员</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant={memberRoleBadgeVariant[member.role_id] ?? 'outline'}>
                            {memberRoleLabels[member.role_id] ?? member.role_id}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {member.role_id === 'owner' || member.role_id === 'admin' ? (
                          <TooltipProvider delayDuration={150}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="outline" className="cursor-default font-normal text-muted-foreground">
                                  所有
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="block max-w-none p-2 text-xs">
                                <span className="text-background">管理员与创建者默认可见全团队任务，不受此限制</span>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : isPersonalized && isAdmin ? (
                          <Select
                            value={visibilityScope}
                            onValueChange={(v) => void handleTaskVisibilityScopeChange(
                              member.id,
                              v as TeamMemberTaskVisibilityScope
                            )}
                          >
                            <SelectTrigger className="h-8 w-28 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">所有</SelectItem>
                              <SelectItem value="self">仅自己</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <TooltipProvider delayDuration={150}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex cursor-default">
                                  <Badge
                                    variant={visibilityScope === 'self' ? 'secondary' : 'outline'}
                                    className="font-normal"
                                  >
                                    {memberTaskVisibilityLabels[visibilityScope]}
                                  </Badge>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="block max-w-none p-2 text-xs">
                                <span className="text-background">
                                  {isAdmin
                                    ? '当前由团队总控统一管理，如需单独配置请先在上方切换为个性化设置'
                                    : '团队统一可见范围'}
                                </span>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatJoinedAt(member.joined_at)}
                      </TableCell>
                      <TableCell className="pr-6 text-center">
                        <div className="flex justify-center">
                          {canRemove ? (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="text-muted-foreground hover:text-destructive"
                              onClick={() => void handleRemoveClick(member.id)}
                              aria-label={`移除${member.name}`}
                            >
                              <Trash2 />
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-base text-destructive">危险操作</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {!isOwner && (
                <Button
                  variant="outline"
                  className="border-destructive/40 text-destructive hover:bg-destructive/5"
                  onClick={() => void handleExitClick()}
                >
                  退出团队
                </Button>
              )}
              {isOwner && (
                <Button
                  variant="outline"
                  className="border-destructive/40 text-destructive hover:bg-destructive/5"
                  onClick={() => void handleDissolveClick()}
                >
                  解散团队
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 批量调整可见范围确认弹窗 */}
      <AlertDialog
        open={batchVisibilityDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setBatchVisibilityDialogOpen(false);
            setTargetBatchScope(null);
          }
        }}
      >
        <AlertDialogContent className="sm:max-w-[440px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold">调整任务可见范围</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-muted-foreground pt-1 leading-relaxed">
              切换后，团队内所有普通成员的可见范围将被统一重置。原本单独为个别成员个性化设定的可见范围将会被覆盖。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-md border border-border bg-muted/40 p-3 text-xs space-y-1.5 leading-relaxed">
            <p className="text-muted-foreground">
              目标范围：
              <span className="font-medium text-foreground ml-1">
                {targetBatchScope === 'self' ? '成员仅可见相关任务' : '全员共享团队任务清单'}
              </span>
            </p>
            <p className="text-[11px] text-muted-foreground">
              ※ 团队创建者与管理员默认可见全部任务，不受此选项影响。
            </p>
          </div>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel asChild>
              <Button type="button" variant="outline" disabled={batchVisibilityLoading}>
                取消
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                type="button"
                disabled={batchVisibilityLoading}
                onClick={(e) => {
                  e.preventDefault();
                  void handleConfirmBatchVisibilityScope();
                }}
              >
                {batchVisibilityLoading ? (
                  <>
                    <LoaderCircle className="mr-1.5 h-4 w-4 animate-spin" />
                    正在调整...
                  </>
                ) : (
                  '确认调整'
                )}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 群提醒文案 Dialog */}
      <Dialog open={headingDialogOpen} onOpenChange={setHeadingDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑提醒文案</DialogTitle>
            <DialogDescription>
              这段文字会作为群聊机器人消息的开头，任务列表会自动追加在后面。
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <label htmlFor="group-reminder-heading" className="text-sm font-medium">提醒文案</label>
            <Textarea
              id="group-reminder-heading"
              value={headingDraft}
              onChange={(event) => setHeadingDraft(event.target.value)}
              rows={5}
              placeholder={DEFAULT_REMINDER_HEADING}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setHeadingDialogOpen(false)}>
              取消
            </Button>
            <Button type="button" onClick={handleHeadingDialogSave}>
              保存文案
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 添加成员 Sheet */}
      <Sheet
        open={addMemberSheetOpen}
        onOpenChange={(open) => {
          setAddMemberSheetOpen(open);
          if (!open) {
            setAddMemberIds([]);
            setAddMemberRole('member');
          }
        }}
      >
        <SheetContent side="right" className="w-96">
          <SheetHeader>
            <SheetTitle>添加成员</SheetTitle>
          </SheetHeader>
          <div className="mt-6 flex flex-col gap-4 px-6">
            <div className="space-y-1.5">
              <label className="flex items-center gap-1 text-sm font-medium">
                <span>成员角色</span>
                <TooltipProvider delayDuration={150}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex cursor-help text-muted-foreground hover:text-foreground">
                        <Info className="h-3.5 w-3.5" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs space-y-1 p-2.5 text-xs leading-normal">
                      <p>• <strong className="text-foreground">管理员</strong>：可管理成员与任务，并实时接收团队所有任务状态调整、延期、评论等动态。</p>
                      <p>• <strong className="text-foreground">成员</strong>：普通成员，仅按团队可见范围协作任务。</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </label>
              <Select value={addMemberRole} onValueChange={(v) => setAddMemberRole(v as TeamMemberRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">管理员</SelectItem>
                  <SelectItem value="member">成员</SelectItem>
                </SelectContent>
              </Select>
              {addMemberRole === 'admin' && (
                <p className="text-xs text-muted-foreground">
                  管理员不受可见范围限制，且自动接收全团队任务所有动态。
                </p>
              )}
            </div>
            <UserSelect
              mode="multiple"
              value={addMemberIds}
              onChange={(v) => setAddMemberIds((v as string[]) ?? [])}
              excludeIds={existingMemberIds}
              placeholder="搜索并选择成员"
            />
            <Button className="w-full" onClick={() => void handleAddMembers()} disabled={addMemberLoading || addMemberIds.length === 0}>
              {addMemberLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : `添加 ${addMemberIds.length > 0 ? `(${addMemberIds.length})` : ''}`}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* 移除成员 Dialog */}
      <Dialog open={!!removeCheck} onOpenChange={(open) => { if (!open) { setRemoveCheck(null); setRemovingMemberId(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>移除成员</DialogTitle>
            <DialogDescription>
              {removeHasTasks
                ? '该成员名下有未完成任务，请选择任务转交对象。'
                : '确认移除该成员？'}
            </DialogDescription>
          </DialogHeader>
          {removeHasTasks && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="remove-no-reassign"
                  checked={!removeReassignId}
                  onCheckedChange={(checked) => { if (checked) setRemoveReassignId(''); }}
                />
                <label htmlFor="remove-no-reassign" className="text-sm">不转交，直接移除</label>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">转交给</label>
                <UserSelect
                  mode="single"
                  value={removeReassignId}
                  onChange={(v) => setRemoveReassignId((v as string) ?? '')}
                  users={members.filter((m) => m.id !== removingMemberId)}
                  placeholder="选择接收人"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRemoveCheck(null); setRemovingMemberId(null); }}>取消</Button>
            <Button variant="destructive" onClick={() => void handleRemoveConfirm()} disabled={removeLoading}>
              {removeLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : '确认移除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 退出团队 Dialog */}
      <Dialog open={!!exitCheck} onOpenChange={(open) => { if (!open) setExitCheck(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>退出团队</DialogTitle>
            <DialogDescription>
              {exitHasTasks
                ? '你名下有未完成任务，请选择任务转交对象。'
                : '确认退出该团队？'}
            </DialogDescription>
          </DialogHeader>
          {exitHasTasks && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="exit-no-reassign"
                  checked={!exitReassignId}
                  onCheckedChange={(checked) => { if (checked) setExitReassignId(''); }}
                />
                <label htmlFor="exit-no-reassign" className="text-sm">不转交，直接退出</label>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">转交给</label>
                <UserSelect
                  mode="single"
                  value={exitReassignId}
                  onChange={(v) => setExitReassignId((v as string) ?? '')}
                  users={members.filter((m) => m.id !== user?.id)}
                  placeholder="选择接收人"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setExitCheck(null)}>取消</Button>
            <Button variant="destructive" onClick={() => void handleExitConfirm()} disabled={exitLoading}>
              {exitLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : '确认退出'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 解散团队 AlertDialog */}
      <AlertDialog open={!!dissolveCheck} onOpenChange={(open) => { if (!open) setDissolveCheck(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>解散团队</AlertDialogTitle>
            <AlertDialogDescription>
              此操作不可撤销。解散后团队所有数据将被清除。请输入团队名称 <strong>{currentTeam.name}</strong> 以确认。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            placeholder={`请输入"${currentTeam.name}"`}
            value={dissolveConfirmName}
            onChange={(e) => setDissolveConfirmName(e.target.value)}
          />
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button type="button" variant="outline" onClick={() => setDissolveCheck(null)}>
                取消
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                type="button"
                variant="destructive"
                onClick={() => void handleDissolveConfirm()}
                disabled={dissolveConfirmName !== currentTeam.name || dissolveLoading}
              >
                {dissolveLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : '确认解散'}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
