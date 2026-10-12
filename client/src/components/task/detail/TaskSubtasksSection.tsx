import { useState, useEffect, useMemo } from 'react';
import {
  ListTree,
  CheckSquare2,
  Square,
  Plus,
  CornerDownRight,
  Loader2,
  UserCircle2,
  CalendarDays,
  Flag,
  Check,
  Search,
  X,
} from 'lucide-react';
import dayjs from 'dayjs';
import { cn } from '@/lib/utils';
import type { Task, TaskPriority, TaskStatus, User } from '@/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { loadAllUsers } from '@/api/loadAllUsers';
import request from '@/api/request';

interface TaskSubtasksSectionProps {
  parentTaskId: string;
  subtasks: Task[];
  subtaskCount: number;
  subtaskDoneCount: number;
  users?: User[];
  disabled?: boolean;
  onNavigateToSubtask: (subtaskId: string) => void;
  onToggleStatus: (subtaskId: string, currentStatus: TaskStatus) => Promise<void>;
  onOpenCreateSubtaskModal?: () => void;
  onUpdateSubtask?: (subtaskId: string, patch: Partial<Task>) => Promise<void>;
}

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string }> = {
  low: { label: '低', color: '#9B9A97' },
  medium: { label: '普通', color: '#2783DE' },
  high: { label: '高', color: '#F59E0B' },
  urgent: { label: '紧急', color: '#EF4444' },
};

const PRIORITY_LIST: TaskPriority[] = ['low', 'medium', 'high', 'urgent'];

/**
 * 任务详情 - 子任务分解区块 (WBS)
 *
 * 展示子任务层级进度列表，支持点击“+ 添加子任务”弹出完整创建弹窗，
 * 并支持在列表中对子任务进行原地状态切换与快捷修改。
 * 严格遵循 Notion 极简留白风格，杜绝任何 emoji 符号。
 */
