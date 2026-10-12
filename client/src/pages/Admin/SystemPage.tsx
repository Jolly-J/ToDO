/**
 * SystemPage.tsx - 系统管理页面（仅保留用户管理）
 *
 * 提供用户目录、管理员授权和钉钉组织同步能力。
 *
 * @module pages/Admin
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { CircleCheck, RefreshCw, TriangleAlert } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useDebounce } from '@/hooks';
import { fetchAdminUsers, startDingtalkSync, pollSyncStatus, updateUserAdminRole } from './api';
import { loadAdminUserDirectory } from './userDirectoryLoader';
import {
  AdminFilterSelect,
  AdminPageHeader,
  AdminTruncatedText,
  EmptyPanel,
  StatusInline,
} from './shared';
import type {
  AdminLayoutContextValue,
  AdminSyncResult,
  AdminUserDirectory,
  AdminUserItem,
  StatusTone,
} from './types';
import { cn } from '@/lib/utils';
import styles from './Admin.module.css';

function getUserStatusTone(status: number): StatusTone {
  return Number(status) === 1 ? 'success' : 'warning';
}

function getDisplayNameInitial(user: AdminUserItem) {
  return (user.name || user.job_number || user.id || '?').trim().slice(0, 1).toUpperCase();
}

function AdminBadge({ active }: { active: boolean }) {
  return (
    <Badge
      variant={active ? 'default' : 'outline'}
      className={cn(
        'whitespace-nowrap font-normal',
        active
          ? 'bg-[#37352F] text-white'
          : 'text-muted-foreground'
      )}
    >
      {active ? '管理员' : '普通用户'}
    </Badge>
  );
}

function getAdminActionBlockReason({
  user,
  currentUserId,
  adminCount,
}: {
  user: AdminUserItem;
  currentUserId?: string | null;
  adminCount: number;
}) {
  if (!user.isAdmin) {
    return null;
  }
  if (currentUserId && user.id === currentUserId) {
    return '当前登录管理员不能撤销自己的管理员身份';
  }
  if (adminCount <= 1) {
    return '系统至少需要保留一名管理员';
  }
  return null;
}

function UsersPanel() {
  const { session } = useOutletContext<AdminLayoutContextValue>();
  const [keywordInput, setKeywordInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const [syncResult, setSyncResult] = useState<AdminSyncResult | null>(null);
  const [directory, setDirectory] = useState<AdminUserDirectory | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [syncPending, setSyncPending] = useState(false);
  const requestSequence = useRef(0);

  const debouncedKeyword = useDebounce(keywordInput.trim(), 300);

  const currentParams = useMemo(
    () => ({ keyword: debouncedKeyword, status: statusFilter }),
    [debouncedKeyword, statusFilter]
  );

  const loadDirectory = async (params?: { keyword?: string; status?: string }) => {
    const sequence = ++requestSequence.current;
    setLoading(true);
    setLoadError(null);
    try {
      const payload = await loadAdminUserDirectory(fetchAdminUsers, {
        keyword: params?.keyword || undefined,
        status: params?.status && params.status !== 'all' ? params.status : undefined,
      });
      if (sequence === requestSequence.current) setDirectory(payload);
    } catch (nextError) {
      if (sequence === requestSequence.current) {
        setLoadError(String((nextError as Error)?.message || '用户目录加载失败'));
      }
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  };

  useEffect(() => {
    setFeedback(null);
    void loadDirectory(currentParams);
  }, [currentParams]);

  const handleAdminToggle = async (user: AdminUserItem) => {
    const nextIsAdmin = !user.isAdmin;
    const guardMessage = getAdminActionBlockReason({
      user,
      currentUserId: session?.userId,
      adminCount: directory?.summary.adminCount || 0,
    });
    if (guardMessage) {
      setFeedback({ tone: 'error', message: guardMessage });
      return;
    }

    setPendingAction(`admin:${user.id}`);
    setFeedback(null);
    try {
      await updateUserAdminRole(user.id, nextIsAdmin);
      setFeedback({
        tone: 'success',
        message: `${nextIsAdmin ? '已授予' : '已移除'} ${user.name} 的管理员角色`,
      });
      await loadDirectory(currentParams);
    } catch (nextError) {
      setFeedback({
        tone: 'error',
        message: String((nextError as Error)?.message || '管理员角色更新失败'),
      });
    } finally {
      setPendingAction(null);
    }
  };

  const handleSync = async () => {
    setSyncPending(true);
    setFeedback(null);
    try {
      const { jobId } = await startDingtalkSync();

      // 轮询直到完成，每 3 秒一次，最多等 5 分钟（100次）
      let attempts = 0;
      const maxAttempts = 100;

      await new Promise<void>((resolve, reject) => {
        const poll = () => {
          attempts++;
          pollSyncStatus(jobId)
            .then((job) => {
              if (job.status === 'done') {
                if (job.result) {
                  const result: AdminSyncResult = {
                    ...job.result,
                    finishedAt: job.finishedAt || new Date().toISOString(),
                  };
                  setSyncResult(result);
                  setFeedback({
                    tone: 'success',
                    message: `同步完成：部门 ${result.departmentsSynced}，用户 ${result.usersSynced}，失活 ${result.usersDisabled}`,
                  });
                }
                resolve();
              } else if (job.status === 'failed') {
                reject(new Error(job.error || '同步失败'));
              } else if (attempts >= maxAttempts) {
                reject(new Error('同步超时，请稍后刷新页面查看结果'));
              } else {
                setTimeout(poll, 3000);
              }
            })
            .catch(reject);
        };
        setTimeout(poll, 3000);
      });

      await loadDirectory(currentParams);
    } catch (nextError) {
      setFeedback({
        tone: 'error',
        message: String((nextError as Error)?.message || '钉钉用户同步失败'),
      });
    } finally {
      setSyncPending(false);
    }
  };

  const inactiveCount = (directory?.summary.total || 0) - (directory?.summary.activeCount || 0);
  const summaryItems = [
    { label: '用户总数', value: directory?.total || 0 },
    { label: '管理员', value: directory?.summary.adminCount || 0 },
    { label: '正常用户', value: directory?.summary.activeCount || 0 },
    { label: '已停用', value: inactiveCount },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
      <Card className="bg-background">
        <CardContent className="grid grid-cols-2 p-0 lg:grid-cols-4">
          {summaryItems.map((item, index) => (
            <div key={item.label} className={cn('flex items-center justify-between gap-3 px-4 py-2.5', index > 0 && 'border-l border-border')}>
              <span className="text-xs text-muted-foreground">{item.label}</span>
              <strong className={cn(styles.mono, 'text-lg font-semibold tabular-nums text-foreground')}>{item.value}</strong>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2 py-0.5">
        <div className="text-xs text-muted-foreground">
          {syncResult ? `最近同步：部门 ${syncResult.departmentsSynced}，用户 ${syncResult.usersSynced}，失活 ${syncResult.usersDisabled}` : '用户目录来自钉钉组织同步'}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Input
            value={keywordInput}
            onChange={(event) => setKeywordInput(event.target.value)}
            placeholder="搜索姓名 / 手机 / 邮箱"
            className="h-9 w-55"
          />
          <AdminFilterSelect
            value={statusFilter}
            onValueChange={setStatusFilter}
            ariaLabel="用户状态"
            triggerClassName="h-9 w-[128px]"
            options={[
              { value: 'all', label: '全部状态' },
              { value: '1', label: '正常' },
              { value: '0', label: '已停用' },
            ]}
          />
          <Button
            onClick={() => void handleSync()}
            disabled={syncPending}
            className="h-9"
          >
            <RefreshCw data-icon="inline-start" className={cn(syncPending ? 'animate-spin' : undefined)} />
            {syncPending ? '同步中...' : '同步钉钉'}
          </Button>
        </div>
      </div>

      {feedback ? (
        <Alert variant={feedback.tone === 'error' ? 'destructive' : 'default'} className="py-2">
          {feedback.tone === 'success' ? <CircleCheck /> : <TriangleAlert />}
          <AlertDescription>{feedback.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {loading ? (
          <div className="flex w-full flex-col gap-3">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : loadError ? (
          <EmptyPanel message={loadError} />
        ) : directory?.list.length ? (
          <div className="min-h-0 flex-1 overflow-auto rounded-md border border-border bg-background">
            <Table className="min-w-[1080px] table-fixed">
              <colgroup>
                <col className="w-[280px]" />
                <col />
                <col className="w-[180px]" />
                <col className="w-[110px]" />
                <col className="w-[120px]" />
                <col className="w-[160px]" />
              </colgroup>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="whitespace-nowrap">用户</TableHead>
                  <TableHead className="whitespace-nowrap">部门</TableHead>
                  <TableHead className="whitespace-nowrap">工号</TableHead>
                  <TableHead className="whitespace-nowrap">状态</TableHead>
                  <TableHead className="whitespace-nowrap">身份</TableHead>
                  <TableHead className="whitespace-nowrap">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
              {directory.list.map((item) => {
                const isRowPending = pendingAction === `admin:${item.id}`;
                const avatarFallback = getDisplayNameInitial(item);
                const jobNumber = String(item.job_number || '').trim() || '未设置';
                const guardMessage = getAdminActionBlockReason({
                  user: item,
                  currentUserId: session?.userId,
                  adminCount: directory.summary.adminCount,
                });

                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar className="size-8 shrink-0 border border-border bg-accent">
                          {item.avatar ? <AvatarImage src={item.avatar} alt={item.name || item.id} /> : null}
                          <AvatarFallback>{avatarFallback}</AvatarFallback>
                        </Avatar>
                        <AdminTruncatedText className="font-medium text-foreground">{item.name || '未命名用户'}</AdminTruncatedText>
                      </div>
                    </TableCell>
                    <TableCell><AdminTruncatedText className="text-muted-foreground">{item.department_name || '未分配部门'}</AdminTruncatedText></TableCell>
                    <TableCell className={cn(styles.mono, 'whitespace-nowrap text-muted-foreground')}>{jobNumber}</TableCell>
                    <TableCell>
                      <StatusInline
                        tone={getUserStatusTone(item.status)}
                        label={item.statusLabel}
                      />
                    </TableCell>
                    <TableCell>
                      <AdminBadge active={item.isAdmin} />
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant={item.isAdmin ? 'outline' : 'default'}
                        className="whitespace-nowrap"
                        title={guardMessage || undefined}
                        disabled={isRowPending || Boolean(guardMessage)}
                        onClick={() => void handleAdminToggle(item)}
                      >
                        {isRowPending ? '处理中...' : item.isAdmin ? '移除管理员' : '授予管理员'}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <EmptyPanel message="当前筛选条件下没有用户" />
        )}
      </div>
    </div>
  );
}

export default function SystemPage() {
  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
      <AdminPageHeader
        title="系统管理"
        description="维护用户目录、管理员身份和钉钉组织同步。高风险身份变更保留现有保护规则。"
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <UsersPanel />
      </div>
    </div>
  );
}
