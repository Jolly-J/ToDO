/**
 * 组件名称：用户选择器
 * 文件作用：提供可搜索的人员选择输入框。
 * 主要功能：远程拉取用户列表，支持单选负责人或多选参与人。
 */
import { useState, useEffect, useRef, useMemo } from 'react';
import { X, Check, Loader2 } from 'lucide-react';
import type { User } from '@/types';
import request from '@/api/request';
import { loadAllUsers, type UserListPayload } from '@/api/loadAllUsers';
import { debounce } from 'lodash';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface UserSelectProps {
  value?: string | string[];
  onChange?: (userIds: string | string[] | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  defaultOpen?: boolean;
  open?: boolean;
  allowClear?: boolean;
  excludeIds?: string[];
  mode?: 'multiple' | 'single';
  maxTagCount?: number | 'responsive';
  users?: User[];
  notFoundContent?: React.ReactNode;
  onBlur?: () => void;
  onOpenChange?: (open: boolean) => void;
  portalContainer?: HTMLElement | null | (() => HTMLElement | null);
}

export default function UserSelect({
  value,
  onChange,
  placeholder = '请选择人员',
  disabled = false,
  autoFocus = false,
  defaultOpen = false,
  open: controlledOpen,
  allowClear = true,
  excludeIds = [],
  mode = 'multiple',
  users,
  notFoundContent,
  onBlur,
  onOpenChange,
  portalContainer,
}: UserSelectProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;

  const [searchKeyword, setSearchKeyword] = useState('');
  const [options, setOptions] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [knownUsers, setKnownUsers] = useState<User[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const useLocalUsers = Array.isArray(users);
  const filteredLocalUsers = (users ?? []).filter((u) => !excludeIds.includes(u.id));

  const selectedIds: string[] = Array.isArray(value)
    ? value
    : value
    ? [value]
    : [];

  // 从已知用户中找到选中的用户对象
  const allKnown = [...knownUsers, ...(users ?? [])];
  const selectedUsers = selectedIds
    .map((id) => allKnown.find((u) => u.id === id))
    .filter(Boolean) as User[];

  const fetchUsers = useMemo(
    () => debounce(async (keyword: string) => {
      if (useLocalUsers) return;
      setLoading(true);
      try {
        const list = await loadAllUsers(
          (params) => request.get<UserListPayload>('/users', { params }),
          { keyword }
        );
        const filtered = list.filter((u) => !excludeIds.includes(u.id));
        setOptions(filtered);
        setKnownUsers((prev) => {
          const map = new Map(prev.map((u) => [u.id, u]));
          filtered.forEach((u) => map.set(u.id, u));
          return Array.from(map.values());
        });
      } finally {
        setLoading(false);
      }
    }, 300),
    [useLocalUsers, excludeIds]
  );

  useEffect(() => {
    if (open) {
      fetchUsers(searchKeyword);
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      fetchUsers.cancel();
      setSearchKeyword('');
    }
    return () => {
      fetchUsers.cancel();
    };
  }, [open, searchKeyword, fetchUsers]);

  const displayOptions = useLocalUsers
    ? filteredLocalUsers.filter(
        (u) =>
          !searchKeyword ||
          u.name.includes(searchKeyword) ||
          u.email?.includes(searchKeyword)
      )
    : options;

  const handleToggle = (user: User) => {
    if (mode === 'single') {
      onChange?.(user.id);
      setInternalOpen(false);
      onOpenChange?.(false);
      return;
    }
    const next = selectedIds.includes(user.id)
      ? selectedIds.filter((id) => id !== user.id)
      : [...selectedIds, user.id];
    onChange?.(next.length ? next : undefined);
  };

  const handleRemove = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (mode === 'single') {
      onChange?.(undefined);
      return;
    }
    const next = selectedIds.filter((sid) => sid !== id);
    onChange?.(next.length ? next : undefined);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange?.(mode === 'multiple' ? [] : undefined);
  };

  const handleOpenChange = (next: boolean) => {
    setInternalOpen(next);
    onOpenChange?.(next);
    if (!next) onBlur?.();
  };

  const resolvedPortalContainer = typeof portalContainer === 'function'
    ? portalContainer()
    : portalContainer;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild disabled={disabled}>
        <div
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          tabIndex={disabled ? -1 : 0}
          autoFocus={autoFocus}
          className={cn(
            'flex min-h-[var(--tf-density-control-height)] w-full cursor-pointer flex-wrap items-center gap-1.5 rounded-[var(--tf-density-control-radius)] border border-border bg-background px-[var(--tf-density-control-padding-x)] py-[var(--tf-density-control-padding-y)] text-sm transition-colors',
            disabled && 'cursor-not-allowed opacity-50',
            open && 'ring-1 ring-ring/20'
          )}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') handleOpenChange(!open);
          }}
        >
          {selectedUsers.length === 0 ? (
            <span className="text-muted-foreground">{placeholder}</span>
          ) : (
            selectedUsers.map((u) => (
              <span
                key={u.id}
                className="inline-flex items-center gap-1 rounded-md bg-accent px-2 py-0.5 text-xs font-medium text-foreground"
              >
                <Avatar className="h-4 w-4">
                  <AvatarImage src={u.avatar} />
                  <AvatarFallback>{u.name.slice(0, 1)}</AvatarFallback>
                </Avatar>
                {u.name}
                {!disabled && (
                  <button
                    type="button"
                    className="ml-0.5 rounded-sm opacity-60 hover:opacity-100"
                    onClick={(e) => handleRemove(u.id, e)}
                    aria-label={`移除 ${u.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            ))
          )}
          <div className="ml-auto flex items-center gap-1">
            {allowClear && selectedUsers.length > 0 && !disabled && (
              <button
                type="button"
                className="rounded-sm opacity-40 hover:opacity-80"
                onClick={handleClear}
                aria-label="清除"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </PopoverTrigger>
      <PopoverContent
        portalContainer={resolvedPortalContainer}
        className="w-72 p-0"
        align="start"
        side="bottom"
        collisionBoundary={resolvedPortalContainer ?? undefined}
        collisionPadding={8}
      >
        <div className="border-b border-border px-3 py-2">
          <input
            ref={inputRef}
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            placeholder="搜索人员..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
          />
        </div>
        <div className="max-h-60 min-h-40 overflow-y-auto overscroll-contain p-1">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : displayOptions.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {notFoundContent ?? '暂无数据'}
            </div>
          ) : (
            displayOptions.map((u) => {
              const selected = selectedIds.includes(u.id);
              return (
                <button
                  key={u.id}
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent',
                    selected && 'bg-accent/60'
                  )}
                  onClick={() => handleToggle(u)}
                >
                  <Avatar className="h-6 w-6 shrink-0">
                    <AvatarImage src={u.avatar} />
                    <AvatarFallback>{u.name.slice(0, 1)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1 text-left">
                    <div className="truncate font-medium">{u.name}</div>
                    {u.department_name && (
                      <div className="truncate text-xs text-muted-foreground">{u.department_name}</div>
                    )}
                  </div>
                  {selected && <Check className="h-4 w-4 shrink-0 text-primary" />}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