export default function TaskSubtasksSection({
  subtasks,
  subtaskCount,
  subtaskDoneCount,
  users: propUsers,
  disabled = false,
  onNavigateToSubtask,
  onToggleStatus,
  onOpenCreateSubtaskModal,
  onUpdateSubtask,
}: TaskSubtasksSectionProps) {
  // 备选用户数据
  const [internalUsers, setInternalUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const users = propUsers && propUsers.length > 0 ? propUsers : internalUsers;

  useEffect(() => {
    if ((!propUsers || propUsers.length === 0) && internalUsers.length === 0 && !usersLoading) {
      setUsersLoading(true);
      void loadAllUsers((params) => request.get('/users', { params }))
        .then((loaded) => setInternalUsers(loaded))
        .catch(() => {})
        .finally(() => setUsersLoading(false));
    }
  }, [propUsers, internalUsers.length, usersLoading]);

  // 行内条目下拉状态 (subtaskId)
  const [activeItemAssigneeId, setActiveItemAssigneeId] = useState<string | null>(null);
  const [itemAssigneeSearch, setItemAssigneeSearch] = useState('');
  const [activeItemDateId, setActiveItemDateId] = useState<string | null>(null);
  const [activeItemPriorityId, setActiveItemPriorityId] = useState<string | null>(null);

  const [togglingId, setTogglingId] = useState<string | null>(null);

  const progressPercent = subtaskCount > 0 ? Math.round((subtaskDoneCount / subtaskCount) * 100) : 0;

  // 用户字典
  const userMap = useMemo(() => {
    const map = new Map<string, User>();
    users.forEach((u) => map.set(u.id, u));
    return map;
  }, [users]);

  const filteredUsersForItem = useMemo(() => {
    const q = itemAssigneeSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => u.name?.toLowerCase().includes(q) || u.department_name?.toLowerCase().includes(q));
  }, [users, itemAssigneeSearch]);

  const handleToggle = async (subtaskId: string, currentStatus: TaskStatus) => {
    if (disabled || togglingId) return;
    setTogglingId(subtaskId);
    try {
      await onToggleStatus(subtaskId, currentStatus);
    } finally {
      setTogglingId(null);
    }
  };

  const handleItemPatch = async (subtaskId: string, patch: Partial<Task>) => {
    if (disabled || !onUpdateSubtask) return;
    await onUpdateSubtask(subtaskId, patch);
  };

  return (
    <div className="space-y-3 rounded-lg border border-(--tf-border-soft) bg-white p-4" data-testid="task-subtasks-section">
      {/* 1. 头部与进度 */}
      <div className="flex items-center justify-between text-xs text-[#787774]">
        <div className="flex items-center gap-1.5 font-semibold text-[#37352F]">
          <ListTree className="h-4 w-4 text-[#787774]" />
          <span>子任务</span>
          <span className="font-normal text-[#9B9A97]">
            ({subtaskDoneCount} / {subtaskCount})
          </span>
        </div>
        {subtaskCount > 0 && (
          <span className="font-medium text-[#787774]">{progressPercent}% 完成</span>
        )}
      </div>

      {/* 2. 进度条 */}
      {subtaskCount > 0 && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#F3F4F6]">
          <div
            className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}

      {/* 3. 子任务列表 */}
      <div className="space-y-1">
        {subtasks.map((subtask) => {
          const isDone = subtask.status === 'done' || subtask.status === 'delayed_done';
          const isToggling = togglingId === subtask.id;
          const priorityInfo = PRIORITY_CONFIG[subtask.priority] || PRIORITY_CONFIG.medium;
          const assignedUser = subtask.assignee_id ? userMap.get(subtask.assignee_id) : null;
          const assigneeName = subtask.assignee_name || assignedUser?.name;

          return (
            <div
              key={subtask.id}
              className="group flex items-center justify-between gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-[#F9FAFB]"
            >
              {/* 左侧：勾选框 + 标题 + 嵌套子任务标记 */}
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <button
                  type="button"
                  disabled={disabled || isToggling}
                  onClick={() => handleToggle(subtask.id, subtask.status)}
                  className="shrink-0 text-[#9B9A97] transition-colors hover:text-[#37352F] disabled:opacity-50 cursor-pointer"
                  title={isDone ? '标记为进行中' : '标记为已完成'}
                >
                  {isToggling ? (
                    <Loader2 className="h-4 w-4 animate-spin text-[#9B9A97]" />
                  ) : isDone ? (
                    <CheckSquare2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => onNavigateToSubtask(subtask.id)}
                  className={cn(
                    "truncate text-left text-xs font-normal transition-colors hover:text-[#2783DE] cursor-pointer",
                    isDone ? "text-[#9B9A97] line-through" : "text-[#37352F]"
                  )}
                  title={subtask.title}
                >
                  {subtask.title}
                </button>

                {(subtask.subtask_count ?? 0) > 0 && (
                  <span
                    className="inline-flex shrink-0 items-center gap-0.5 rounded bg-[#F3F4F6] px-1.5 py-0.2 text-[10px] text-[#787774]"
                    title={`包含 ${subtask.subtask_count} 个下级子任务`}
                  >
                    <CornerDownRight className="h-3 w-3" />
                    {subtask.subtask_count}
                  </span>
                )}
              </div>

              {/* 右侧：行内直接可改的元属性（优先级 + 处理人 + 完成节点） */}
              <div className="flex shrink-0 items-center gap-1.5 text-[11px]">
                {/* 紧急度切换 Popover */}
                <Popover
                  open={activeItemPriorityId === subtask.id}
                  onOpenChange={(open) => setActiveItemPriorityId(open ? subtask.id : null)}
                >
                  <PopoverTrigger asChild disabled={disabled}>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium transition-colors hover:bg-[#ECECEE] cursor-pointer"
                      style={{ color: priorityInfo.color }}
                      title="修改紧急度"
                    >
                      <Flag className="h-3 w-3" />
                      <span>{priorityInfo.label}</span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-28 p-1 text-xs" align="end">
                    <div className="space-y-0.5">
                      {PRIORITY_LIST.map((p) => {
                        const info = PRIORITY_CONFIG[p];
                        const isSelected = subtask.priority === p;
                        return (
                          <button
                            key={p}
                            type="button"
                            onClick={() => {
                              setActiveItemPriorityId(null);
                              void handleItemPatch(subtask.id, { priority: p });
                            }}
                            className="flex w-full items-center justify-between rounded px-2 py-1 text-left hover:bg-[#F3F4F6] cursor-pointer"
                          >
                            <span style={{ color: info.color }}>{info.label}</span>
                            {isSelected && <Check className="h-3 w-3 text-[#37352F]" />}
                          </button>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>

                {/* 处理人指派 Popover */}
                <Popover
                  open={activeItemAssigneeId === subtask.id}
                  onOpenChange={(open) => {
                    setActiveItemAssigneeId(open ? subtask.id : null);
                    if (!open) setItemAssigneeSearch('');
                  }}
                >
                  <PopoverTrigger asChild disabled={disabled}>
                    <button
                      type="button"
                      className={cn(
                        "inline-flex max-w-[90px] items-center gap-1 truncate rounded px-1.5 py-0.5 transition-colors hover:bg-[#ECECEE] cursor-pointer",
                        assigneeName ? "text-[#37352F]" : "text-[#9B9A97]"
                      )}
                      title={assigneeName ? `处理人: ${assigneeName}` : '指派处理人'}
                    >
                      <UserCircle2 className="h-3 w-3 shrink-0 text-[#787774]" />
                      <span className="truncate">{assigneeName || '指派'}</span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-52 p-2 text-xs" align="end">
                    <div className="relative mb-2">
                      <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-[#9B9A97]" />
                      <Input
                        value={itemAssigneeSearch}
                        onChange={(e) => setItemAssigneeSearch(e.target.value)}
                        placeholder="搜索处理人..."
                        className="h-7 pl-7 text-xs"
                      />
                    </div>
                    <div className="max-h-40 overflow-y-auto space-y-0.5">
                      {subtask.assignee_id && (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveItemAssigneeId(null);
                            void handleItemPatch(subtask.id, { assignee_id: '' });
                          }}
                          className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[#EF4444] hover:bg-rose-50 cursor-pointer"
                        >
                          <X className="h-3 w-3" />
                          <span>取消指派</span>
                        </button>
                      )}
                      {filteredUsersForItem.map((u) => {
                        const isSelected = subtask.assignee_id === u.id;
                        return (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => {
                              setActiveItemAssigneeId(null);
                              void handleItemPatch(subtask.id, { assignee_id: u.id });
                            }}
                            className="flex w-full items-center justify-between rounded px-2 py-1 text-left hover:bg-[#F3F4F6] cursor-pointer"
                          >
                            <span className="flex items-center gap-1.5 truncate">
                              <Avatar className="h-4 w-4">
                                <AvatarImage src={u.avatar || undefined} />
                                <AvatarFallback className="text-[9px]">{u.name?.slice(0, 1)}</AvatarFallback>
                              </Avatar>
                              <span className="truncate">{u.name}</span>
                            </span>
                            {isSelected && <Check className="h-3 w-3 text-[#37352F] shrink-0" />}
                          </button>
                        );
                      })}
                      {filteredUsersForItem.length === 0 && (
                        <div className="py-2 text-center text-[#9B9A97]">无匹配成员</div>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>

                {/* 完成节点 Popover */}
                <Popover
                  open={activeItemDateId === subtask.id}
                  onOpenChange={(open) => setActiveItemDateId(open ? subtask.id : null)}
                >
                  <PopoverTrigger asChild disabled={disabled}>
                    <button
                      type="button"
                      className={cn(
                        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors hover:bg-[#ECECEE] cursor-pointer",
                        subtask.due_date ? "text-[#787774]" : "text-[#9B9A97]"
                      )}
                      title={subtask.due_date ? `完成节点: ${subtask.due_date}` : '设定完成节点'}
                    >
                      <CalendarDays className="h-3 w-3 shrink-0" />
                      <span className="whitespace-nowrap">
                        {subtask.due_date ? dayjs(subtask.due_date).format('MM/DD') : '节点'}
                      </span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-2 text-xs" align="end">
                    <div className="flex items-center gap-1 border-b border-[#E9E9E7] pb-2 mb-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs px-1.5"
                        onClick={() => {
                          setActiveItemDateId(null);
                          void handleItemPatch(subtask.id, { due_date: dayjs().format('YYYY-MM-DD') });
                        }}
                      >
                        今天
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs px-1.5"
                        onClick={() => {
                          setActiveItemDateId(null);
                          void handleItemPatch(subtask.id, { due_date: dayjs().add(1, 'day').format('YYYY-MM-DD') });
                        }}
                      >
                        明天
                      </Button>
                      {subtask.due_date && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs px-1.5 text-[#EF4444] hover:text-[#DC2626]"
                          onClick={() => {
                            setActiveItemDateId(null);
                            void handleItemPatch(subtask.id, { due_date: null });
                          }}
                        >
                          清除
                        </Button>
                      )}
                    </div>
                    <Calendar
                      mode="single"
                      selected={subtask.due_date ? new Date(subtask.due_date) : undefined}
                      onSelect={(selected) => {
                        setActiveItemDateId(null);
                        void handleItemPatch(subtask.id, {
                          due_date: selected ? dayjs(selected).format('YYYY-MM-DD') : null,
                        });
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. 添加子任务动作按钮（呼出完整弹窗，支持时间范围、描述、附件等） */}
      {!disabled && (
        <div className="pt-1">
          <button
            type="button"
            onClick={onOpenCreateSubtaskModal}
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-[#787774] transition-colors hover:bg-[#F3F4F6] hover:text-[#37352F] cursor-pointer"
            data-testid="add-subtask-button"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>添加子任务</span>
          </button>
        </div>
      )}
    </div>
  );
}
